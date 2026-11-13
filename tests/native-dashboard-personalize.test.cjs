const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('tg-dashboard-native-personalize-test.js','utf8');
const markup=()=>'<div class="hdc-frame"><h3 class="hdc-titulo">Dashboard Central</h3>'+
 '<div class="hdc-card hdc-kpis"><div class="hdc-kpi" onclick="doKpi1()"><span class="lbl">Faturação</span><span class="val">99</span></div><div class="hdc-kpi" onclick="doKpi2()"><span class="lbl">Ordens de Serviço</span></div><div class="hdc-kpi"><span class="lbl">OS Atrasadas</span></div></div>'+
 '<div class="hdc-row4"><div class="hdc-card"><h4>Faturação e Resultados</h4></div><div class="hdc-card"><h4>Ordens de Serviço</h4></div><div class="hdc-card"><h4>Atividade em Tempo Real</h4></div></div>'+
 '<div class="hdc-row3"><div class="hdc-card"><h4>Assistências</h4></div><div class="hdc-card"><h4>Equipa Agora</h4><div id="hdcMapaEquipa">Mapa original</div></div><div class="hdc-card"><h4>Próximas Manutenções</h4></div></div>'+
 '<div class="hdc-row4b"><div id="hdcSatisfacao" class="hdc-card"><h4>Satisfação</h4></div><div class="hdc-card"><h4>Top Clientes</h4></div><div class="hdc-card hdc-acoes"><h4>Ações rápidas</h4></div></div></div>';
