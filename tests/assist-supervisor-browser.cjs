const fs = require('node:fs'), assert = require('node:assert/strict'), { chromium } = require('playwright');
const html = fs.readFileSync('TOTALGEST_ASSIST.html', 'utf8');
const fn = name => {
 const match = html.match(new RegExp('        (?:async )?function ' + name + '\\([^]*?\\n        \\}'));
 if (!match) throw Error('Function missing: ' + name);
 return match[0];
};
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_BINARY, args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  const page = await browser.newPage({viewport:{width:1100,height:1000}}), errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  const modal = html.slice(html.indexOf('<div class="modal-overlay" id="modalGenericoOverlay">'),html.indexOf('<script>',html.indexOf('<div class="modal-overlay" id="modalGenericoOverlay">')));
  await page.setContent(modal);
  await page.addStyleTag({content:html.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1]});
  await page.addScriptTag({content:`
   window.dados={
    administradores:[{id:'tenant',nome:'Admin'}],
    funcionarios:[{id:'v1',adminId:'tenant',nome:'Vanda Ribeiro',role:'funcionario'},
     {id:'v2',adminId:'tenant',nome:'Vanda Ribeiro',role:'funcionario'},
     {id:'sub',adminId:'tenant',nome:'Sub Admin',role:'subadmin'},
     {id:'inactive',adminId:'tenant',nome:'Inativo',ativo:false},
     {id:'foreign-staff',adminId:'other',nome:'Outra empresa'}],
    encarregados:[{id:'manager',adminId:'tenant',nome:'André Gomes'},
     {id:'suspended',adminId:'tenant',nome:'Suspenso',suspenso:true},
     {id:'foreign-manager',adminId:'other',nome:'Outra empresa'}],
    clientes:[{id:'client',adminId:'tenant',nome:'Cliente de teste',morada:'Rua de teste'}],
    assistencias:[{id:'assist',adminId:'tenant',clienteId:'client',numero:'AST-TESTE',assunto:'Equipamento avariado',atribuidoId:'manager',estado:'aberta',prioridade:'normal'}],
    servicos:[],notificacoes:[]
   };
   window.usuarioLogado={id:'tenant',role:'admin'};
   window._tenantId=()=>usuarioLogado.adminId||usuarioLogado.id;
   window.escapeHtmlSimples=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.getDataHoje=()=> '2026-10-23';window.counter=0;window.gerarId=()=> 'test-'+(++counter);
   window.gerarNumeroRegistoServidor=async()=> 'OS-TESTE';window.gerarNumeroRegisto=()=> 'OS-FALLBACK';
   window.gerarNumeroAssistencia=()=> 'AST-TESTE';window.saves=[];window.notifications=[];window.alerts=[];
   window.guardarDados=async(data,columns)=>saves.push({columns,data:JSON.parse(JSON.stringify(data))});
   window._crmNotificar=async(id,title,message)=>notifications.push({id,title,message});
   window.alert=m=>alerts.push(m);window.confirmChoice=true;window.confirm=()=>confirmChoice;
   window.renderizarTudo=()=>{};window.mostrarStatusCRM=()=>{};
   window._protegerSubmit=fn=>async event=>{event?.preventDefault();return await fn();};
   window._preencherDatalistClientes=()=>{};window._assistContactosRapidosHTML=()=>'';
   window._assistBadgeSLA=()=>'';window._assistNotasHTML=()=>'';window._clienteLabel=c=>c.nome;
   window.ASSIST_PRIORIDADES={normal:{label:'Normal'}};window.ASSIST_ESTADOS={aberta:{label:'Aberta'}};
  `});
  await page.addScriptTag({content:fs.readFileSync('tg-planner.js','utf8')});
  await page.addScriptTag({content:['getFuncionariosByAdmin','_pessoasParaAtribuir','_equipaParaAtribuir','_tgAssistSugestao','abrirModalAssistencia','guardarAssistencia','criarOSDeAssistencia','_confirmarCriarOSDeAssistencia'].map(fn).join('\n')});
  await page.evaluate(()=>criarOSDeAssistencia('assist'));
  const choices=()=>page.locator('.assist-os-func-chk');
  assert.deepEqual(await choices().evaluateAll(es=>es.map(e=>e.value)),['manager','sub','v1','v2']);
  assert.equal(await page.locator('.assist-os-func-chk[value="manager"]').isChecked(),true);
  assert.match(await page.locator('#modalGenericoCampos').innerText(),/André Gomes/);
  // Same name can identify different people; the same ID in both collections is shown once.
  await page.evaluate(()=>{dados.funcionarios.push({id:'manager',adminId:'tenant',nome:'Registo legado'});criarOSDeAssistencia('assist');});
  assert.equal(await page.locator('.assist-os-func-chk[value="manager"]').count(),1);
  assert.match(await page.locator('#modalGenericoCampos').innerText(),/André Gomes/);
  assert.doesNotMatch(await page.locator('#modalGenericoCampos').innerText(),/Registo legado|Outra empresa|Suspenso|Inativo/);
  await page.evaluate(()=>{for(const e of document.querySelectorAll('.assist-os-func-chk'))e.checked=false;confirmChoice=false;_tgAssistSugestao('os');});
  assert.equal(await page.locator('.assist-os-func-chk:checked').count(),0);
  await page.evaluate(()=>{confirmChoice=true;_tgAssistSugestao('os');});
  assert.equal(await page.locator('.assist-os-func-chk[value="manager"]').isChecked(),true);
  assert.equal(await page.evaluate(()=>saves.length+notifications.length),0);
  for(const width of [1100,390]) {
   await page.setViewportSize({width,height:1000});
   await page.screenshot({path:(process.env.QA_OUTPUT||'/tmp')+'/assist-encarregado-'+width+'.png',fullPage:true});
  }
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.waitForFunction(()=>saves.length===1);
  assert.deepEqual(await page.evaluate(()=>dados.servicos[0].funcionariosIds),['manager']);
  assert.equal(await page.evaluate(()=>dados.servicos[0].funcionarioId),'manager');
  assert.equal(await page.evaluate(()=>notifications[0].id),'manager');
  assert.deepEqual(await page.evaluate(()=>saves[0].columns),['servicos','assistencias','notificacoes']);
  // The ordinary assistance picker and save also accept the same manager for a subadmin.
  await page.evaluate(()=>{usuarioLogado={id:'sub',adminId:'tenant',role:'subadmin'};dados.assistencias[0].atribuidoId=null;abrirModalAssistencia('assist');});
  assert.equal(await page.locator('#assist_atribuido option[value="manager"]').count(),1);
  await page.selectOption('#assist_atribuido','manager');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.waitForFunction(()=>saves.length===2);
  assert.equal(await page.evaluate(()=>dados.assistencias[0].atribuidoId),'manager');
  assert.equal(await page.evaluate(()=>notifications.at(-1).id),'manager');
  await page.evaluate(()=>{dados.encarregados[0].suspenso=true;criarOSDeAssistencia('assist');});
  assert.equal(await page.locator('.assist-os-func-chk[value="manager"]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: encarregado em assistência/OS, pré-seleção, sugestões confirmadas, gravação e destinatário, subadmin, isolamento, suspensão e IDs duplicados; só dados e notificações simulados.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
