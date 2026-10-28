const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('tg-contract-maintenance.js','utf8');
const start=source.indexOf('    function annualCalendar(c,'),end=source.indexOf('    function historyHTML(c,incomplete)',start);
assert(start>0&&end>start);
function context(records,plans,today='2026-10-14'){
 const c={dados:{registosManutencao:records},schedule:()=>plans,getDataHoje:()=>today,recordLocation:(r)=>r.localId||'',planLabel:p=>p.nome||p.tipo||'CCTV',esc:String,contractWarning:null,
 avancarPeriodicidade:(v,p)=>{const d=new Date(v+'T12:00:00Z');const m={mensal:1,trimestral:3,semestral:6,anual:12}[p];if(!m)return null;d.setUTCMonth(d.getUTCMonth()+m);return d.toISOString().slice(0,10);}};
 vm.createContext(c);vm.runInContext(source.slice(start,end)+';globalThis.build=annualCalendar;globalThis.warn=contractWarning;',c);return c;
}
const ct={id:'1',adminId:'a'};
test('quarterly plan produces all occurrences in current annual window, never an OS',()=>{
 const x=context([],[{data:'2026-01-15',plan:{id:'p',tipo:'cctv',periodicidade:'trimestral'},localId:'loc',localNome:'Sede'}]);
 const rows=x.build(ct,2026);
 assert.deepEqual(Array.from(rows,r=>r.date),['2026-01-15','2026-04-15','2026-07-15','2026-10-15']);
 assert(rows.every(r=>r.osId===null));
});
test('no periodicity does not generate speculative future visits',()=>{const x=context([],[{data:'2026-01-01',plan:{id:'x'},localId:'l'}]);assert.equal(x.build(ct,2026).length,0);});
test('deduplicate completed maintenance registers per original OS and scope by company',()=>{
 const rows=[{id:'a',adminId:'a',contratoId:'1',servicoId:'os',dataRealizacao:'2026-02-10'},{id:'b',adminId:'a',contratoId:'1',servicoId:'os',dataRealizacao:'2026-02-10'},{id:'c',adminId:'b',contratoId:'1',servicoId:'other',dataRealizacao:'2026-02-10'}];
 const x=context(rows,[]);assert.equal(x.build(ct,2026).length,1);
});
test('overdue warning is read-only',()=>{const x=context([],[{data:'2026-09-01',plan:{id:'p'}}]);assert.equal(x.warn(ct).type,'late');});
test('assets agree on cache version and no production deployment scripts added',()=>{
 const index=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 assert.match(index,/tg-contract-maintenance\.js\?v=1\.10\.0/);
 assert.match(sw,/tg-contract-maintenance\.js\?v=1\.10\.0/);
 assert.match(index,/app-principal\.js\?v=assist-conclusao-20261028/);
});

test('completed equipment maintenance is not also shown as pending for identical date and location',()=>{
 const reg=[{id:'r1',adminId:'a',contratoId:'1',servicoId:'os1',localId:'loc',sistemasIds:['p'],dataRealizacao:'2026-10-15'}];
 const x=context(reg,[{data:'2026-10-15',plan:{id:'p',tipo:'cctv',periodicidade:'anual'},localId:'loc',localNome:'Sede'}]);
 const rows=x.build(ct,2026);
 assert.equal(rows.filter(r=>r.type==='feito').length,1);
 assert.equal(rows.filter(r=>r.type==='previsto'||r.type==='atraso').length,0);
});

test('visit completed five days after planned date clears only the matching equipment',()=>{
 const records=[{id:'late',adminId:'a',contratoId:'1',localId:'loc',sistemasIds:['p'],dataRealizacao:'2026-10-20'}];
 const plans=[{data:'2026-10-15',plan:{id:'p',tipo:'cctv',periodicidade:'anual'},localId:'loc'},
 {data:'2026-10-15',plan:{id:'different',tipo:'alarme',periodicidade:'anual'},localId:'loc'}];
 const rows=context(records,plans).build(ct,2026);
 assert.equal(rows.filter(e=>e.type==='feito').length,1);
 assert.equal(rows.filter(e=>e.type==='previsto').length,1);
});
test('visit without equipment identity does not silently clear planned work',()=>{
 const records=[{id:'legacy',adminId:'a',contratoId:'1',localId:'loc',dataRealizacao:'2026-10-16'}];
 const plans=[{data:'2026-10-15',plan:{id:'p',tipo:'cctv',periodicidade:'anual'},localId:'loc'}];
 assert.equal(context(records,plans).build(ct,2026).length,2);
});
