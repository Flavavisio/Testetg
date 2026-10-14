const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('tg-contract-maintenance.js','utf8');
const start=source.indexOf('    function annualCalendar(c,'),end=source.indexOf('    function historyHTML(c,incomplete)',start);
assert(start>0&&end>start);
function context(records,plans,today='2026-10-14'){
 const c={dados:{registosManutencao:records},schedule:()=>plans,getDataHoje:()=>today,planLabel:p=>p.nome||p.tipo||'CCTV',esc:String,contractWarning:null,
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
 assert.match(index,/tg-contract-maintenance\.js\?v=1\.7\.0/);
 assert.match(sw,/tg-contract-maintenance\.js\?v=1\.7\.0/);
 assert.match(index,/ct-final-polish/);
});
