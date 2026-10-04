const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const main=fs.readFileSync('app-principal.js','utf8');
const fn=name=>main.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0];
test('Foco and Nexus employees retain operational home while admin and other layouts are unchanged',()=>{
 const dom=new JSDOM('<nav id="tgSidebarNav"></nav><div id="cardsGrid"><div class="grupo-cards" data-grupo="equipa"><div class="grupo-header"><h3>Equipa</h3></div><div class="card-principal" data-card="ponto"><div class="info"><h3>Ponto</h3></div></div><div class="card-principal hidden-card" data-card="clientes"></div><div class="card-principal card-bloqueado" data-card="crm"></div></div></div>',{runScripts:'outside-only'}),w=dom.window;
 try{
 w.usuarioLogado={id:'e',adminId:'a',role:'funcionario'};w.dados={administradores:[{id:'a',layout:'aurora'}]};w.obterConfig=()=>({layout:'foco'});w._dispositivoEhMobile=()=>w.innerWidth<=900;
 w._ultimoUserSidebar='e';w._contextoAtual='ponto';w._marcarNavAtivo=()=>{};
 w.eval(['obterLayout','_ehPerfilMobile','construirSidebar','_focoAlternarGrupo'].map(fn).join('\n')+'\n'+main.match(/        function _layoutUsaSidebarShell\(\)[^\n]+/)[0]);
 for(const layout of ['foco','aurora'])for(const width of [390,768,1440]){w.dados.administradores[0].layout=layout;w.innerWidth=width;assert.equal(w.obterLayout(),'cards');assert.equal(w._layoutUsaSidebarShell(),false);assert.equal(w._ehPerfilMobile(),true);assert.equal(w.dados.administradores[0].layout,layout);}
 for(const role of ['admin','subadmin'])for(const layout of ['cards','sidebar','foco','aurora'])for(const width of [390,1440]){w.usuarioLogado={id:role==='admin'?'a':'s',adminId:'a',role};w.dados.administradores[0].layout=layout;w.innerWidth=width;assert.equal(w.obterLayout(),width<=900&&layout!=='aurora'?'cards':layout);assert.equal(w._ehPerfilMobile(),layout==='aurora'?false:width<=900);}
 w.usuarioLogado={id:'x',adminId:'a',role:'encarregado'};assert.equal(w._ehPerfilMobile(),false);assert.equal(w.dados.administradores[0].layout,'aurora');w.dados.administradores[0].layout='foco';assert(w._ehPerfilMobile());
 }finally{w.close();}
});
test('daily home returns from desktop shell and bottom navigation keeps role-specific items',()=>{
 const dom=new JSDOM('<div id="tgHome"><div id="homeAgendaWrap"><div id="omeudia">O Meu Dia completo</div></div></div><div id="cardsGrid"><div id="dashboardGrupos"></div><div class="grupo-cards" data-grupo="obras"><div class="grupo-header"><h3>Obras e Serviços</h3></div><div class="card-principal" data-card="servicos"></div><div class="card-principal hidden-card" data-card="crm"></div></div><div class="grupo-cards" data-grupo="oculto"><div class="card-principal hidden-card"></div></div></div><div id="menuInferiorMobile"></div><div id="painelGrupoMobile"></div>',{runScripts:'outside-only'}),w=dom.window;
 try{
 w.innerWidth=390;w.usuarioLogado={id:'a',role:'admin'};w.dados={administradores:[{id:'a',layout:'foco'}]};w._dispositivoEhMobile=()=>w.innerWidth<=900;w.escapeHtmlSimples=s=>s;w._ultimoGrupoMobileAberto=null;w.scrollTo=()=>{};
 w.eval(['obterLayout','_ehPerfilMobile','_montarMenuInferiorMobile','_fecharSecaoAbertaMobile','_voltarMeuDia'].map(fn).join('\n'));
 w._montarMenuInferiorMobile();assert.equal(w.document.getElementById('omeudia').parentElement.id,'cardsGrid');assert.equal(w.document.getElementById('omeudia').textContent,'O Meu Dia completo');assert(w.document.getElementById('menuInfDashboardCentral'));assert(w.document.getElementById('menuInfHome'));assert(!w.document.getElementById('menuInf_oculto'));
 w.usuarioLogado={id:'e',adminId:'a',role:'funcionario'};w.dados.administradores[0].layout='aurora';w.innerWidth=1440;w._montarMenuInferiorMobile();assert.equal(w.document.getElementById('menuInferiorMobile').style.display,'flex');assert(!w.document.getElementById('menuInfDashboardCentral'));assert(w.document.getElementById('menuInf_obras'));
 w.document.getElementById('omeudia').style.display='none';w._voltarMeuDia();assert.equal(w.document.getElementById('omeudia').style.display,'block');assert.equal(w.document.getElementById('painelGrupoMobile').style.display,'none');
 }finally{w.close();}
});
function setup(){
 const dom=new JSDOM('<div id="wsClienteOverlay" class="open" data-cliente-atual="c"><div id="wsClienteConteudo"></div></div>',{runScripts:'outside-only'}),w=dom.window;
 w.usuarioLogado={id:'a',role:'admin'};w.dados={clientes:[{id:'c',adminId:'a'},{id:'other',adminId:'b'}],servicos:[],assistencias:[],oportunidades:[],propostas:[]};w.admin={assist:true,crm:true};w.licensed=true;w._licencaValidaTenant=()=>w.licensed;w.adminDoUtilizador=()=>w.admin;
 for(const [fn,key] of [['moduloAssistAtivo','assist'],['moduloCrmAtivo','crm'],['moduloArmazemAtivo','obras'],['moduloContratosAtivo','contratos']])w[fn]=a=>!!a[key];
 w._wsAbaAtual='historico';w.M={servicos:{from:r=>({...r,adminId:r.admin_id,clienteId:r.cliente_id}),to:r=>r}};w._snap={servicos:new Map()};w._wsSairPara=()=>{};w.abrirVerOS=id=>w.opened=id;w.TGModules={open:key=>w.module=key};
 w.calls=[];const query={select(v){w.calls.push(['select',v]);return this;},eq(k,v){w.calls.push(['eq',k,v]);return this;},order(k,v){w.calls.push(['order',k,v]);return this;}};w.supa={from:t=>{w.calls.push(['from',t]);return query;}};
 w._buscarPaginadoGenerico=async()=>({data:[{id:'old',admin_id:'a',cliente_id:'c',data:'2020-01-01',numeroRegisto:'1',descricao:'<img src=x onerror=bad>',status:'concluido'}]});
 w.eval(fs.readFileSync('tg-client-history.js','utf8'));return w;
}
test('history scopes tenant, customer and purchased modules, sorts and excludes deleted proposals',()=>{
 const w=setup();try{
 const row={adminId:'a',clienteId:'c',data:'2026-01-01',dataCriacao:'2026-01-02'};
 const data={assistencias:[{...row,id:'assist'},{...row,id:'other',adminId:'b'}],oportunidades:[{...row,id:'opp'}],propostas:[{adminId:'a',oportunidadeId:'opp',id:'proposal',dataCriacao:'2026-02-01'},{...row,id:'deleted',apagadoSuperAdmin:true}]};
 const records=w.TGClientHistory.events(w.TGClientHistory.scope('c'),data,[{...row,id:'os'},{...row,id:'wrong',clienteId:'other'}]);assert.deepEqual(Array.from(records,e=>e.id),['proposal','assist','opp','os']);
 w.admin.assist=false;w.admin.crm=false;assert.deepEqual(Array.from(w.TGClientHistory.events(w.TGClientHistory.scope('c'),data,[{...row,id:'os'}]),e=>e.id),['os']);
 assert.equal(w.TGClientHistory.scope('other'),null);w.usuarioLogado.role='funcionario';assert.equal(w.TGClientHistory.scope('c'),null);
 }finally{w.close();}
});
test('archive loads inside customer with safe text, filters and clean snapshots; revocation removes it',async()=>{
 const w=setup();try{
 await w.TGClientHistory.show('c');assert(w.document.querySelector('#tgCustomerHistory'));assert(!w.document.querySelector('#tgCustomerHistory img'));assert.equal(w.dados.servicos.length,0);
 assert(w.calls.some(c=>c[0]==='eq'&&c[1]==='admin_id'&&c[2]==='a'));assert(w.calls.some(c=>c[0]==='eq'&&c[1]==='cliente_id'&&c[2]==='c'));
 const search=w.document.querySelector('[data-history-search]');search.value='missing';search.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(w.document.querySelectorAll('.tg-history-event').length,0);search.value='';search.dispatchEvent(new w.Event('input',{bubbles:true}));
 w.document.querySelector('[data-history-open]').click();assert.equal(w.opened,'old');assert.equal(w.dados.servicos.length,1);assert.equal(w._snap.servicos.get('old'),JSON.stringify(w.M.servicos.to(w.dados.servicos[0])));
 w.licensed=false;w.document.dispatchEvent(new w.Event('tg:interface-updated'));assert(!w.document.querySelector('#tgCustomerHistory'));
 }finally{w.close();}
});
test('late responses cannot overwrite a new tab or account; revoked module buttons cannot open',async()=>{
 const w=setup();try{
 let resolve;w._buscarPaginadoGenerico=()=>new Promise(r=>resolve=r);const pending=w.TGClientHistory.show('c');w._wsAbaAtual='resumo';w.document.getElementById('wsClienteConteudo').textContent='Resumo';resolve({data:[]});await pending;assert.equal(w.document.getElementById('wsClienteConteudo').textContent,'Resumo');
 w._wsAbaAtual='historico';w._buscarPaginadoGenerico=async()=>({data:[]});w.dados.assistencias=[{id:'as',adminId:'a',clienteId:'c',assunto:'Pedido',dataCriacao:'2026-01-01'}];await w.TGClientHistory.show('c');const button=w.document.querySelector('[data-history-open]');w.admin.assist=false;button.click();assert.equal(w.module,undefined);w.document.dispatchEvent(new w.Event('tg:interface-updated'));assert.equal(w.document.querySelectorAll('.tg-history-event').length,0);
 w.usuarioLogado={id:'b',role:'admin'};w.document.dispatchEvent(new w.Event('tg:interface-updated'));assert(!w.document.querySelector('#tgCustomerHistory'));
 }finally{w.close();}
});
