// Isolated UI regression: synthetic records, no credentials or backend requests.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require(require.resolve('playwright', {paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()]}));
(async () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root,'app-principal.js'),'utf8');
  const pick = name => {
    const r = new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}');
    const m = source.match(r); assert(m, name); return m[0];
  };
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1365,height:900}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.route('**/*', r=>r.abort());
  let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
  await page.setContent(html);
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'styles.css'),'utf8')});
  await page.addScriptTag({content:`
    var usuarioLogado={id:'admin-a',role:'admin'}, _contextoAtual='__inicio';
    var dados={clientes:[{id:'c1',nome:'Cliente Demonstração',nif:'123456789'},{id:'c2',nome:'Outro cliente'}],locais:[],contratos:[],servicos:[],obras:[],obraDocumentos:[],relatoriosEspecialidade:[
      {id:'r1',clienteId:'c1',tipo:'REX',numeroDocumento:'REX-001',data:'2026-09-28'},
      {id:'r2',clienteId:'c1',tipo:'CUSTOM_TEST',numeroDocumento:'CUSTOM-001',data:'2026-09-28'},
      {id:'secret',clienteId:'c2',tipo:'REX',numeroDocumento:'OTHER-CLIENT',data:'2026-09-28'}],tiposTrabalhoCustom:[]};
    var flags={contratos:true,assist:true,obras:true};
    function adminAtual(){return {id:'admin-a',numeroRegistoPrevio:'RP-DEMO'}}
    function adminDoUtilizador(){return adminAtual()}
    function moduloContratosAtivo(){return flags.contratos}
    function moduloAssistAtivo(){return flags.assist}
    function moduloArmazemAtivo(){return flags.obras}
    function escapeHtmlSimples(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
    function _ehPerfilMobile(){return innerWidth<=900}
    function _fecharSidebarMobile(){}
    function _atualizarBreadcrumb(){}
    function _marcarNavAtivo(s){_tgMarcarMenuSimples(s)}
    function _voltarMeuDia(){document.querySelectorAll('.section-container').forEach(e=>e.classList.remove('active'));document.getElementById('omeudia').style.display='block'}
    function irParaInicio(){_wsClienteFechar()}
    function _wsResumoHtml(id){return Promise.resolve('<p>Resumo '+id+'</p>')}
    function _wsOsHtml(id){return Promise.resolve('<p>Serviços '+id+'</p>')}
    function _wsAssistenciasHtml(){return '<p>Assistências</p>'}
    function _wsLocaisHtml(){return '<p>Locais</p>'}
    function _wsContratosHtml(){return '<p>Contratos</p>'}
    function _wsObrasHtml(){return '<p>Obras</p>'}
    function _wsEquipamentosHtml(){return '<p>Equipamentos</p>'}
    function _wsFinanceiroHtml(){return Promise.resolve('<p>Financeiro</p>')}
    var overlayRequestSequence=0;
    ${source.match(/        const WS_CLIENTE_ABAS =[^\n]+/)[0]}
    ${source.match(/        const WS_CLIENTE_ABAS_LABEL =[^\n]+/)[0]}
    ${['abrirWorkspaceCliente','_wsClienteFechar','_wsSairPara','_wsTentarVoltar','_wsClienteAba'].map(pick).join('\n')}
  `});
  await page.addScriptTag({path:path.join(root,'navegacao-clientes.js')});
  await page.evaluate(()=>{
    document.body.classList.add('com-sidebar');
    document.getElementById('tg-landing').style.display='none';
    document.getElementById('tgSidebarNav').innerHTML=_tgMenuSimplesHTML(false);
  });
  assert.deepEqual(await page.locator('#tgSidebarNav button span').allTextContents(), ['Hoje','Clientes','Serviços','Agenda','Equipa','Mais']);
  await page.evaluate(()=>_tgAbrirArea('equipa'));
  assert.equal(await page.locator('#secao-navegacao-simples .tg-area-card').count(),6);
  // Original action (including its own gate) is invoked; it is not reimplemented.
  await page.evaluate(()=>{_tgCard('ponto').onclick=()=>{window.originalClicked=true};_tgAbrirOriginal('ponto')});
  assert.equal(await page.evaluate(()=>window.originalClicked),true);
  await page.evaluate(()=>{_tgCard('ponto').classList.add('hidden-card');window.originalClicked=false;_tgAbrirOriginal('ponto')});
  assert.equal(await page.evaluate(()=>window.originalClicked),false);
  await page.evaluate(()=>abrirWorkspaceCliente('c1'));
  await page.evaluate(()=>_wsClienteAba('c1','documentos'));
  assert.equal(await page.locator('#wsClienteAbas button').count(),7);
  assert.match(await page.locator('#wsClienteConteudo').innerText(),/REX-001/);
  assert.doesNotMatch(await page.locator('#wsClienteConteudo').innerText(),/OTHER-CLIENT|CUSTOM-001/);
  await page.evaluate(()=>_wsClienteAba('c1','personalizados'));
  assert.match(await page.locator('#wsClienteConteudo').innerText(),/CUSTOM-001/);
  // Rapid navigation: a slow OS response must not replace Documents.
  await page.evaluate(()=>{window.savedOS=_wsOsHtml;_wsOsHtml=()=>new Promise(r=>window.finishSlow=r);_wsClienteAba('c1','os')});
  await page.evaluate(()=>_wsClienteAba('c1','documentos'));
  await page.evaluate(()=>window.finishSlow('<p>STALE CONTENT</p>'));
  assert.doesNotMatch(await page.locator('#wsClienteConteudo').innerText(),/STALE CONTENT/);
  await page.evaluate(()=>{_wsOsHtml=window.savedOS;flags.assist=false;flags.contratos=false;flags.obras=false;return _wsClienteAba('c1','assistencias')});
  assert.match(await page.locator('#wsClienteConteudo').innerText(),/Resumo/);
  assert.doesNotMatch(await page.locator('#wsClienteAbas').innerText(),/Obras|Contratos/);
  // Modal return preserves the same subtab, and explicit navigation cancels it.
  await page.evaluate(()=>{flags.assist=true;flags.contratos=true;flags.obras=true;return _wsClienteAba('c1','personalizados')});
  await page.evaluate(()=>{_wsSairPara('c1');_wsTentarVoltar()});
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>window._wsAbaAtual),'personalizados');
  assert.equal(await page.locator('#wsClienteOverlay').evaluate(e=>e.classList.contains('open')),true);
  await page.screenshot({path:'/tmp/testetg-client-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>_wsClienteAba('c1','documentos'));
  const bounds=await page.locator('#wsClienteOverlay .modal').boundingBox();
  assert(bounds.width <= 390 && bounds.x >= 0);
  assert.equal(await page.locator('#wsClienteConteudo').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await page.screenshot({path:'/tmp/testetg-client-mobile.png'});
  await page.evaluate(()=>{_tgAbrirArea('agenda');_tgHoje()});
  assert.equal(await page.locator('#cardsGrid').evaluate(e=>e.style.display),'block');
  assert.equal(await page.locator('#wsClienteOverlay').evaluate(e=>e.classList.contains('open')),false);
  assert.deepEqual(errors,[]);
  await browser.close();
  console.log('PASS: navigation, original gates, client isolation, reports, module visibility, stale requests, return, desktop/mobile layout.');
})().catch(e=>{console.error(e);process.exit(1)});
