const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../tg-work-sheets.js'),'utf8');
function setup() {
 const nodes={};
 for(const id of ['tabelaFolhas','emptyFolhas','folhasFiltroContagem'])nodes[id]={style:{},innerHTML:'',textContent:''};
 for(const key of ['cliente','instalacao','obra','tecnico','validacao'])nodes['folhasFiltro_'+key]={value:'',options:[],replaceChildren(...options){this.options=options},add(option){this.options.push(option)}};
 const calls=[],errors=[];
 const c=vm.createContext({console,Option:function(text,value){this.text=text;this.value=value},navigator:{onLine:true},
 document:{getElementById:id=>nodes[id]||null},usuarioLogado:{id:'boss',adminId:'tenant',role:'encarregado'},
 dados:{administradores:[{id:'tenant',nome:'Admin'}],funcionarios:[{id:'f1',adminId:'tenant',nome:'Ana'},{id:'f2',adminId:'tenant',nome:'Bruno'},{id:'f3',adminId:'tenant',nome:'Carla'},{id:'foreign',adminId:'other',nome:'Outro tenant'}],encarregados:[{id:'boss',adminId:'tenant',nome:'Chefe',funcionariosIds:['f1','f2','foreign']}],clientes:[{id:'c1',adminId:'tenant',nome:'Cliente equipa'},{id:'c2',adminId:'tenant',nome:'Cliente privado'}],locais:[],obras:[],contratos:[],servicos:[],folhasObra:[
 {id:'self',adminId:'tenant',funcionarioId:'boss'}, {id:'ana',adminId:'tenant',funcionarioId:'f1',clienteId:'c1'},
 {id:'bruno',adminId:'tenant',funcionarioId:'f2',clienteId:'c1'}, {id:'carla',adminId:'tenant',funcionarioId:'f3',clienteId:'c2'},
 {id:'admin',adminId:'tenant',funcionarioId:'tenant'}, {id:'other',adminId:'other',funcionarioId:'f1'},
 {id:'cross-team',adminId:'tenant',funcionarioId:'foreign'}]},_folhasOrdem:'desc',_folhasCarregadoDesde:'2026-07-22',
 _tenantId:()=>c.usuarioLogado.adminId||c.usuarioLogado.id,renderizarFolhas(){},escapeHtmlSimples:s=>String(s||''),mostrarErro:s=>errors.push(s),_guardarCacheLocal(){},
 abrirFolhaDetalhe:id=>calls.push(['open',id]),gerarPDFFolha:id=>calls.push(['pdf',id]),excluirEntidade:(type,id)=>calls.push(['delete',id]),
 supa:{from(){throw Error('staff cannot validate')}}
 });
 c.window=c;vm.runInContext(source,c);
 const rows=()=>[...nodes.tabelaFolhas.innerHTML.matchAll(/data-folha-id="([^"]+)"/g)].map(m=>m[1]).sort();
 const options=key=>nodes['folhasFiltro_'+key].options.map(o=>o.value).filter(Boolean).sort();
 return {c,nodes,calls,errors,rows,options};
}
test('encarregado sees own and assigned staff only; filters use this same scope',()=>{
 const {c,rows,options}=setup();c.renderizarFolhas();assert.deepEqual(rows(),['ana','bruno','self']);assert.deepEqual(options('tecnico'),['boss','f1','f2']);assert.deepEqual(options('cliente'),['c1','sem']);
});
test('employee sees own pending sheets without filter options',()=>{
 const {c,rows,options}=setup();c.usuarioLogado={id:'f1',adminId:'tenant',role:'funcionario'};c.renderizarFolhas();assert.deepEqual(rows(),['ana']);assert.deepEqual(options('tecnico'),[]);assert.deepEqual(options('cliente'),[]);
});
test('filters narrow rows and clearing them does not widen permission scope',()=>{
 const {c,nodes,rows}=setup();c.renderizarFolhas();nodes.folhasFiltro_tecnico.value='f2';c.tgFolhasFiltrar();assert.deepEqual(rows(),['bruno']);c.tgFolhasLimpar();assert.deepEqual(rows(),['ana','bruno','self']);
});
test('removing a team member immediately removes their rows and filter options',()=>{
 const {c,nodes,rows,options}=setup();c.renderizarFolhas();nodes.folhasFiltro_tecnico.value='f2';c.dados.encarregados[0].funcionariosIds=['f1'];c.renderizarFolhas();assert.deepEqual(rows(),['ana','self']);assert.deepEqual(options('tecnico'),['boss','f1']);assert.equal(nodes.folhasFiltro_tecnico.value,'');
});
test('no assignment list never grants access to the full company',()=>{
 const {c,rows}=setup();c.dados.encarregados=[];c.renderizarFolhas();assert.deepEqual(rows(),['self']);
});
test('admin and subadmin see company sheets, never another tenant',()=>{
 const {c,rows}=setup();for(const u of [{id:'tenant',role:'admin'},{id:'sub',adminId:'tenant',role:'subadmin'}]){c.usuarioLogado=u;c.renderizarFolhas();assert.deepEqual(rows(),['admin','ana','bruno','carla','cross-team','self']);}
});
test('detail, PDF and deletion reject stale or guessed out-of-scope IDs',()=>{
 const {c,calls,errors}=setup();c.abrirFolhaDetalhe('carla');c.gerarPDFFolha('other');c.excluirEntidade('folha','admin');assert.equal(calls.length,0);assert.equal(errors.length,3);c.abrirFolhaDetalhe('ana');c.gerarPDFFolha('bruno');assert.equal(calls.length,2);c.dados.encarregados[0].funcionariosIds=[];c.abrirFolhaDetalhe('ana');assert.equal(calls.length,2);
});
test('employee and manager cannot validate sheets',async()=>{
 const {c}=setup();await c.tgFolhasValidar('ana');c.usuarioLogado={id:'f1',adminId:'tenant',role:'funcionario'};await c.tgFolhasValidar('ana');
});
test('signed-out and superadmin list no sheets; portal continues using existing access',()=>{
 const {c,rows,calls}=setup();c.usuarioLogado=null;c.renderizarFolhas();assert.deepEqual(rows(),[]);c.usuarioLogado={id:'super',role:'superadmin'};c.renderizarFolhas();assert.deepEqual(rows(),[]);c.usuarioLogado={id:'client',role:'cliente',adminId:'tenant'};c.renderizarFolhas();assert.deepEqual(rows(),[]);c.abrirFolhaDetalhe('ana');assert.equal(calls.length,1);
});

