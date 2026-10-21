const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const src=fs.readFileSync('app-principal.js','utf8');
const helpers=src.slice(src.indexOf('        function _acaoPendenciasAlerta('),src.indexOf('        // ==================== ARMAZÉM / STOCK',src.indexOf('        function _acaoPendenciasAlerta(')));
const browserTest=fs.readFileSync('tests/alert-destinations-browser.cjs','utf8');
const fixture=browserTest.split('await page.addScriptTag({content:`')[1].split('`+helpers')[0];
function setup(){const dom=new JSDOM('<div id="alertasPendencias"></div>',{runScripts:'dangerously'});dom.window.eval(fixture+helpers);return dom.window;}
const json=x=>JSON.parse(JSON.stringify(x));
test('clicking a grouped pending alert includes exactly those OS and opens the chosen OS',()=>{
 const w=setup();w.renderizarAlertas();w.document.querySelector('.alerta-linha').click();
 const buttons=w.document.querySelectorAll('#tgPendenciasOverlay button');assert.equal(buttons.length,3);
 assert.match(buttons[1].textContent,/OS um/);assert.match(buttons[2].textContent,/OS dois/);
 buttons[2].click();assert.deepEqual(json(w.calls),[['os','two']]);assert(!w.document.getElementById('tgPendenciasOverlay'));w.close();
});
test('a single OS opens directly and old/missing/foreign IDs never open another record',()=>{
 const w=setup();w._abrirPendenciasAlerta('servico',['one']);assert.deepEqual(json(w.calls),[['os','one']]);
 for(const user of [{role:'admin',id:'tenant'},{role:'subadmin',id:'sub',adminId:'tenant'},{role:'funcionario',id:'f',adminId:'tenant'}]){
  w.usuarioLogado=user;w.calls=[];w._abrirPendenciasAlerta('servico',['foreign','missing']);assert.equal(w.calls[0][0],'erro');
 }
 w.close();
});
test('opening a request is read-only and approval applies only to the selected request',()=>{
 const w=setup();w.dados.pedidos=[{id:'p',adminId:'tenant',tipo:'ferias',funcionarioId:'f',dataInicio:'2026-11-01',dataFim:'2026-11-02',status:'pendente_aprov'}];
 w._abrirPendenciasAlerta('pedido',['p']);assert.deepEqual(json(w.calls),[]);
 [...w.document.querySelectorAll('#tgPendenciasOverlay button')].find(b=>b.textContent==='Aprovar').click();
 assert.deepEqual(json(w.calls),[['aprovar','p']]);w.close();
});
test('portal assistance shows that request without creating an OS merely by opening it',()=>{
 const w=setup();w.dados.assistencias=[{id:'a',adminId:'tenant',assunto:'Alarme',descricao:'Verificar sensor'}];
 w._abrirPendenciasAlerta('assistencia',['a']);assert.deepEqual(json(w.calls),[]);
 assert.match(w.document.getElementById('tgPendenciasOverlay').textContent,/Verificar sensor/);w.close();
});
test('mobile accordion and keyboard activation lead to the same filtered group; Escape closes it',()=>{
 const w=setup();w.mobile=true;w.renderizarAlertas();w.document.querySelector('.alertas-h').click();
 assert(w.document.querySelector('.alertas-card').classList.contains('aberto'));
 w.document.querySelector('.alerta-linha').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 const overlay=w.document.getElementById('tgPendenciasOverlay');assert(overlay);
 overlay.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!w.document.getElementById('tgPendenciasOverlay'));w.close();
});
