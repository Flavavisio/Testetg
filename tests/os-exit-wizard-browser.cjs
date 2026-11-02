const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const main=fs.readFileSync('app-principal.js','utf8'),doc=new JSDOM(fs.readFileSync('login.html','utf8')).window.document;
const fn=name=>{const m=main.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'));assert(m,name);return m[0];};
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="tg-navigation.css"><link rel="stylesheet" href="tg-technician.css"><link rel="stylesheet" href="responsive-device.css"><link rel="stylesheet" href="tg-form-focus.css"><script src="tg-form-focus.js"></script></head><body>
${doc.querySelector('header.header').outerHTML}<aside id="tgSidebar"><nav id="tgSidebarNav"></nav></aside>
${doc.querySelector('#cardsGrid').outerHTML}<div id="tgHome"><div id="homeAgendaWrap"></div></div><nav id="menuInferiorMobile"></nav>
${['servicos','ponto','folhas','agenda-obras'].map(id=>`<section class="section-container" id="secao-${id}"><div class="section-header"><h2>${id}</h2></div></section>`).join('')}
${doc.querySelector('#secao-pedidos').outerHTML}${doc.querySelector('#modalPedidoOverlay').outerHTML}${doc.querySelector('#modalOverlay').outerHTML}${doc.querySelector('#modalGenericoOverlay').outerHTML}</body></html>`;
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
 var _ultimoUserSidebar=null,_contextoAtual='__inicio',_ultimoGrupoMobileAberto=null,entidadeAtual='',_foMatExtra=[],_folhaOSPendente=null,_folhaObraPendente=null,_foHorasCorrigidasManualmente=false,idEditando=null,_assinaturaCtx=null,_assinaturaDesenhou=false,_assinaturaPermitida=false,pedidoTipo='ferias',_pedidoEditandoId=null;
 function obterLayout(){return layout}function _layoutUsaSidebarShell(){return ['sidebar','aurora','foco'].includes(layout)}function _licencaValidaTenant(){return licensed}function adminAtual(){return dados.administradores[0]}function adminDoUtilizador(){return adminAtual()}function expressAtivo(){return isExpress}function _podeAtivarQuiosque(){return false}function _utilizadorTemVeiculo(){return false}
 ${['Armazem','Crm','Assist','Erp','Rondas','Frota','Contratos'].map(key=>`function modulo${key}Ativo(){return moduleFlags.${key}!==false}`).join('\n')}
 function pontoAssiduidadeAtivo(){return true}function _tenantId(){return usuarioLogado.adminId||usuarioLogado.id}function getDataHoje(){return '2026-10-25'}function escapeHtmlSimples(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function obterNomeCliente(id){return dados.clientes.find(c=>c.id===id)?.nome||''}
 function obterNomeFuncionario(id){return dados.funcionarios.find(f=>f.id===id)?.nome||dados.encarregados.find(f=>f.id===id)?.nome||id}function feriasDetalheDisponiveis(){return {total:12,transitadosRestantes:2}}function verificarOSnoPeriodo(){}
 function construirSidebar(){}function _mostrarInicioConteudo(){document.body.classList.toggle('com-sidebar',_layoutUsaSidebarShell());document.getElementById('tgHome').style.display=_layoutUsaSidebarShell()?'block':'none'}function renderizarOMeuDia(){document.getElementById('omeudia').innerHTML='<div class="native-home">O Meu Dia original</div>'}function _voltarAoMenuAnterior(){_voltarMeuDia()}
 function abrirSecao(id){calls.push('section:'+id);document.querySelectorAll('.section-container.active').forEach(el=>el.classList.remove('active'));document.getElementById('secao-'+id)?.classList.add('active');document.getElementById('omeudia').style.display='none';document.getElementById('painelGrupoMobile').style.display='none'}
 function mostrarErro(text){calls.push('error:'+text)}function _fecharModalGenerico(){document.getElementById('modalGenericoOverlay').classList.remove('open')}function picarPonto(){calls.push('general-clock')}function picarPontoOS(id,type){calls.push('os:'+id+':'+type)}function obraLongaPicarEntrada(id){calls.push('obra:'+id+':entrada')}function obraLongaPicarSaida(id){calls.push('obra:'+id+':saida')}function abrirVerOS(id){calls.push('details:'+id)}function _verOsMostrar(id,tab){calls.push('tab:'+id+':'+tab)}function abrirObraLongaDetalhe(id,tab){calls.push('work:'+id+':'+tab)}function abrirEditarPerfil(){calls.push('profile')}
 function _osMapaInfo(){return {url:'https://maps.google.com/?q=Lisboa'}}function _registarKmViagemOS(id){calls.push('travel:'+id)}function _quemEsteveNaOSHTML(){return ''}function _quemEsteveNaObraHTML(){return ''}function _especialidadesEfetuadasTexto(){return ''}function _horasPicadasOS(){return 1.5}function _horasPicadasObra(){return 2}function _horasBloqueadasHTML(prefix,value){return '<input id="'+prefix+'_horas" type="number" value="'+value+'" readonly>'}function _consumoFolhaArtigo(){return 0}
 function salvarFormulario(event){event.preventDefault();saved.push({job:document.getElementById('fo_servico_id').value,work:document.getElementById('fo_obra').value,description:document.getElementById('fo_descricao').value,materials:document.getElementById('fo_materiais').value,hours:document.getElementById('fo_horas').value});}
 function fecharModal(){document.getElementById('modalOverlay').classList.remove('open')}function _wsTentarVoltar(){}
 ${['ajustarVisibilidadeCards','_dispositivoEhMobile','_ehPerfilMobile','_montarMenuInferiorMobile','_fecharSecaoAbertaMobile','_abrirGrupoMobile','_voltarMeuDia','criarFolhaDaOS','criarFolhaDaObra','_foEscolherMateriais','renderPlanoConsumoFolha','inicializarAssinatura','_assinaturaAjustarTamanho','ativarAssinatura','_estadoPresencaPessoa','_obraLongaPontoAberto','_obraLongaPontoAbertoQualquer','renderizarPedidosFunc','_pedidoPodeEditar','statusBadge','abrirModalPedido','fecharModalPedido','_pedAlternarDiaInteiro'].map(fn).join('\n')}
 function resetUser(role){usuarioLogado={id:role==='funcionario'?'e':role==='encarregado'?'enc':role==='admin'?'a':role,adminId:role==='admin'?undefined:'a',role,nome:'João Silva'};document.getElementById('btnLogin').style.display='none';document.getElementById('userDisplay').textContent='João';ajustarVisibilidadeCards();_montarMenuInferiorMobile();window.TGNavigation?.refresh();window.TGTechnician?.refresh();}
 `});
 await page.addScriptTag({url:'https://technician.test/tg-navigation.js'});
 await page.addScriptTag({url:'https://technician.test/tg-supervisor-home.js'});
 await page.addScriptTag({url:'https://technician.test/tg-technician.js'});
 await page.evaluate(()=>resetUser('funcionario'));

 for(const zoom of [1,.9,.8]){
  await page.evaluate(zoom=>{document.querySelector('#modalOverlay .modal').style.zoom=zoom;criarFolhaDaOS('mine');},zoom);
  await page.locator('.tgt-wizard').waitFor();
  await page.locator('#fo_descricao').fill('Intervenção concluída');
  await page.locator('[data-tgt-action="wizard-next"]').click();
  await page.locator('#fo_mat_sim').click();
  await page.locator('#fo_materiais').fill('Material usado');
  await page.locator('.fo-consumo').fill('2');
  await page.locator('[data-tgt-action="wizard-next"]').click();
  // Simulate a small new field added to review; delegated sizing covers late controls.
  await page.evaluate(()=>{const field=document.createElement('input');field.id='review-field';field.placeholder='Observações';field.style.fontSize='12px';document.querySelector('[data-tgt-page="2"]').append(field);});
  for(const [step,ids] of [[0,['fo_descricao']],[1,['fo_materiais','.fo-consumo']],[2,['review-field']]]){
   await page.locator('[data-tgt-step="'+step+'"]').click();
   for(const id of ids){const field=page.locator(id.startsWith('.')?id:'#'+id);await field.dispatchEvent('pointerdown');const size=await field.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert(size*zoom>=16,id+' at zoom '+zoom+' too small: '+size);}
  }
  assert.equal(await page.locator('#fo_descricao').inputValue(),'Intervenção concluída');
  assert.equal(await page.locator('#fo_materiais').inputValue(),'Material usado');
  assert.equal(await page.evaluate(()=>visualViewport.scale),1);
  await page.evaluate(()=>fecharModal());
 }
 await page.evaluate(()=>{dados.servicos[0].data='2026-10-24';dados.servicos[0].status='concluído';dados.relatoriosEspecialidade.push({id:'draft',adminId:'a',servicoId:'mine',tecnicoId:'e',tipo:'RIN',rascunho:true});TGTechnician.refresh();});
 assert.equal(await page.locator('.tgt-draft-card').count(),1,'draft from previous day remains reachable');
 await page.locator('.tgt-draft-card').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'tab:mine:relatorios');
 assert.deepEqual(errors,[]);console.log('PASS: actual three-step technician wizard at 100/90/80% keeps >=16px displayed text, dynamic review fields, preserved entries, and previous-day completed OS draft reopening.');
 await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