test('employee cards omit verified sheets and ignore stale filters and completed tabs',()=>{
 const {c,nodes,rows}=setup();c.usuarioLogado={id:'f1',adminId:'tenant',role:'funcionario'};
 for(const id of ['folhasGrupos','folhasFiltros','folhasAvisoCarregamento','folhasListaTitulo','folhasFaturacaoTabs'])nodes[id]={};
 c.dados.folhasObra.push({id:'verified',adminId:'tenant',funcionarioId:'f1',validada:true},{id:'legacy',adminId:'tenant',funcionarioId:'f1',validada:null},{id:'finished',adminId:'tenant',funcionarioId:'f1',validada:false,servicoId:'done'});
 c.dados.servicos.push({id:'done',adminId:'tenant',status:'concluído'});
 c.renderizarFolhas();nodes.folhasFiltro_validacao.value='validada';c.tgFolhasGrupo('concluidas');
 assert.deepEqual(rows(),['ana','finished','legacy']);
 for(const id of ['folhasGrupos','folhasFiltros','folhasFiltroContagem','folhasAvisoCarregamento','folhasFaturacaoTabs'])assert.equal(nodes[id].hidden,true,id);
 assert.equal(nodes.folhasListaTitulo.textContent,'Por verificar pela empresa');
 assert(nodes.tabelaFolhas.innerHTML.includes('Abrir folha'));assert(!nodes.tabelaFolhas.innerHTML.includes('data-folha-validacao'));
 c.dados.folhasObra.filter(f=>f.funcionarioId==='f1'&&f.adminId==='tenant').forEach(f=>f.validada=true);c.renderizarFolhas();assert.deepEqual(rows(),[]);assert.equal(nodes.emptyFolhas.textContent,'Não tens folhas de obra por verificar.');
});
test('employee refresh reloads sheets and removes newly verified rows',async()=>{
 const {c,rows}=setup();c.usuarioLogado={id:'f1',adminId:'tenant',role:'funcionario'};c.renderizarFolhas();
 c.carregarTabelaEspecifica=async key=>{assert.equal(key,'folhasObra');c.dados.folhasObra.find(f=>f.id==='ana').validada=true;};
 await c.tgFolhasAtualizar();assert.deepEqual(rows(),[]);
});
test('switching from employee to admin restores filters, count and verified sheets',()=>{
 const {c,nodes,rows}=setup();nodes.folhasFiltros={};c.usuarioLogado={id:'f1',adminId:'tenant',role:'funcionario'};c.dados.folhasObra.find(f=>f.id==='ana').validada=true;c.renderizarFolhas();
 assert(!rows().includes('ana'));assert(nodes.folhasFiltros.hidden);
 c.usuarioLogado={id:'tenant',role:'admin'};c.renderizarFolhas();assert(rows().includes('ana'));assert.equal(nodes.folhasFiltros.hidden,false);assert.equal(nodes.folhasFiltroContagem.hidden,false);
});
test('real employee screen renders cards with no groups, filters or count and readable phone layout',()=>{
 const {JSDOM}=require('jsdom');
 const w=new JSDOM(fs.readFileSync(path.join(__dirname,'../login.html'),'utf8'),{runScripts:'outside-only'}).window;
 try{
  const fixture=setup();w.usuarioLogado={id:'f1',adminId:'tenant',role:'funcionario'};w.dados=fixture.c.dados;
  Object.assign(w,{_tenantId:()=>w.usuarioLogado.adminId||w.usuarioLogado.id,_folhasOrdem:'desc',_folhasCarregadoDesde:'2026-07-22',escapeHtmlSimples:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),renderizarFolhas(){},abrirFolhaDetalhe(){},gerarPDFFolha(){},excluirEntidade(){},mostrarErro(){}});
  const style=w.document.createElement('style');style.textContent=fs.readFileSync(path.join(__dirname,'../tg-work-sheets.css'),'utf8');w.document.head.appendChild(style);
  w.eval(source);w.renderizarFolhas();
  const section=w.document.getElementById('secao-folhas');assert(section.classList.contains('folhas-funcionario'));
  for(const id of ['folhasFiltros','folhasGrupos','folhasFiltroContagem'])assert(w.document.getElementById(id).hidden);
  const row=w.document.querySelector('#tabelaFolhas tr');assert(row);assert.equal(w.getComputedStyle(row).display,'grid');assert.equal(parseFloat(w.getComputedStyle(row.closest('table')).minWidth),0);assert.equal(row.querySelector('button').textContent.trim(),'Abrir folha');assert(!row.querySelector('[data-folha-validacao]'));
  w.dados.folhasObra.find(f=>f.id==='ana').descricao='<img src=x onerror=alert(1)>';w.renderizarFolhas();assert.equal(w.document.querySelector('#tabelaFolhas img'),null);
 }finally{w.close();}
});

