const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../tg-smart-engine.js');
const data={funcionarios:[{id:'f',adminId:'a'},{id:'g',adminId:'a'}],encarregados:[{id:'e',adminId:'a',funcionariosIds:['f']}],
servicos:[{id:'late',adminId:'a',data:'2026-09-30',status:'pendente',funcionarioId:'f'},{id:'today',adminId:'a',data:'2026-10-01',status:'pendente',funcionarioId:'g'},{id:'tomorrow',adminId:'a',data:'2026-10-02',status:'pendente',funcionarioId:null},{id:'done',adminId:'a',data:'2026-09-25',status:'concluído',funcionarioId:'f'},{id:'cancel',adminId:'a',data:'2026-09-25',status:'cancelado',funcionarioId:'f'},{id:'secret',adminId:'b',data:'2026-09-20',status:'pendente',funcionarioId:null}],
contratos:[{id:'expired',adminId:'a',validadeContrato:'2026-09-30'},{id:'near',adminId:'a',validadeContrato:'2026-10-31'},{id:'far',adminId:'a',validadeContrato:'2026-11-01'},{id:'secret',adminId:'b',validadeContrato:'2026-10-01'}],
artigos:[{id:'x',adminId:'a',nome:'Câmara',stockInicial:5,stockMinimo:4,alertaStock:true},{id:'off',adminId:'a',stockInicial:0,stockMinimo:4,alertaStock:false}],
movimentosStock:[{adminId:'a',artigoId:'x',tipo:'saida',quantidade:3},{adminId:'a',artigoId:'x',tipo:'devolucao',quantidade:1},{adminId:'b',artigoId:'x',tipo:'entrada',quantidade:100}],clientes:[{id:'c',adminId:'a',nome:'João Silva'},{id:'s',adminId:'b',nome:'Segredo'}]};
const sections=['servicos','contratos','artigos','clientes'];const snap=(u={id:'a',role:'admin'},sec=sections,opt={})=>E.snapshot(data,u,sec,{today:'2026-10-01',...opt});
test('tenant, terminated OS, stock movements and deadline boundaries',()=>{const s=snap();assert.equal(s.stock[0].quantity,3);assert.deepEqual(E.alerts(s).map(x=>[x.kind,x.items.length]),[['late',1],['expired',1],['due',1],['stock',1]]);assert(!JSON.stringify(s).includes('secret'));});
test('employee and foreman cannot read others or management modules',()=>{for(const role of ['funcionario','encarregado']){const s=snap({id:role==='funcionario'?'f':'e',role});assert.deepEqual(s.os.map(x=>x.id),['late','tomorrow','done','cancel']);assert.equal(s.contracts.length,0);assert.equal(s.clients.length,0);assert.equal(s.stock.length,0);assert.match(E.reply('contratos',s).text,/não permite/);}});
test('no data for missing tenant, forbidden role, license or module',()=>{for(const u of [null,{id:'x',role:'funcionario'},{id:'s',role:'superadmin'},{id:'a',role:'cliente'}])assert.equal(snap(u).ready,false);assert.equal(snap(undefined,sections,{licensed:false}).ready,false);assert.equal(E.alerts(snap(undefined,[])).length,0);});
test('dates, follow-up, accent search and natural language routing',()=>{const s=snap();assert.match(E.reply('o que tenho hoje?',s).text,/today/);assert.match(E.reply('e amanhã?',s,'os').text,/tomorrow/);assert(!E.reply('os contratos a vencer',s).text.includes('Ordens'));assert.match(E.reply('procura cliente Joao',s).text,/João Silva/);assert.match(E.reply('quantos clientes tenho',s).text,/Clientes: 1/);assert.match(E.reply('os atrasadas',s).text,/late/);assert(!E.reply('os atrasadas',s).text.includes('OS cancel ·'));});
test('snapshot is read-only',()=>{const before=JSON.stringify(data);E.alerts(snap());E.reply('resumo',snap());assert.equal(JSON.stringify(data),before);});
test('Teco understands portal, urgency, report drafts and direct record actions without tenant leaks',()=>{
 const d={...data,servicos:data.servicos.map(x=>({...x,clienteId:'c',numeroRegisto:x.id})),assistencias:[{id:'p',adminId:'a',clienteId:'c',numero:'AST-1',estado:'aberta',origem:'portal',prioridade:'urgente'},{id:'u',adminId:'a',clienteId:'c',estado:'aberta',prioridade:'alta'},{id:'secret',adminId:'b',estado:'aberta',origem:'portal'}],relatoriosEspecialidade:[{id:'r',adminId:'a',servicoId:'today',tipo:'RCCTV',rascunho:true},{id:'secret',adminId:'b',servicoId:'secret',rascunho:true}]};
 const s=E.snapshot(d,{id:'a',role:'admin'},[...sections,'assistencias'],{today:'2026-10-01'});
 assert.deepEqual(E.alerts(s).slice(0,3).map(x=>x.kind),['portal','urgent','drafts']);
 assert.match(E.reply('Teco podes mostrar pedidos do portal?',s).text,/AST-1/);
 assert.equal(E.reply('assistências urgentes',s).actions.filter(x=>x.recordType).length,2);
 assert.equal(E.reply('relatórios por assinar',s).actions[0].recordId,'today');
 assert.match(E.reply('OS do cliente João',s).text,/João Silva/);
 assert.equal(E.reply('procura cliente João',s).actions[0].recordType,'clients');
 assert.match(E.reply('como concluir um serviço',s).text,/permissões/);
 assert.match(E.reply('stock de câmara',s).text,/Câmara: 3/);
 assert(!JSON.stringify(s).includes('secret'));
 const no=E.snapshot(d,{id:'a',role:'admin'},sections,{today:'2026-10-01'});assert.equal(no.assistance.length,0);assert.match(E.reply('pedidos do portal',no).text,/não permite/);
 const worker=E.snapshot(d,{id:'f',role:'funcionario'},[...sections,'assistencias'],{today:'2026-10-01'});assert.equal(worker.assistance.length,0);assert.equal(worker.drafts.length,0);
});
