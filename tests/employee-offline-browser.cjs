const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8765/login.html',{waitUntil:'load'});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.evaluate(async()=>{
   // Synthetic employee data only: no account credentials or production writes.
   _cacheAuthId='offline-auth';usuarioLogado={id:'employee',adminId:'company',role:'funcionario',nome:'Técnico de teste'};
   dados=dadosVazios();dados.administradores=[{id:'company',ativo:true,empresa:'Empresa de teste',licenca:{ativa:true,plano:'pro',dataExpiracao:'2099-12-31'},areasNegocio:['avac']}];
   dados.funcionarios=[{id:'employee',adminId:'company',nome:'Técnico de teste',role:'funcionario',podeAssinarRelatorios:true}];
   dados.clientes=[{id:'customer',adminId:'company',nome:'Cliente de teste',numeroCliente:'123'}];
   dados.servicos=[{id:'offline-os',adminId:'company',clienteId:'customer',funcionarioId:'employee',relatorioResponsavelId:'employee',tiposTrabalho:['CCTV'],status:'pendente',data:getDataHoje()}];
   _reconstruirSnapshots();await _guardarCacheLocal();
   await _kvCacheSet('tg_profile_v2:offline-auth',{id:'offline-auth',papel:'funcionario',registo_id:'employee',admin_id:'company'});
   await _kvCacheSet('tg_offline_active_v2',{userId:'offline-auth'});
  });
  await context.setOffline(true);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>typeof usuarioLogado!=='undefined'&&usuarioLogado?.id==='employee');
  assert.equal(await page.evaluate(()=>typeof supabase.createClient),'function');
  assert.equal(await page.evaluate(()=>dados.servicos[0].id),'offline-os');
  await page.evaluate(()=>_abrirModalRelatorioEspecialidade('offline-os','RCCTV',()=>{}));
  const frame=page.frameLocator('#re_iframe');
  await frame.locator('input').first().waitFor();
  const editable=frame.locator('textarea').first();await editable.fill('Trabalho registado sem internet');
  await page.waitForFunction(async()=>!!await TGReportAutosave.read({tenant:'company',user:'employee',os:'offline-os',type:'RCCTV'}));
  await page.evaluate(()=>_fecharModalRelatorioEspecialidade());
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>typeof usuarioLogado!=='undefined'&&usuarioLogado?.id==='employee');
  await page.evaluate(()=>_abrirModalRelatorioEspecialidade('offline-os','RCCTV',()=>{}));
  assert.equal(await page.frameLocator('#re_iframe').locator('textarea').first().inputValue(),'Trabalho registado sem internet');
  assert.equal(await page.locator('#tg-report-save-status').textContent(),'Rascunho recuperado do dispositivo');
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile shell loads offline, employee restores, CCTV draft autosaves and survives close + full reload without network.');
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
