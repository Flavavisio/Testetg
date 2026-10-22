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
test('employee sees own sheets and cannot discover other staff through filters',()=>{
 const {c,rows,options}=setup();c.usuarioLogado={id:'f1',adminId:'tenant',role:'funcionario'};c.renderizarFolhas();assert.deepEqual(rows(),['ana']);assert.deepEqual(options('tecnico'),['f1']);assert.deepEqual(options('cliente'),['c1']);
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
