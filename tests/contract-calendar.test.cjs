const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('tg-contract-maintenance.js','utf8');
const a=source.indexOf('    // Read-only annual calendar:');const b=source.indexOf('    function historyHTML(c,incomplete)',a);assert(a>0&&b>a);
function setup(records,dates){
 const context={dados:{registosManutencao:records},schedule:()=>dates,planLabel:p=>p.name||'CCTV',getDataHoje:()=> '2026-10-14',esc:x=>String(x)};
 vm.createContext(context);vm.runInContext(source.slice(a,b)+';globalThis.cal=annualCalendar;globalThis.warn=contractWarning;',context);return context;
}
const contract={id:'ct',adminId:'a'};
test('calendar isolates company and contract, deduplicates completed visits sharing OS',()=>{
 const x=setup([{id:'r1',adminId:'a',contratoId:'ct',servicoId:'os1',dataRealizacao:'2026-05-01'},{id:'r2',adminId:'a',contratoId:'ct',servicoId:'os1',dataRealizacao:'2026-05-01'},{id:'r3',adminId:'other',contratoId:'ct',dataRealizacao:'2026-06-01'}],[{data:'2026-11-12',plan:{name:'CCTV'},localNome:'Sede'}]);
 assert.equal(x.cal(contract,2026).length,2);
 assert.equal(x.cal(contract,2026).filter(v=>v.type==='feito').length,1);
});
test('flags overdue and upcoming visits without changing records',()=>{
 const x=setup([],[{data:'2026-10-10',plan:{name:'A'}},{data:'2026-10-25',plan:{name:'B'}}]);
 assert.equal(x.warn(contract).type,'late');
 assert.equal(x.cal(contract,2026).find(v=>v.date==='2026-10-25').type,'previsto');
});
test('no overdue dates returns upcoming alert',()=>{const x=setup([],[{data:'2026-10-20',plan:{name:'A'}}]);assert.equal(x.warn(contract).type,'soon');});
