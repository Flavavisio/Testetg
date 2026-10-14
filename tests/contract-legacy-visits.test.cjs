const {test}=require('node:test');const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('tg-contract-maintenance.js','utf8');
const start=source.indexOf('    function yearlyVisits(c,'),end=source.indexOf('    function yearlyVisitsHTML(c',start);
function count(records,contract,year){const ctx={dados:{registosManutencao:records}};vm.createContext(ctx);vm.runInContext(source.slice(start,end)+';globalThis.run=yearlyVisits;',ctx);return ctx.run(contract,year);}
const c={id:'c',adminId:'a',gestaoManutencao:{servicos:{visitasAno:4}}};
test('separate legacy maintenance records without IDs are counted, but not other companies',()=>{
 const records=[{adminId:'a',contratoId:'c',dataRealizacao:'2026-01-05'},{adminId:'a',contratoId:'c',dataRealizacao:'2026-01-05'},{adminId:'b',contratoId:'c',dataRealizacao:'2026-01-05'}];
 assert.equal(count(records,c,2026).completed,2);assert.equal(count(records,c,2026).remaining,2);
});
test('two records from one OS are counted as one visit',()=>{const rows=[{id:'1',servicoId:'os',adminId:'a',contratoId:'c',dataRealizacao:'2026-05-01'},{id:'2',servicoId:'os',adminId:'a',contratoId:'c',dataRealizacao:'2026-05-01'}];assert.equal(count(rows,c,2026).completed,1);});
test('unknown yearly target remains undefined rather than zero',()=>{const v=count([],{id:'c',adminId:'a'},2026);assert.equal(v.planned,null);assert.equal(v.remaining,null);});