test('filters cascade from client through installation, work, technician and validation',()=>{
 const {c,nodes,rows,options}=setup();c.usuarioLogado={id:'tenant',role:'admin'};
 c.dados.locais=[{id:'l1',adminId:'tenant',clienteId:'c1',nome:'Loja'},{id:'l2',adminId:'tenant',clienteId:'c2',nome:'Armazém'}];
 c.dados.obras=[{id:'w1',adminId:'tenant',clienteId:'c1',localId:'l1',nome:'Obra A'},{id:'w2',adminId:'tenant',clienteId:'c1',nome:'Obra B'},{id:'w3',adminId:'tenant',clienteId:'c2',localId:'l2',nome:'Obra C'}];
 c.dados.folhasObra=[
 {id:'a',adminId:'tenant',obraId:'w1',funcionarioId:'f1'},
 {id:'b',adminId:'tenant',obraId:'w2',funcionarioId:'f2',validada:true},
 {id:'c',adminId:'tenant',obraId:'w3',funcionarioId:'f3'}];
 c.renderizarFolhas();nodes.folhasFiltro_cliente.value='c1';c.tgFolhasFiltrar();
 assert.deepEqual(options('instalacao'),['l1','sede:c1']);assert.deepEqual(options('obra'),['w1','w2']);assert.deepEqual(options('tecnico'),['f1','f2']);assert.deepEqual(rows(),['a','b']);
 nodes.folhasFiltro_obra.value='w1';c.tgFolhasFiltrar();assert.deepEqual(options('tecnico'),['f1']);assert.deepEqual(options('validacao'),['nao_validada']);assert.deepEqual(rows(),['a']);
 nodes.folhasFiltro_tecnico.value='f1';nodes.folhasFiltro_validacao.value='nao_validada';nodes.folhasFiltro_cliente.value='c2';c.tgFolhasFiltrar();
 assert.equal(nodes.folhasFiltro_obra.value,'');assert.equal(nodes.folhasFiltro_tecnico.value,'');assert.deepEqual(options('instalacao'),['l2']);assert.deepEqual(options('obra'),['w3']);assert.deepEqual(options('tecnico'),['f3']);assert.deepEqual(rows(),['c']);
 c.tgFolhasLimpar();assert.deepEqual(rows(),['a','b','c']);assert.deepEqual(options('obra'),['w1','w2','w3']);
 nodes.folhasFiltro_instalacao.value='l1';c.tgFolhasFiltrar();assert.deepEqual(options('obra'),['w1']);assert.deepEqual(options('tecnico'),['f1']);
});
test('filter options follow the active work or service group',async()=>{
 const {c,nodes,options}=setup();nodes.folhasGrupos={};
 c.dados.servicos=[{id:'os1',adminId:'tenant',clienteId:'c2',status:'pendente'}];
 c.dados.folhasObra=[{id:'work',adminId:'tenant',funcionarioId:'f1',clienteId:'c1'},{id:'service',adminId:'tenant',funcionarioId:'f2',servicoId:'os1'}];
 c.renderizarFolhas();assert.deepEqual(options('cliente'),['c1']);nodes.folhasFiltro_cliente.value='c1';c.tgFolhasGrupo('os');assert.deepEqual(options('cliente'),['c2']);assert.equal(nodes.folhasFiltro_cliente.value,'');assert.deepEqual(options('tecnico'),['f2']);
 await new Promise(resolve=>setImmediate(resolve));
});
