const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('tg-dashboard-custom-test.js','utf8');
function env(role='admin',id='a',tenant='a'){
 const dom=new JSDOM('<!doctype html><html><body><section id="secao-dashboard-central" class="section-container active"><div class="section-header"><h2>Dashboard Central</h2></div><div id="dashboardCentralConteudo">Antigo Dashboard</div></section><div id="cardsGrid"><div data-card="financeiro"></div><div data-card="servicos"></div></div></body></html>',{url:'https://testetg.example/login.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 w.usuarioLogado={id,adminId:tenant,role};
 w.dados={
   servicos:[{id:'os1',adminId:'a',clienteId:'c',data:'2026-11-12',numeroRegisto:'125',hora:'09:00',status:'em andamento'},{id:'os2',adminId:'b',clienteId:'c',data:'2026-11-12',status:'pendente'}],
   obras:[{id:'o1',adminId:'a',estado:'Ativa',nome:'Obra teste'}],
   assistencias:[{id:'as1',adminId:'a',estado:'Aberta',atribuidoId:null}],
   ponto:[{id:'p1',adminId:'a',funcionarioId:'f',servicoId:'os1',data:new Date().toLocaleDateString('sv-SE'),entrada:'09:00'}],
   obraPontoLonga:[],
   funcionarios:[{id:'f',adminId:'a',nome:'João'}],encarregados:[],
   clientes:[{id:'c',adminId:'a',nome:'Cliente XPTO'}]
 };
 w.eval(source);
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,api:w.TGDashboardCustom,done:()=>w.close()};
}
test('Dashboard novo monta, preserva o conteúdo antigo e mostra todos os filtros de datas',()=>{
 const t=env();try{
  const root=t.w.document.getElementById('tgdCustomRoot');
  assert(root);assert.match(root.textContent,/Dashboard principal/);
  for(const term of ['Semanal','Mensal','Anual','Personalizado'])assert(root.textContent.includes(term));
  assert.match(t.w.document.getElementById('dashboardCentralConteudo').textContent,/Antigo Dashboard/);
  assert(t.w.document.querySelector('#secao-dashboard-central.tgd-custom-active'));
 }finally{t.done()}
});
test('Filtro semanal, mensal, anual e personalizado produz períodos corretos',()=>{
 const t=env();try{
  for(const [mode,label] of [['weekly','Semanal'],['monthly','Mensal'],['annual','Anual'],['custom','Personalizado']]){
   t.w.document.querySelector('[data-period="'+mode+'"]').click();
   assert(t.w.document.querySelector('[data-period="'+mode+'"].selected'),label);
  }
  for(const [key,val] of [['start','2026-11-01'],['end','2026-11-30']]){
   const input=t.w.document.querySelector('[data-date="'+key+'"]');input.value=val;input.dispatchEvent(new t.w.Event('change',{bubbles:true}));
  }
  assert.deepEqual(JSON.parse(t.w.localStorage.getItem('tg:test:dash:v1:a:a')).period,'custom');
  assert.equal(t.api.bounds().first,'2026-11-01');
  assert.equal(t.api.bounds().last,'2026-11-30');
 }finally{t.done()}
});
test('Estatísticas respeitam tenant e período e não inventam dados',()=>{
 const t=env();try{
  const info=t.api.group({tenant:'a',user:'a',role:'admin'},{first:'2026-11-01',last:'2026-11-30',invalid:false});
  assert.equal(info.osPeriod.length,1);
  assert.equal(info.activeWorks.length,1);
  assert.equal(info.unassigned.length,1);
  assert.equal(info.team.length,1);
  assert(!info.osPeriod.some(x=>x.adminId==='b'));
  assert.equal(info.osPeriod[0].id,'os1');
 }finally{t.done()}
});
test('Cada admin e subadmin tem chave independente',()=>{
 const t=env();try{
  const a=t.api.prefKey({tenant:'a',user:'a'});
  const sub=t.api.prefKey({tenant:'a',user:'s'});
  const other=t.api.prefKey({tenant:'b',user:'b'});
  assert.notEqual(a,sub);assert.notEqual(sub,other);
  assert.notEqual(a,other);
  t.w.document.querySelector('[data-editor-toggle]').click();
  t.w.document.querySelector('[data-visible="planning"]').click();
  assert(!t.w.document.querySelector('[data-widget="planning"]'));
  const saved=JSON.parse(t.w.localStorage.getItem(a));assert(!saved.visible.includes('planning'));
  t.w.usuarioLogado={id:'s',adminId:'a',role:'subadmin'};
  t.api.update();
  assert(t.w.document.querySelector('[data-widget="planning"]'));
  assert.equal(t.w.localStorage.getItem(sub),null);
 }finally{t.done()}
});
test('Editor permite tamanho alargado, reordenar, repor e guardar',()=>{
 const t=env();try{
  t.w.document.querySelector('[data-editor-toggle]').click();
  assert(t.w.document.querySelector('.tgd-editor'));
  const first=t.w.document.querySelector('[data-widget="os"]');
  first.querySelector('[data-size]').click();
  assert(t.w.document.querySelector('[data-widget="os"]').classList.contains('tgd-wide'));
  t.w.document.querySelector('[data-widget="os"] [data-move="1"]').click();
  const stored=JSON.parse(t.w.localStorage.getItem('tg:test:dash:v1:a:a'));
  assert(stored.sizes.os==='wide');
  assert(stored.order.indexOf('os')>stored.order.indexOf('assist'));
  t.w.document.querySelector('[data-reset]').click();
  assert(!t.w.document.querySelector('[data-widget="os"]').classList.contains('tgd-wide'));
  assert(t.w.document.querySelector('[data-widget="planning"]'));
  t.w.document.querySelector('[data-save]').click();
  assert(!t.w.document.querySelector('.tgd-editor'));
 }finally{t.done()}
});
test('Subadmin sem cartão financeiro autorizado não vê o widget',()=>{
 const t=env('subadmin','s','a');try{
  const card=t.w.document.querySelector('[data-card="financeiro"]');
  card.classList.add('card-bloqueado');
  t.api.load({tenant:'a',user:'s',role:'subadmin'});
  t.api.render();
  t.w.document.querySelector('[data-editor-toggle]').click();
  assert(!t.w.document.querySelector('[data-visible="finance"]'));
  assert(!t.w.document.querySelector('[data-widget="finance"]'));
 }finally{t.done()}
});
test('Nenhum botão de personalização altera OS ou picagens',()=>{
 const t=env();try{
  const before=JSON.stringify(t.w.dados);
  t.w.document.querySelector('[data-editor-toggle]').click();
  t.w.document.querySelector('[data-visible="planning"]').click();
  t.w.document.querySelector('[data-widget="os"] [data-size]').click();
  t.w.document.querySelector('[data-save]').click();
  assert.equal(JSON.stringify(t.w.dados),before);
 }finally{t.done()}
});
test('PWA do TesteTG tem scripts e versão de cache isolada',()=>{
 for(const file of ['login.html','index.html','sw.js']){
  const body=fs.readFileSync(file,'utf8');
  assert(body.includes('tg-dashboard-custom-test.js?v=2.0.0-clean-presets'),file);
  assert(body.includes('tg-dashboard-custom-test.css?v=2.0.0-clean-presets'),file);
 }
 assert.match(fs.readFileSync('sw.js','utf8'),/testetg-dashboard-clean-map-presets-20261113/);
});

test('Obras inativas não contam como ativas e mudança de pausa atualiza os dados',()=>{
 const t=env();try{
  t.w.dados.obras.push({id:'o2',adminId:'a',estado:'Inativa'});
  const b={first:'2026-11-01',last:'2026-11-30',invalid:false};
  assert.equal(t.api.group({tenant:'a',user:'a'},b).activeWorks.length,1);
  const prev=t.w.document.getElementById('tgdCustomRoot').textContent;
  t.w.dados.ponto[0].saida='12:00';t.w.dados.ponto[0].motivoSaida='pausa';
  t.api.update();
  assert(t.w.document.getElementById('tgdCustomRoot'));
  assert.notEqual(t.w.document.getElementById('tgdCustomRoot').textContent,prev);
 }finally{t.done()}
});

test('modelo Operacional tem os cinco indicadores e assistências em destaque',()=>{
 const t=env();try{
  const widgets=[...t.w.document.querySelectorAll('#tgdCustomRoot [data-widget]')].map(n=>n.dataset.widget);
  assert.deepEqual(widgets.slice(0,5),['os','assist','works','team','pending']);
  assert(t.w.document.querySelector('[data-widget="assistdetail"]'));
  assert(t.w.document.querySelector('[data-widget="live"]'));
  assert(t.w.document.querySelector('[data-template]'));
 }finally{t.done()}
});
test('seis tipos de Dashboard e escolha individual por utilizador',()=>{
 const t=env();try{
  const options=[...t.w.document.querySelectorAll('[data-template] option')].map(e=>e.value);
  assert.deepEqual(options,['operacional','gestao','assistencias','comercial','financeiro','simples']);
  t.api.applyPreset('assistencias');
  assert(t.w.document.querySelector('[data-widget="assistdetail"]'));
  assert.equal(t.w.document.querySelector('[data-widget="works"]'),null);
  const stored=JSON.parse(t.w.localStorage.getItem('tg:test:dash:v1:a:a'));
  assert.equal(stored.profile,'assistencias');
  t.w.usuarioLogado={id:'s',adminId:'a',role:'subadmin'};
  t.api.update();
  assert.equal(t.w.document.querySelector('[data-template]').value,'operacional');
 }finally{t.done()}
});
test('personalização específica de cada modelo é preservada ao alternar',()=>{
 const t=env();try{
  t.api.applyPreset('assistencias');
  t.w.document.querySelector('[data-editor-toggle]').click();
  t.w.document.querySelector('[data-visible="planning"]').click();
  assert(!t.w.document.querySelector('[data-widget="planning"]'));
  t.api.applyPreset('gestao');
  assert(t.w.document.querySelector('[data-widget="planning"]'));
  t.api.applyPreset('assistencias');
  assert(!t.w.document.querySelector('[data-widget="planning"]'));
 }finally{t.done()}
});
test('assistências contam apenas o tenant e o período e não inventam métricas',()=>{
 const t=env();try{
  const ctx={tenant:'a',user:'a'},b={first:'2026-11-01',last:'2026-11-30',invalid:false};
  t.w.dados.assistencias.push({id:'as2',adminId:'b',estado:'Aberta',data:'2026-11-12'});
  t.w.dados.assistencias[0].data='2026-11-12';
  const info=t.api.group(ctx,b);
  assert.equal(info.assistPeriod.length,1);
  assert.equal(info.unassigned.length,1);
  assert.equal(info.openAssist.length,1);
  assert.equal(info.resolvedAssist.length,0);
  t.api.render();
  assert.match(t.w.document.querySelector('[data-widget="assistdetail"]').textContent,/Sem atribuição/);
 }finally{t.done()}
});
test('mapa só recebe localizações GPS reais do tenant e sem GPS mostra alternativa',()=>{
 const t=env();try{
  const ctx={tenant:'a',user:'a'},b={first:'2026-11-01',last:'2026-11-30',invalid:false};
  assert.equal(t.api.group(ctx,b).mapPoints.length,0);
  assert.match(t.w.document.querySelector('[data-widget="live"]').textContent,/Sem GPS recente/);
  t.w.dados.ponto[0].latitude=38.75;
  t.w.dados.ponto[0].longitude=-9.15;
  t.w.dados.ponto.push({id:'cross',adminId:'b',funcionarioId:'f',data:new Date().toLocaleDateString('sv-SE'),entrada:'10:00',latitude:40.5,longitude:-8.7});
  const loc=t.api.group(ctx,b).mapPoints;
  assert.equal(loc.length,1);
  assert.equal(loc[0].lat,38.75);
  assert.equal(loc[0].lng,-9.15);
 }finally{t.done()}
});
test('atalhos de OS, assistências e mapa utilizam os módulos existentes',()=>{
 const t=env();try{
  for(const id of ['os','assist','works','team']){
   const card=t.w.document.querySelector('[data-widget="'+id+'"]');
   assert(card?.querySelector('[data-open]'),id);
  }
  const live=t.w.document.querySelector('[data-widget="live"]');
  assert(live.querySelector('[data-open="mapa-equipa"]'));
 }finally{t.done()}
});
test('mapa é carregado e versão PWA está separada da Produção',()=>{
 for(const file of ['login.html','index.html','sw.js']){
  const s=fs.readFileSync(file,'utf8');
  assert(s.includes('tg-dashboard-map-test.js?v=1.0.0'),file);
  assert(s.includes('tg-dashboard-custom-test.js?v=2.0.0-clean-presets'),file);
 }
 const source=fs.readFileSync('tg-dashboard-map-test.js','utf8');
 assert.match(source,/openstreetmap\.org/);
 assert.match(source,/mapPoints|points/);
});
