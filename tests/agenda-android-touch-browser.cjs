const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync('app-principal.js','utf8');
function fn(name){const start=source.search(new RegExp('        (?:async )?function '+name+'\\('));assert(start>=0,name);const lineEnd=source.indexOf('\n',start);if(source.slice(start,lineEnd).trim().endsWith('}'))return source.slice(start,lineEnd);const end=source.indexOf('\n        }',start);return source.slice(start,end+10)}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BINARY,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36'});
  const page=await context.newPage();
  await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}.day{height:180px;margin:10px;border:1px solid #aaa}.os{height:65px;background:#def;margin:12px}.ag-drop{outline:3px solid blue}</style><div class="day" data-tg-agenda-drop ondrop="agendaDrop(event,'2026-10-27')"><div class="os" data-tg-agenda-drag draggable="true" ondragstart="agendaDragStart(event,'os')" ondragend="agendaDragEnd()" onclick="clicks++">OS por concluir</div></div><div class="day" id="target" data-tg-agenda-drop ondrop="agendaDrop(event,'2026-10-28')">Dia seguinte</div><div style="height:1200px">Scroll</div>`);
  await page.addScriptTag({content:`var usuarioLogado={role:'admin'},dados={servicos:[{id:'os',status:'pendente',data:'2026-10-27',funcionarioId:'tech'}]},_agendaDragId=null,saves=0,clicks=0,notices=0,alerts=[];var guardarDados=()=>saves++,renderizarAgendaObras=()=>{},renderizarServicos=()=>{},_bloquearSeAusenteEmOS=()=>false,_notificarAlteracaoOS=()=>notices++,_pessoasTenantAg=()=>[{id:'newtech',nome:'Novo técnico'}],_nomeClienteOS=()=> 'Cliente',choice=null,tgEscolher=async()=>choice;alert=x=>alerts.push(x);${['agendaDragStart','agendaDragEnd','agendaDrop','agendaDropGantt','_osBloqueada'].map(fn).join('\n')}`});
  await page.addScriptTag({path:'tg-agenda-touch.js'});
  const cdp=await context.newCDPSession(page);
  async function touch(type,x,y){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]})}
  async function drag({hold=true,cancel=false}={}){
   await touch('touchStart',100,60);if(hold)await page.waitForTimeout(400);
   await touch('touchMove',100,280);
   await touch(cancel?'touchCancel':'touchEnd',100,280);
   await page.waitForTimeout(40);
  }
  await drag();
  assert.deepEqual(await page.evaluate(()=>({date:dados.servicos[0].data,saves,notices,clicks,id:_agendaDragId})),{date:'2026-10-28',saves:1,notices:1,clicks:0,id:null});
  assert.equal(await page.locator('.ag-drop').count(),0);
  await page.evaluate(()=>{dados.servicos[0].data='2026-10-27';saves=0});
  await drag({hold:false});assert.equal(await page.evaluate(()=>saves),0);
  await page.evaluate(()=>scrollTo(0,0));
  await drag({cancel:true});assert.equal(await page.evaluate(()=>saves),0);
  assert.equal(await page.evaluate(()=>_agendaDragId),null);
  await page.evaluate(()=>{usuarioLogado.role='funcionario'});
  await drag();assert.equal(await page.evaluate(()=>saves),0);
  await page.evaluate(()=>{usuarioLogado.role='admin';dados.servicos[0].status='concluído'});
  await drag();assert.equal(await page.evaluate(()=>saves),0);
  assert.equal(await page.evaluate(()=>alerts.length),1);
  // Gantt uses the same touch drop and keeps the assignment confirmation.
  await page.evaluate(()=>{
   dados.servicos[0].status='pendente';saves=0;
   document.getElementById('target').setAttribute('ondrop',"agendaDropGantt(event,'2026-10-28','newtech')");
  });
  await drag();assert.equal(await page.evaluate(()=>saves),0);
  await page.evaluate(()=>choice='passar');
  await drag();assert.equal(await page.evaluate(()=>saves),1);
  assert.equal(await page.evaluate(()=>dados.servicos[0].funcionarioId),'newtech');
  await page.evaluate(()=>{
   dados.servicos[0].funcionarioId='tech';dados.servicos[0].funcionariosIds=['tech'];saves=0;choice='adicionar';
  });
  await drag();assert.equal(await page.evaluate(()=>saves),1);
  assert.deepEqual(await page.evaluate(()=>dados.servicos[0].funcionariosIds),['tech','newtech']);
  await context.close();
  console.log('PASS Android touch: hold/drag moves OS once, retains notifications, swipe scrolls, cancel cleans up, employees/completed OS blocked, Gantt cancellation/reassignment/addition preserved.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
