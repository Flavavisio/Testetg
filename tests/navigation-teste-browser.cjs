const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const main=fs.readFileSync('app-principal.js','utf8'),parsed=new JSDOM(fs.readFileSync('index.html','utf8')).window.document;
const fn=name=>{const match=main.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'));assert(match,name);return match[0]};
for(const file of ['index.html','login.html']){
 const html=fs.readFileSync(file,'utf8'),worker=fs.readFileSync('sw.js','utf8');
 for(const resource of ['tg-navigation.js?v=1.0.1-teste','tg-navigation.css?v=1.0.0-teste','tg-nexus.js?v=1.1.2-teste-nav']){assert(html.includes(resource),file+' '+resource);assert(worker.includes(resource),resource+' offline cache');}
 assert(html.indexOf('tg-navigation.js?v=')>html.indexOf('tg-nexus.js?v='),'Adapter installs after existing modules');
}
const names=['ajustarVisibilidadeCards','_ehPerfilMobile','_dispositivoEhMobile','construirSidebar','_focoAlternarGrupo','_montarMenuInferiorMobile','_fecharSecaoAbertaMobile','_abrirGrupoMobile','_voltarMeuDia','_abrirDashboardCentralMobile','abrirObraLongaDetalhe','_abrirObraLongaDetalheReal','_verObraMostrar'];
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="tg-nexus.css"><link rel="stylesheet" href="tg-navigation.css"></head><body>
<header class="header"><h1>Teste TG</h1><div id="headerExtras"></div></header><aside id="tgSidebar"><nav id="tgSidebarNav"></nav></aside>
${parsed.querySelector('#cardsGrid').outerHTML}
<div id="tgHome" style="display:none"></div><div id="painelGrupoMobile" style="display:none"><div id="painelGrupoMobileConteudo"></div></div><nav id="menuInferiorMobile"></nav>
${['agenda-obras','calendario-equipa','agenda','servicos','clientes','folhas','dashboard-central'].map(id=>`<section class="section-container" id="secao-${id}"><div class="section-header"><h2>${id}</h2></div></section>`).join('')}
<div id="modalGenericoOverlay" class="modal-overlay"><div class="modal"><h2 id="modalGenericoTitulo"></h2><form id="modalGenericoForm"><div id="modalGenericoCampos"></div><div class="modal-actions"><button class="btn-success">Fechar</button></div></form></div></div></body></html>`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BINARY,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!=='https://nav.test')return route.fulfill({status:404,body:''});const name=url.pathname.slice(1);if(!name)return route.fulfill({contentType:'text/html',body:fixture});if(!fs.existsSync(name))return route.fulfill({status:404,body:''});return route.fulfill({contentType:name.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(name)});});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('https://nav.test/');
 await page.addScriptTag({content:`
 var usuarioLogado={id:'a',role:'admin'},layout='aurora',licensed=true,moduleFlags={},calls=[];
 var dados={administradores:[{id:'a',empresa:'Empresa A'}],funcionarios:[{id:'e',adminId:'a',nome:'Ana'},{id:'team',adminId:'a',nome:'Bruno'},{id:'outside',adminId:'a',nome:'Outra equipa'}],encarregados:[{id:'enc',adminId:'a',nome:'Encarregado',funcionariosIds:['team']}],pedidosRenovacao:[],obraPontoLonga:[],
 obras:[{id:'w',adminId:'a',nome:'Obra Centro',clienteId:'client',responsaveisIds:['e','enc'],temAutosMedicao:true,estado:'ativa'},{id:'foreign',adminId:'b',nome:'Obra de outra empresa'}],
 servicos:[{id:'mine',adminId:'a',obraId:'w',funcionarioId:'e',descricao:'OS da Ana',status:'pendente'},{id:'team-os',adminId:'a',obraId:'w',funcionarioId:'team',descricao:'OS da equipa',status:'pendente'},{id:'outside-os',adminId:'a',obraId:'w',funcionarioId:'outside',descricao:'Outra equipa',status:'pendente'},{id:'foreign-os',adminId:'b',obraId:'w',funcionarioId:'e',descricao:'Outra empresa'}],
 folhasObra:[{id:'f',adminId:'a',obraId:'w',funcionarioId:'e',horasTrabalhadas:2,descricao:'Teste'},{id:'ft',adminId:'a',obraId:'w',funcionarioId:'team',horasTrabalhadas:3,descricao:'Equipa'}],
 relatoriosEspecialidade:[{id:'r',adminId:'a',servicoId:'mine',tipo:'RCCTV',numeroDocumento:'RCCTV-1'},{id:'rt',adminId:'a',servicoId:'team-os',tipo:'RIN'},{id:'rf',adminId:'b',servicoId:'mine',tipo:'RDI'}]};
 var _ultimoUserSidebar=null,_contextoAtual='__inicio',_ultimoGrupoMobileAberto=null,_verObraPastaAtual=null;
 function _licencaValidaTenant(){return licensed}function adminAtual(){return dados.administradores[0]}function adminDoUtilizador(){return adminAtual()}
 function obterLayout(){return usuarioLogado?.role==='funcionario'?'cards':layout}function _layoutUsaSidebarShell(){return ['sidebar','foco','aurora'].includes(obterLayout())}
 function expressAtivo(){return false}function _podeAtivarQuiosque(){return ['admin','subadmin'].includes(usuarioLogado?.role)}function _utilizadorTemVeiculo(){return true}
 ${['Armazem','Crm','Assist','Erp','Rondas','Frota','Contratos'].map(key=>`function modulo${key}Ativo(){return moduleFlags.${key}!==false}`).join('\n')}
 function escapeHtmlSimples(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function _mostrarInicioConteudo(){document.body.classList.toggle('com-sidebar',_layoutUsaSidebarShell());document.getElementById('cardsGrid').style.display=_layoutUsaSidebarShell()?'none':'';document.getElementById('tgHome').style.display=_layoutUsaSidebarShell()?'block':'none';document.getElementById('omeudia').style.display=_ehPerfilMobile()?'block':'none'}function _atualizarBreadcrumb(){}function _fecharSidebarMobile(){}function _marcarNavAtivo(){}function _tituloSecao(s){return s}function irParaInicio(){_voltarMeuDia()}
 function abrirSecao(id){calls.push(id);document.querySelectorAll('.section-container.active').forEach(el=>el.classList.remove('active'));document.getElementById('secao-'+id)?.classList.add('active');document.getElementById('omeudia').style.display='none';document.getElementById('painelGrupoMobile').style.display='none';document.getElementById('cardsGrid').style.display='';}
 function abrirCardContratos(){abrirSecao('contratos')}function abrirCardObrasLonga(){abrirSecao('obras-longa')}function abrirCardArmazem(id){abrirSecao(id)}function _abrirAssist(){calls.push('assistencias');return false}function _abrirRondas(){calls.push('rondas');return false}
 var TGModules={open:id=>{calls.push(id);return false}};function abrirGestaoRelatoriosPersonalizados(){calls.push('models')}function abrirModalExportarImportar(){calls.push('export')}
 function _verificarAvisoDocsObra(){return Promise.resolve()}function totalHorasObra(){return 5}function getDataHoje(){return '2026-10-24'}function obrasAvancadoAtivo(){return true}
 function obterNomeCliente(){return 'Cliente A'}function _nomesAtribuidosObraColorido(){return 'Ana'}function _moradaCompletaObra(){return 'Lisboa'}function _botaoPontoObraHTML(){return ''}
 function _obraAutosMedicaoDisponiveis(o){return !!o?.temAutosMedicao&&moduloCrmAtivo()}function _avatarFuncHTML(){return ''}function obterNomeFuncionario(id){return id}
 function _renderizarAutosMedicao(id){document.getElementById('verObraConteudo').textContent='Autos '+id}function _renderizarDocumentosObra(){}function _fecharModalGenerico(){document.getElementById('modalGenericoOverlay').classList.remove('open')}
 function _verRelatorioEspecialidadeSnapshot(id){calls.push('report:'+id)}function abrirVerOS(id){calls.push('os:'+id)}function _voltarAoMenuAnterior(){_voltarMeuDia()}
 ${names.map(fn).join('\n')}
 window.resetUser=function(role){usuarioLogado={id:role==='admin'?'a':role==='encarregado'?'enc':role==='funcionario'?'e':role==='subadmin'?'sa':role,adminId:'a',role};ajustarVisibilidadeCards();_montarMenuInferiorMobile();construirSidebar();window.TGNavigation?.refresh();};
 `});
 await page.addScriptTag({url:'https://nav.test/tg-nexus.js'});
 const baseline=await page.evaluate(()=>{
  window.menuSnapshot=()=>({mobile:_ehPerfilMobile(),sidebar:_layoutUsaSidebarShell(),
    groups:[...document.querySelectorAll('#cardsGrid .grupo-cards')].map(g=>[g.dataset.grupo,g.querySelector('h3')?.textContent.trim(),[...g.querySelectorAll('.card-principal')].map(c=>[c.dataset.card,c.querySelector('h3')?.textContent,c.getAttribute('onclick'),c.classList.contains('hidden-card')])]),
    bottom:document.getElementById('menuInferiorMobile').style.display==='none'?[]:[...document.querySelectorAll('#menuInferiorMobile .menu-inf-item')].map(el=>[el.id,el.textContent.trim()])});
  const result={};for(const role of ['admin','subadmin','encarregado','funcionario','vendedor','vigilante','superadmin','cliente'])for(const option of ['cards','sidebar','foco','aurora']){layout=option;resetUser(role);result[role+':'+option]=menuSnapshot();}
  window.savedClientCard=document.querySelector('[data-card="clientes"]');return result;
 });
 await page.addScriptTag({url:'https://nav.test/tg-navigation.js'});
 const originalCount=await page.locator('#cardsGrid .card-principal[data-card]').count();
 for(const role of ['admin','subadmin','encarregado','funcionario','vendedor','vigilante','superadmin','cliente'])for(const option of ['cards','sidebar','foco','aurora']){
  await page.evaluate(({role,option})=>{layout=option;resetUser(role)}, {role,option});
  assert.deepEqual(await page.evaluate(()=>menuSnapshot()),baseline[role+':'+option],role+' '+option+' keeps the original phone navigation');
  assert.equal(await page.locator('#menuInferiorMobile [data-tgn-nav]').count(),0);
  assert.equal(await page.locator('#tgnHeaderSettings').isVisible(),false);
 }
 await page.evaluate(()=>{layout='cards';resetUser('admin')});
 await page.locator('#menuInf_comercial').click();
 await page.locator('#painelGrupoMobileConteudo a[href="TOTALGEST_CRM.html"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'crm');
 await page.locator('#menuInf_gestao').click();await page.locator('#painelGrupoMobileConteudo').getByText('Agenda de Obras',{exact:true}).click();
 assert.equal(await page.evaluate(()=>calls.at(-1)),'agenda-obras');assert.equal(await page.locator('.tgn-calendar-tabs').count(),0);
 await page.locator('#menuInfHome').click();await page.screenshot({path:'/tmp/testetg-navigation-mobile-original.png',fullPage:true,animations:'disabled'});
 await page.evaluate(()=>resetUser('funcionario'));
 let scope=await page.evaluate(()=>{const c=TGNavigation.workContext('w');return {os:c.os.map(x=>x.id),reports:c.reports.map(x=>x.id),foreign:TGNavigation.workContext('foreign')};});
 assert.deepEqual(scope,{os:['mine'],reports:['r'],foreign:null});
 await page.evaluate(()=>resetUser('encarregado'));
 assert.deepEqual(await page.evaluate(()=>TGNavigation.workContext('w').os.map(x=>x.id)),['team-os']);
 await page.evaluate(()=>resetUser('admin'));
 await page.evaluate(()=>abrirObraLongaDetalhe('w'));
 assert.match(await page.locator('#verObraConteudo').innerText(),/Resumo da obra/);
 const tabs=await page.locator('.tgn-work-tabs button').allTextContents();assert(tabs.some(s=>s.trim()==='Resumo'));assert(tabs.some(s=>s.trim()==='OS'));assert(tabs.some(s=>s.trim()==='Relatórios'));assert(tabs.some(s=>s.includes('Medição')));
 await page.locator('[data-tgn-work-tab="os"]').click();assert.equal(await page.locator('[data-tgn-work-os]').count(),3);assert(!await page.locator('#verObraConteudo').innerText().then(s=>s.includes('Outra empresa')));
 await page.locator('[data-tgn-work-tab="relatorios"]').click();assert.equal(await page.locator('[data-tgn-work-tab="relatorios"]').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');assert.equal(await page.locator('[data-tgn-work-report]').count(),2);
 await page.locator('[data-tgn-work-report="r"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'report:r');
 await page.screenshot({path:'/tmp/testetg-work-tabs-mobile.png',fullPage:true,animations:'disabled'});await page.evaluate(()=>_fecharModalGenerico());
 await page.setViewportSize({width:1440,height:1000});
 for(const option of ['cards','sidebar','foco','aurora']){
  await page.evaluate(option=>{layout=option;resetUser('admin')},option);
  assert.equal(await page.locator('#menuInferiorMobile').isVisible(),false,option);
  assert.equal(await page.locator('[data-grupo="gestao"]').count(),0);
  for(const [id,group] of [['assistencias','operacoes'],['folhas','operacoes'],['frota','equipa'],['requisicoes','armazem'],['relatorios-personalizados','configuracoes']])assert.equal(await page.locator('#cardsGrid [data-card="'+id+'"]').evaluate(el=>el.closest('.grupo-cards').dataset.grupo),group);
  assert.equal(await page.locator('#cardsGrid .card-principal[data-card]').count(),originalCount);
  for(let i=0;i<3;i++)await page.evaluate(()=>TGNavigation.refresh());
  assert.equal(await page.locator('#tgSidebarNav [data-tgn-settings]').count(),1,option);
 }
 await page.evaluate(()=>{TGNexus.refresh();TGNexus.open()});assert.equal(await page.locator('#nexusResults [data-nx-open="agenda"],#nexusResults [data-nx-open="calendario-equipa"]').count(),0);assert.equal(await page.locator('#nexusResults [data-nx-open="agenda-obras"]').count(),1);await page.evaluate(()=>TGNexus.close());
 await page.locator('#tgnHeaderSettings').click();assert(await page.locator('#tgnSettings').isVisible());await page.screenshot({path:'/tmp/testetg-settings-desktop.png',fullPage:true,animations:'disabled'});await page.locator('[data-tgn-close]').click();
 await page.evaluate(()=>TGNavigation.agenda());assert.equal(await page.locator('#secao-agenda-obras .tgn-calendar-tabs button').count(),3);
 await page.locator('#secao-agenda-obras [data-tgn-calendar="agenda"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'agenda');
 await page.evaluate(()=>{moduleFlags.Crm=false;resetUser('admin')});assert.equal(await page.evaluate(()=>TGNavigation.entries('comercial').some(el=>el.dataset.card==='crm')),false);
 // Desktop operational profiles retain the reorganized navigation, including its five shortcuts.
 await page.evaluate(()=>resetUser('funcionario'));assert.equal(await page.locator('#menuInferiorMobile [data-tgn-nav]').count(),5);
 await page.locator('[data-tgn-nav="alerts"]').click();assert(await page.locator('#secao-tgn-alertas').isVisible());const alertCalls=await page.evaluate(()=>calls.length);await page.evaluate(()=>TGNavigation.refresh());assert.equal(await page.evaluate(()=>calls.length),alertCalls);
 await page.locator('[data-tgn-nav="more"]').click();assert(await page.locator('.tgn-more-title').isVisible());
 // Repeated breakpoint changes restore the same source nodes, actions and drafts.
 await page.evaluate(()=>{moduleFlags.Crm=true;resetUser('admin');abrirSecao('servicos');const input=document.createElement('input');input.id='draft';input.value='Rascunho preservado';document.getElementById('secao-servicos').append(input);});
 for(const width of [390,1440,768,1440,390,1440]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(180);
  assert.equal(await page.locator('#cardsGrid .card-principal[data-card]').count(),originalCount);
  assert.equal(await page.evaluate(()=>savedClientCard===document.querySelector('[data-card="clientes"]')),true);
  assert.equal(await page.locator('#draft').inputValue(),'Rascunho preservado');
  assert.equal(await page.locator('[data-grupo="gestao"]').count(),width<=900?1:0);
 }
 await page.evaluate(()=>{licensed=false;resetUser('funcionario')});assert(await page.locator('[data-tgn-nav="agenda"]').isDisabled());assert.equal(await page.evaluate(()=>TGNavigation.openCard('servicos')),false);
 await page.evaluate(()=>{licensed=true;resetUser('superadmin')});assert.equal(await page.locator('#cardsGrid [data-card="reports"]').evaluate(el=>el.classList.contains('hidden-card')),false);assert.equal(await page.locator('#cardsGrid [data-card="reports"] h3').innerText(),'Visão Global');
 await page.evaluate(()=>resetUser('cliente'));assert.equal(await page.locator('#menuInferiorMobile').isVisible(),false);assert.equal(await page.locator('#tgnHeaderSettings').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: original phone navigation matches the unmodified app for eight roles and four layouts; desktop grouping, search, calendars and scoped work tabs retained; breakpoint changes preserve nodes, actions and drafts.');
 await context.close();
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
