const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync('app-principal.js','utf8');
const start=source.indexOf('        function _abrirLeitorRelatorioGuardado()');
const end=source.indexOf('        function _gerarHTMLIntervencoesPorLocal',start);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BINARY,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><button id="origin">Ver relatório</button><div style="height:2000px">Lista anterior</div>');
  await page.addScriptTag({content:`var dados={relatoriosEspecialidade:[{id:'saved',campos:{htmlSnapshot:'<h1>Relatório guardado</h1><div style="height:2000px">Conteúdo</div>'}},{id:'remote',campos:{htmlSnapshotPath:'stored.html'}}]};var alerts=[];alert=x=>alerts.push(x);window.open=()=>{throw Error('Mobile must not open a new tab')};var _obterUrlStorage=async()=>'/snapshot';${source.slice(start,end)}`});
  await page.locator('#origin').focus();
  await page.evaluate(()=>_verRelatorioEspecialidadeSnapshot('saved',false));
  const close=page.getByRole('button',{name:'Fechar relatório e voltar'});
  await close.waitFor({state:'visible'});
  assert.equal(await page.frameLocator('#tgRelatorioGuardado iframe').locator('h1').textContent(),'Relatório guardado');
  await page.frameLocator('#tgRelatorioGuardado iframe').locator('body').evaluate(b=>b.ownerDocument.defaultView.scrollTo(0,1000));
  const box=await close.boundingBox();assert(box.y>=0&&box.y+box.height<=844);
  await close.click();
  assert.equal(await page.locator('#tgRelatorioGuardado').count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'origin');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  // Close while Storage is pending: the result must not reopen the viewer.
  await page.evaluate(()=>{fetch=()=>new Promise(resolve=>window.finishFetch=resolve);window.pending=_verRelatorioEspecialidadeSnapshot('remote',false)});
  await close.click();
  await page.evaluate(async()=>{finishFetch({text:async()=>'<h1>Tardio</h1>'});await pending});
  assert.equal(await page.locator('#tgRelatorioGuardado').count(),0);
  // Errors retain the same close control.
  await page.evaluate(async()=>{fetch=async()=>{throw Error('offline')};await _verRelatorioEspecialidadeSnapshot('remote',false)});
  await page.frameLocator('#tgRelatorioGuardado iframe').getByText(/Não foi possível/).waitFor();
  await close.click();
  assert.equal(await page.locator('#tgRelatorioGuardado').count(),0);
  assert.deepEqual(await page.evaluate(()=>alerts),[]);
  await context.close();
  console.log('PASS saved reports: mobile in-app rendering, visible close after scroll, restored focus/scrolling, close during pending Storage, error recovery.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