function create(role='admin',id='admin1',tenant='admin1'){
 const window=new JSDOM('<!doctype html><html><body><section id="secao-dashboard-central"><div class="section-header"><h2>Dashboard Central</h2></div><div id="dashboardCentralConteudo">'+markup()+'</div></section></body></html>',
 {url:'https://testetg.example/login.html',runScripts:'outside-only',pretendToBeVisual:true}).window;
 window.usuarioLogado={id,role,adminId:tenant};
 window.eval(source);window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
 return {w:window,api:window.TGNativeDashboardPersonalizer,done:()=>window.close()};
}
test('mantém HTML, gráficos, mapa e eventos nativos originais',()=>{
 const t=create();try{
  const before=t.w.document.querySelector('.hdc-kpi').getAttribute('onclick');
  assert.equal(before,'doKpi1()');
  assert.equal(t.w.document.querySelector('#hdcMapaEquipa').textContent,'Mapa original');
  assert.equal(t.w.document.querySelector('.hdc-frame .hdc-titulo').textContent,'Dashboard Central');
  assert.equal(t.w.document.querySelector('#tgdCustomRoot'),null);
  assert(t.w.document.querySelector('[data-native-toggle]'));
 }finally{t.done()}
});
test('permite ocultar individualmente sem apagar dados',()=>{
 const t=create();try{
  t.w.document.querySelector('[data-native-toggle]').click();
  const checkbox=t.w.document.querySelector('[data-native-visibility="operation-0"]');
  assert(checkbox?.checked);
  checkbox.click();
  assert.equal(t.w.document.querySelector('[data-native-key="operation-0"]'),null);
  const original=t.w.document.querySelector('.hdc-row3 .hdc-card');
  assert.equal(original.dataset.nativeHidden,'1');
  assert.match(original.textContent,/Assistências/);
  assert.equal(t.w.document.querySelector('#hdcMapaEquipa').textContent,'Mapa original');
 }finally{t.done()}
});
test('permite reorganizar cartões mantendo identidade dos elementos e onclick',()=>{
 const t=create();try{
  t.w.document.querySelector('[data-native-toggle]').click();
  const element=t.w.document.querySelector('.hdc-kpi');
  t.w.document.querySelector('[data-native-item="kpi-0"] [data-item-move="1"]').click();
  const order=[...t.w.document.querySelectorAll('.hdc-kpis>.hdc-kpi')].map(el=>el.dataset.nativeKey);
  assert.deepEqual(order,['kpi-1','kpi-0','kpi-2']);
  assert.strictEqual(t.w.document.querySelector('.hdc-kpis>.hdc-kpi:nth-child(2)'),element);
  assert.equal(element.getAttribute('onclick'),'doKpi1()');
  t.api.apply();
  const orderAgain=[...t.w.document.querySelectorAll('.hdc-kpis>.hdc-kpi')].map(el=>el.dataset.nativeKey);
  assert.deepEqual(orderAgain,order);
 }finally{t.done()}
});
test('permitir reordenar secções inteiras e repor disposição original',()=>{
 const t=create();try{
  t.w.document.querySelector('[data-native-toggle]').click();
  t.w.document.querySelector('[data-native-group="operacao"] [data-group-move="-1"]').click();
  let rows=[...t.w.document.querySelector('.hdc-frame').children].filter(e=>/hdc-row/.test(e.className)).map(el=>el.className);
  assert.deepEqual(rows,['hdc-row3','hdc-row4','hdc-row4b']);
  t.w.document.querySelector('[data-native-reset]').click();
  rows=[...t.w.document.querySelector('.hdc-frame').children].filter(e=>/hdc-row/.test(e.className)).map(el=>el.className);
  assert.deepEqual(rows,['hdc-row4','hdc-row3','hdc-row4b']);
 }finally{t.done()}
});
test('preferências ficam separadas por Admin e Subadmin da mesma empresa',()=>{
 const t=create();try{
  const adminKey=t.api.prefKey({tenant:'admin1',id:'admin1'});
  t.w.document.querySelector('[data-native-toggle]').click();
  t.w.document.querySelector('[data-native-visibility="kpi-0"]').click();
  assert(JSON.parse(t.w.localStorage.getItem(adminKey)).hidden.includes('kpi-0'));
  t.w.usuarioLogado={id:'sub1',adminId:'admin1',role:'subadmin'};
  t.api.load({tenant:'admin1',id:'sub1'});t.api.apply();
  assert.equal(t.w.document.querySelector('.hdc-kpi').dataset.nativeHidden,'0');
  assert.notEqual(adminKey,t.api.prefKey({tenant:'admin1',id:'sub1'}));
 }finally{t.done()}
});
test('mesmo layout volta a aplicar após renderização do Dashboard nativo',async()=>{
 const t=create();try{
  t.w.document.querySelector('[data-native-toggle]').click();
  t.w.document.querySelector('[data-native-visibility="kpi-2"]').click();
  const content=t.w.document.getElementById('dashboardCentralConteudo');
  content.innerHTML=markup();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(content.querySelectorAll('.hdc-kpi').length,3);
  assert.equal([...content.querySelectorAll('.hdc-kpi')][2].dataset.nativeHidden,'1');
  assert(content.querySelector('#hdcMapaEquipa'));
 }finally{t.done()}
});
test('funcionário não recebe controlos do Dashboard Admin',()=>{
 const t=create('funcionario','f1','admin1');try{
  assert.equal(t.w.document.querySelector('#tgNativeDashControls'),null);
  assert.equal(t.w.document.querySelector('[data-native-hidden]'),null);
 }finally{t.done()}
});
test('TesteTG deixa de carregar dashboard experimental e não altera Produção',()=>{
 for(const path of ['index.html','login.html','sw.js']){
  const s=fs.readFileSync(path,'utf8');
  assert(s.includes('tg-dashboard-native-personalize-test.js?v=1.0.0'),path);
  assert(s.includes('tg-dashboard-native-personalize-test.css?v=1.0.0'),path);
  assert(!s.includes('tg-dashboard-custom-test.js?v=2.0.0-clean-presets'),path);
  assert(!s.includes('tg-dashboard-map-test.js?v=1.0.0'),path);
 }
 assert(fs.readFileSync('sw.js','utf8').includes('testetg-native-dashboard-personalize-20261113'));
});
