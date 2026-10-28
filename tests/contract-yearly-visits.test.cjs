const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('tg-contract-maintenance.js','utf8');
const fn=source.slice(source.indexOf('    function yearlyVisits(c,'),source.indexOf('    function historyHTML(c,incomplete)'));
function setup(records=[]){const context={dados:{registosManutencao:records},esc:x=>String(x)};vm.createContext(context);vm.runInContext(fn+';globalThis.visits=yearlyVisits;globalThis.markup=yearlyVisitsHTML;',context);return context;}
const c={id:'ct',adminId:'a',gestaoManutencao:{servicos:{visitasAno:4}}};
test('yearly counter deduplicates systems on same OS and scopes tenant, contract and year',()=>{const x=setup([{id:'r1',adminId:'a',contratoId:'ct',servicoId:'os1',dataRealizacao:'2026-05-01'},{id:'r2',adminId:'a',contratoId:'ct',servicoId:'os1',dataRealizacao:'2026-05-01'},{id:'r3',adminId:'a',contratoId:'ct',servicoId:'os2',dataRealizacao:'2026-09-01'},{id:'r4',adminId:'b',contratoId:'ct',servicoId:'os3',dataRealizacao:'2026-05-01'},{id:'r5',adminId:'a',contratoId:'other',servicoId:'os4',dataRealizacao:'2026-05-01'},{id:'r6',adminId:'a',contratoId:'ct',servicoId:'os5',dataRealizacao:'2025-12-30'}]);const s=x.visits(c,2026);assert.equal(s.planned,4);assert.equal(s.completed,2);assert.equal(s.remaining,2);});
test('manual visits same date count separately and planned undefined is never treated as zero',()=>{const x=setup([{id:'a',adminId:'a',contratoId:'ct',dataRealizacao:'2026-01-05'},{id:'b',adminId:'a',contratoId:'ct',dataRealizacao:'2026-01-05'}]);const s=x.visits({...c,gestaoManutencao:{}},2026);assert.equal(s.completed,2);assert.equal(s.planned,null);assert.equal(s.remaining,null);});
test('over visits are highlighted, never negative remaining',()=>{const x=setup(Array.from({length:5},(_,i)=>({id:String(i),adminId:'a',contratoId:'ct',dataRealizacao:'2026-07-11'})));const s=x.visits(c,2026);assert.equal(s.completed,5);assert.equal(s.remaining,0);assert.equal(s.excess,1);assert.match(x.markup(c,2026),/Visitas adicionais: 1/);});
test('assistance and pending OS never consume visits; conclusion consumes exactly once in its completion year',()=>{
 const x=setup();x.dados.assistencias=[{id:'a',adminId:'a',testeContratoId:'ct',testeVisitaAno:2026,osGeradaId:'os'},{id:'foreign',adminId:'b',testeContratoId:'ct',testeVisitaAno:2026},{id:'no-os',adminId:'a',testeContratoId:'ct',testeVisitaAno:2026,estado:'resolvida'}];
 assert.equal(x.visits(c,2026).used,0);assert.equal(x.visits(c,2026).remaining,4);
 x.dados.servicos=[{id:'os',adminId:'a',contratoId:'ct',status:'pendente',data:'2026-12-31'}];assert.equal(x.visits(c,2026).used,0);
 x.dados.servicos[0].status='concluído';x.dados.assistencias[0].testeVisitaConcluidaEm='2027-01-02T10:00:00Z';
 assert.equal(x.visits(c,2026).used,0);assert.equal(x.visits(c,2027).used,1);assert.equal(x.visits(c,2027).remaining,3);assert.equal(x.visits(c,2027).reserved,0);
 x.dados.registosManutencao.push({id:'r',adminId:'a',contratoId:'ct',servicoId:'os',dataRealizacao:'2027-01-02'},{id:'r2',adminId:'a',contratoId:'ct',servicoId:'os',dataRealizacao:'2027-01-02'});assert.equal(x.visits(c,2027).used,1);
 x.dados.assistencias[0].dataModificacao=Date.UTC(2028,1,1);assert.equal(x.visits(c,2027).used,1);assert.equal(x.visits(c,2028).used,0);
});
test('legacy concluded assistance OS uses its recorded completion date without manufacturing maintenance records',()=>{
 const x=setup();x.dados.assistencias=[{id:'a',adminId:'a',testeContratoId:'ct',testeVisitaAno:2026,osGeradaId:'os'}];x.dados.servicos=[{id:'os',adminId:'a',contratoId:'ct',origem:'assistencia',status:'concluído',data:'2027-01-03'}];
 assert.equal(x.visits(c,2026).used,0);assert.equal(x.visits(c,2027).used,1);assert.equal(x.dados.registosManutencao.length,0);
});
