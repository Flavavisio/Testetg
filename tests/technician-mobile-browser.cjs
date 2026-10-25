const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const main=fs.readFileSync('app-principal.js','utf8'),doc=new JSDOM(fs.readFileSync('index.html','utf8')).window.document;
const fn=name=>{const m=main.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'));assert(m,name);return m[0];};
for(const file of ['index.html','login.html']){
 const html=fs.readFileSync(file,'utf8'),sw=fs.readFileSync('sw.js','utf8');
 for(const resource of ['tg-technician.js?v=1.1.0-teste','tg-technician.css?v=1.1.0-teste']){assert(html.includes(resource));assert(sw.includes(resource));}
 assert(html.indexOf('tg-technician.js?v=')>html.indexOf('tg-navigation.js?v='));
}
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="tg-navigation.css"><link rel="stylesheet" href="tg-technician.css"></head><body>
<header class="header"><h1>Total Gest</h1><div id="headerExtras"></div></header><aside id="tgSidebar"><nav id="tgSidebarNav"></nav></aside>
${doc.querySelector('#cardsGrid').outerHTML}<div id="tgHome"><div id="homeAgendaWrap"></div></div><nav id="menuInferiorMobile"></nav>
${['servicos','ponto','folhas','agenda-obras'].map(id=>`<section class="section-container" id="secao-${id}"><div class="section-header"><h2>${id}</h2></div></section>`).join('')}
${doc.querySelector('#modalOverlay').outerHTML}${doc.querySelector('#modalGenericoOverlay').outerHTML}</body></html>`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BINARY,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>{const url=new URL(route.request().url());const path=url.pathname.slice(1);if(url.origin!=='https://technician.test')return route.fulfill({status:404,body:''});return route.fulfill({contentType:(path.endsWith('.css')?'text/css':path?'text/javascript':'text/html')+'; charset=utf-8',body:path?fs.readFileSync(path):fixture});});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('https://technician.test/');
 await page.addScriptTag({content:`
 var usuarioLogado={id:'e',role:'funcionario',adminId:'a',nome:'João Silva'},layout='cards',licensed=true,isExpress=false,moduleFlags={},calls=[],saved=[],serial=1;
 var EXPRESS_CARDS_PERMITIDOS=['servicos','folhas','clientes','ponto'],pendingLunch=null;
 function _pausaAlmocoPendente(){return pendingLunch}
 var dados={administradores:[{id:'a'}],funcionarios:[{id:'e',adminId:'a',nome:'João Silva'},{id:'team',adminId:'a',nome:'Ana'},{id:'outside',adminId:'a',nome:'Outra equipa'}],encarregados:[{id:'enc',adminId:'a',nome:'Responsável',funcionariosIds:['team']}],clientes:[{id:'c',adminId:'a',nome:'Edifício do Parque',morada:'Rua das Flores, 18',localidade:'Lisboa'},{id:'foreign-client',adminId:'b',nome:'Cliente de outra empresa'}],pedidosRenovacao:[],folhasObra:[],relatoriosEspecialidade:[],obraMateriais:[{id:'mat',adminId:'a',obraId:'w',artigoId:'filter',qtdPrevista:2,qtdConsumida:0}],artigos:[{id:'filter',adminId:'a',nome:'Filtro G4',unidade:'un'}],
 obras:[{id:'w',adminId:'a',nome:'Manutenção do edifício',clienteId:'c',responsaveisIds:['e'],estado:'ativa'},{id:'team-work',adminId:'a',nome:'Obra da equipa',responsaveisIds:['team'],estado:'ativa'},{id:'foreign',adminId:'b',nome:'Outra empresa',responsaveisIds:['e'],estado:'ativa'}],
 servicos:[{id:'mine',adminId:'a',clienteId:'c',obraId:'w',numeroRegisto:'2481',descricao:'Manutenção de climatização',funcionariosIds:['e'],data:'2026-10-25',hora:'10:00',status:'pendente',observacoes:'Entrada pela receção.'},{id:'later',adminId:'a',clienteId:'c',descricao:'Trabalho de amanhã',funcionarioId:'e',data:'2026-10-26',hora:'11:30',status:'pendente'},{id:'team-os',adminId:'a',descricao:'OS da equipa',funcionarioId:'team',data:'2026-10-25',status:'pendente'},{id:'foreign-os',adminId:'b',descricao:'OS de outra empresa',funcionarioId:'e',data:'2026-10-25',status:'pendente'}],ponto:[],obraPontoLonga:[]};
 var _ultimoUserSidebar=null,_contextoAtual='__inicio',_ultimoGrupoMobileAberto=null,entidadeAtual='',_foMatExtra=[],_folhaOSPendente=null,_folhaObraPendente=null,_foHorasCorrigidasManualmente=false,idEditando=null,_assinaturaCtx=null,_assinaturaDesenhou=false,_assinaturaPermitida=false;
 function obterLayout(){return layout}function _layoutUsaSidebarShell(){return ['sidebar','aurora','foco'].includes(layout)}function _licencaValidaTenant(){return licensed}function adminAtual(){return dados.administradores[0]}function adminDoUtilizador(){return adminAtual()}function expressAtivo(){return isExpress}function _podeAtivarQuiosque(){return false}function _utilizadorTemVeiculo(){return false}
 ${['Armazem','Crm','Assist','Erp','Rondas','Frota','Contratos'].map(key=>`function modulo${key}Ativo(){return moduleFlags.${key}!==false}`).join('\n')}
 function _tenantId(){return usuarioLogado.adminId||usuarioLogado.id}function getDataHoje(){return '2026-10-25'}function escapeHtmlSimples(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function obterNomeCliente(id){return dados.clientes.find(c=>c.id===id)?.nome||''}
 function construirSidebar(){}function _mostrarInicioConteudo(){document.body.classList.toggle('com-sidebar',_layoutUsaSidebarShell());document.getElementById('tgHome').style.display=_layoutUsaSidebarShell()?'block':'none'}function renderizarOMeuDia(){document.getElementById('omeudia').innerHTML='<div class="native-home">O Meu Dia original</div>'}function _voltarAoMenuAnterior(){_voltarMeuDia()}
 function abrirSecao(id){calls.push('section:'+id);document.querySelectorAll('.section-container.active').forEach(el=>el.classList.remove('active'));document.getElementById('secao-'+id)?.classList.add('active');document.getElementById('omeudia').style.display='none';document.getElementById('painelGrupoMobile').style.display='none'}
 function picarPonto(){calls.push('general-clock')}function picarPontoOS(id,type){calls.push('os:'+id+':'+type)}function obraLongaPicarEntrada(id){calls.push('obra:'+id+':entrada')}function obraLongaPicarSaida(id){calls.push('obra:'+id+':saida')}function abrirVerOS(id){calls.push('details:'+id)}function _verOsMostrar(id,tab){calls.push('tab:'+id+':'+tab)}function abrirObraLongaDetalhe(id,tab){calls.push('work:'+id+':'+tab)}function abrirEditarPerfil(){calls.push('profile')}
 function _osMapaInfo(){return {url:'https://maps.google.com/?q=Lisboa'}}function _registarKmViagemOS(id){calls.push('travel:'+id)}function _quemEsteveNaOSHTML(){return ''}function _quemEsteveNaObraHTML(){return ''}function _especialidadesEfetuadasTexto(){return ''}function _horasPicadasOS(){return 1.5}function _horasPicadasObra(){return 2}function _horasBloqueadasHTML(prefix,value){return '<input id="'+prefix+'_horas" type="number" value="'+value+'" readonly>'}function _consumoFolhaArtigo(){return 0}
 function salvarFormulario(event){event.preventDefault();saved.push({job:document.getElementById('fo_servico_id').value,work:document.getElementById('fo_obra').value,description:document.getElementById('fo_descricao').value,materials:document.getElementById('fo_materiais').value,hours:document.getElementById('fo_horas').value});}
 function fecharModal(){document.getElementById('modalOverlay').classList.remove('open')}function _wsTentarVoltar(){}
 ${['ajustarVisibilidadeCards','_dispositivoEhMobile','_ehPerfilMobile','_montarMenuInferiorMobile','_fecharSecaoAbertaMobile','_abrirGrupoMobile','_voltarMeuDia','criarFolhaDaOS','criarFolhaDaObra','_foEscolherMateriais','renderPlanoConsumoFolha','inicializarAssinatura','_assinaturaAjustarTamanho','ativarAssinatura','_estadoPresencaPessoa','_obraLongaPontoAberto','_obraLongaPontoAbertoQualquer'].map(fn).join('\n')}
 function resetUser(role){usuarioLogado={id:role==='funcionario'?'e':role==='encarregado'?'enc':role==='admin'?'a':role,adminId:role==='admin'?undefined:'a',role,nome:'João Silva'};ajustarVisibilidadeCards();_montarMenuInferiorMobile();window.TGNavigation?.refresh();window.TGTechnician?.refresh();}
 `});
 await page.addScriptTag({url:'https://technician.test/tg-navigation.js'});
 await page.addScriptTag({url:'https://technician.test/tg-supervisor-home.js'});
 await page.addScriptTag({url:'https://technician.test/tg-technician.js'});
 await page.evaluate(()=>resetUser('funcionario'));
 assert.deepEqual(await page.locator('#menuInferiorMobile [data-tgt-nav]').allTextContents(),['Hoje','Trabalhos','Registos','Mais']);
 assert.equal(await page.locator('.tgt-steps').count(),0,'Day design has no intervention timeline');
 await page.locator('[data-tgt-nav=records]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'section:folhas');await page.locator('[data-tgt-nav=home]').click();
 assert.deepEqual(await page.evaluate(()=>TGTechnician.jobs().map(j=>j.id).sort()),['later','mine','w']);
 assert(!await page.locator('.tgt-home').innerText().then(s=>s.includes('outra empresa')));
 assert.equal(await page.locator('.tgt-draft-card').count(),0,'No invented unfinished sheet or report');
 await page.evaluate(()=>{dados.relatoriosEspecialidade=[{id:'own-draft',adminId:'a',servicoId:'mine',tecnicoId:'e',tipo:'RCCTV',rascunho:true},{id:'foreign-draft',adminId:'b',servicoId:'mine',tecnicoId:'e',tipo:'FOREIGN',rascunho:true}];dados.folhasObra=[{id:'own-sheet',adminId:'a',funcionarioId:'e',validada:false},{id:'other-sheet',adminId:'a',funcionarioId:'team'}];renderizarOMeuDia()});
 assert.match(await page.locator('.tgt-draft-card').innerText(),/RCCTV em rascunho/);assert.equal(await page.locator('.tgt-draft-card').count(),1);
 assert.match(await page.locator('.tgt-record-card').innerText(),/1 registo teu/);
 await page.locator('.tgt-draft-card').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'tab:mine:relatorios');
 // A technician first clocks into the day; no optimistic job status is invented.
 await page.locator('.tgt-focus [data-tgt-action="start"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'general-clock');
 assert.equal(await page.evaluate(()=>dados.servicos[0].status),'pendente');
 await page.evaluate(()=>{pendingLunch={tipo:'os',servicoId:'mine'};renderizarOMeuDia()});
 await page.locator('.tgt-focus [data-tgt-action="start"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'os:mine:entrada','Lunch return uses native OS resume instead of a second general clock request');
 await page.evaluate(()=>{pendingLunch=null;renderizarOMeuDia()});
 await page.evaluate(()=>{dados.ponto.push({id:'g',adminId:'a',funcionarioId:'e',data:getDataHoje(),entrada:'09:00'});renderizarOMeuDia()});
 await page.locator('.tgt-focus [data-tgt-action="start"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'os:mine:entrada');
 await page.evaluate(()=>{dados.ponto.push({id:'session',adminId:'a',funcionarioId:'e',servicoId:'mine',data:getDataHoje(),entrada:'10:00'});renderizarOMeuDia()});
 await page.locator('.tgt-focus [data-tgt-action="photos"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'tab:mine:fotos');
 await page.locator('.tgt-focus [data-tgt-action="exit"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'os:mine:saida');
 await page.screenshot({path:'/tmp/testetg-technician-active.png',fullPage:true});
 // The wizard uses the real OS and work sheet constructors, original field nodes and save handler.
 await page.evaluate(()=>criarFolhaDaOS('mine'));await page.waitForTimeout(180);
 assert(await page.locator('.tgt-wizard').isVisible());assert(!await page.locator('#modalSubmitBtn').isVisible());
 await page.locator('[data-tgt-action="wizard-next"]').click();assert(await page.locator('[data-tgt-page="0"]').isVisible());assert.equal(await page.evaluate(()=>saved.length),0);
 await page.locator('#fo_descricao').fill('Filtros limpos e ensaio final realizado.');
 await page.evaluate(()=>{window.originalDescription=document.getElementById('fo_descricao');window.originalSignature=document.getElementById('fo_assinatura_canvas')});
 await page.locator('[data-tgt-action="wizard-next"]').click();
 await page.locator('[data-tgt-action="wizard-next"]').click();assert(await page.locator('.tgt-error').isVisible());
 await page.locator('#fo_mat_sim').click();await page.locator('.fo-consumo').fill('2');await page.locator('#fo_materiais').fill('Substituídos os filtros de entrada.');
 await page.locator('[data-tgt-action="wizard-next"]').click();
 assert.match(await page.locator('.tgt-review').innerText(),/Filtro G4: 2 un/);assert.match(await page.locator('.tgt-review').innerText(),/Filtros limpos/);
 await page.locator('#fo_btn_assinar').click();
 await page.locator('#fo_assinatura_canvas').evaluate(canvas=>{const c=canvas.getContext('2d');c.fillStyle='#123456';c.fillRect(10,10,10,10);window.signatureBefore=canvas.toDataURL()});
 await page.locator('[data-tgt-action="wizard-back"]').click();await page.locator('[data-tgt-action="wizard-back"]').click();
 assert.equal(await page.locator('#fo_descricao').inputValue(),'Filtros limpos e ensaio final realizado.');
 await page.evaluate(()=>{renderizarOMeuDia();document.dispatchEvent(new Event('tg:interface-updated'))});
 assert.equal(await page.evaluate(()=>document.getElementById('fo_descricao')===originalDescription),true);
 await page.locator('[data-tgt-step="2"]').click();
 assert.equal(await page.locator('.fo-consumo').inputValue(),'2');
 assert.equal(await page.evaluate(()=>document.getElementById('fo_assinatura_canvas').toDataURL()===signatureBefore),true);
 await page.screenshot({path:'/tmp/testetg-technician-review.png',fullPage:true});
 await page.locator('#modalSubmitBtn').click();assert.equal(await page.evaluate(()=>saved.length),1);
 assert.equal(await page.evaluate(()=>saved[0].job),'mine');
 // Opening a different sheet drops old wizard metadata and leaves the real work IDs intact.
 await page.evaluate(()=>criarFolhaDaObra('w',false));assert.equal(await page.locator('.tgt-wizard').count(),1);assert.equal(await page.locator('#fo_obra').inputValue(),'w');
 await page.locator('#fo_descricao').fill('Rascunho conservado ao rodar o telefone.');
 for(const width of [768,1440,390]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);
  assert.equal(await page.locator('#fo_descricao').inputValue(),'Rascunho conservado ao rodar o telefone.');
  assert.equal(await page.locator('.tgt-wizard').count(),width<=900?1:0);
 }
 await page.evaluate(()=>fecharModal());await page.waitForTimeout(20);
 await page.locator('[data-tgt-nav="jobs"]').click();assert.match(await page.locator('#painelGrupoMobileConteudo').innerText(),/Trabalho de amanhã/);
 const callsBefore=await page.evaluate(()=>calls.length);await page.evaluate(()=>{renderizarOMeuDia();document.dispatchEvent(new Event('tg:interface-updated'))});assert.equal(await page.evaluate(()=>calls.length),callsBefore);assert(!await page.locator('#omeudia').isVisible());
 await page.locator('[data-tgt-nav="more"]').click();await page.locator('[data-tgt-action="profile"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'profile');
 assert(await page.locator('[data-tgt-card="folhas"]').count());
 // Manager roles and all desktop menus retain their earlier navigation.
 for(const role of ['admin','subadmin','vendedor','vigilante','cliente']){await page.evaluate(role=>resetUser(role),role);assert.equal(await page.locator('[data-tgt-nav]').count(),0,role);assert.equal(await page.evaluate(()=>TGTechnician.enabled()),false);}
 await page.evaluate(()=>{layout='aurora';resetUser('encarregado')});assert.equal(await page.evaluate(()=>TGTechnician.enabled()),true);assert.equal(await page.evaluate(()=>_layoutUsaSidebarShell()),false);
 assert.deepEqual(await page.evaluate(()=>TGTechnician.jobs().map(j=>j.id)),[],'Personal actions never use assigned team members');
 await page.locator('.tgt-team>summary').click();assert.match(await page.locator('.tgt-team').innerText(),/Ana/);assert(!await page.locator('.tgt-team').innerText().then(s=>s.includes('Outra equipa')));
 await page.evaluate(()=>{layout='cards';resetUser('funcionario');licensed=false;ajustarVisibilidadeCards();TGTechnician.refresh()});assert.deepEqual(await page.evaluate(()=>TGTechnician.jobs()),[]);
 await page.evaluate(()=>{licensed=true;moduleFlags.Armazem=false;resetUser('funcionario')});assert(!await page.evaluate(()=>TGTechnician.jobs().some(j=>j.kind==='obra')));
 await page.evaluate(()=>{moduleFlags.Armazem=true;isExpress=true;resetUser('funcionario')});assert.equal(await page.locator('[data-tgt-nav]').count(),0,'Express keeps its existing no-clock workflow');
 await page.evaluate(()=>{isExpress=false;layout='cards';resetUser('funcionario');dados.ponto=dados.ponto.filter(p=>!p.servicoId);dados.obraPontoLonga=[{id:'old',adminId:'a',funcionarioId:'e',obraId:'w',data:'2026-10-24',entrada:'23:50'}];renderizarOMeuDia()});
 assert.match(await page.locator('.tgt-focus').innerText(),/23:50/);
 assert.equal(await page.evaluate(()=>_obraLongaPontoAberto('w')?.id),'old','Native exit lookup can reach the clock highlighted after midnight');
 // Responsive light/dark layouts and focus size in actual native sheet fields.
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);
  for(const dark of [false,true]){
   await page.evaluate(dark=>{document.body.classList.toggle('dark-mode',dark);TGTechnician.refresh()},dark);
   assert(await page.locator('.tgt-home').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'home overflow '+width);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.evaluate(()=>document.body.classList.remove('dark-mode'));await page.screenshot({path:'/tmp/testetg-technician-home.png',fullPage:true});
 await page.evaluate(()=>criarFolhaDaOS('mine'));assert.equal(await page.locator('#fo_descricao').evaluate(el=>getComputedStyle(el).fontSize),'16px');
 assert.deepEqual(errors,[]);console.log('PASS: native action routing; self/team/tenant/license scopes; real sheet constructors, step validation, materials, submit delegation; no lost input or signature on back/refresh/resize; management and Express fallbacks; 320/390/768px light/dark.');
 await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
