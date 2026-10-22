const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const main=fs.readFileSync('app-principal.js','utf8'),html=fs.readFileSync('index.html','utf8');
const section=html.slice(html.indexOf('    <div id="secao-folhas"'),html.indexOf('    <div id="secao-requisicoes"'));
const map=main.slice(main.indexOf('            folhasObra: {'),main.indexOf('            kmViagens: {'));
assert(map.includes('cliente_id: o.clienteId || null'));assert(map.includes('validada: r.validada === true'));
assert(!map.split('to:')[1].includes('validada')); // ordinary writes cannot overwrite administrative review
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BINARY,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(section);await page.evaluate(()=>document.getElementById('secao-folhas').classList.add('active'));await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});await page.addStyleTag({content:fs.readFileSync('tg-work-sheets.css','utf8')});
 await page.addScriptTag({content:`
 window.dados={
 administradores:[{id:'tenant',nome:'Admin'}],clientes:[{id:'c1',adminId:'tenant',nome:'Álvaro & Filhos'},{id:'c2',adminId:'tenant',nome:'Beta'}],
 locais:[{id:'l1',adminId:'tenant',clienteId:'c1',nome:'Loja Centro'},{id:'l2',adminId:'tenant',clienteId:'c2',nome:'Armazém'}],
 funcionarios:[{id:'t1',adminId:'tenant',nome:'Ana'},{id:'t2',adminId:'tenant',nome:'Zé'}],encarregados:[],
 obras:[{id:'o1',adminId:'tenant',clienteId:'c1',localId:'l1',nome:'Renovação CCTV'}],
 contratos:[{id:'ct',adminId:'tenant',clienteId:'c2',localId:'l2'}],
 servicos:[{id:'os1',adminId:'tenant',clienteId:'c1',localId:'l1',obraId:'o1',descricao:'Visita técnica'}],
 folhasObra:[
 {id:'f1',adminId:'tenant',servicoId:'os1',funcionarioId:'t1',descricao:'Câmaras instaladas',data:'2026-10-22',horasTrabalhadas:4},
 {id:'f2',adminId:'tenant',clienteId:'c2',localId:'l2',funcionarioId:'t2',obraDescricao:'Projeto intrusão',descricao:'Sensores instalados',data:'2026-10-21',validada:true},
 {id:'f3',adminId:'tenant',obraId:'o1',funcionarioId:'tenant',descricao:'Revisão',data:'2026-10-20'},
 {id:'f4',adminId:'tenant',contratoId:'ct',funcionarioId:'t2',descricao:'Manutenção',data:'2026-10-19'},
 {id:'f5',adminId:'tenant',obraDescricao:'Álvaro & Filhos / Sede',funcionarioId:'t1',descricao:'Legada',data:'2026-10-18'},
 {id:'f6',adminId:'other',clienteId:'c1',descricao:'Estrangeira',data:'2026-10-22'}]};
 window.usuarioLogado={id:'tenant',role:'admin'};window._tenantId=()=>usuarioLogado.adminId||usuarioLogado.id;
 window._folhasOrdem='desc';window._folhasCarregadoDesde='2026-07-22';window.renderizarFolhas=()=>{};
 window.escapeHtmlSimples=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window._guardarCacheLocal=()=>{};window.failSave=false;window.requests=0;window.msgs=[];window.mostrarErro=m=>msgs.push(m);
 window.server=JSON.parse(JSON.stringify(dados.folhasObra));
 window.supa={from:()=>({update:patch=>{requests++;let id;const q={eq:(k,v)=>{if(k==='id')id=v;return q;},select:()=>q,single:async()=>{await new Promise(r=>setTimeout(r,70));if(failSave)return {error:{message:'Rede indisponível'}};const f=server.find(f=>f.id===id);Object.assign(f,patch);return {data:{id,validada:f.validada,validada_por:'auth-admin',validada_em:'2026-10-22T08:00:00Z'}};}};return q;}})};
 `});await page.addScriptTag({content:fs.readFileSync('tg-work-sheets.js','utf8')});await page.evaluate(()=>renderizarFolhas());
 const rows=page.locator('#tabelaFolhas tr');assert.equal(await rows.count(),5);
 assert.match(await rows.first().innerText(),/Álvaro & Filhos.*Loja Centro.*Renovação CCTV.*Ana/s);
 assert.equal(await page.locator('[data-folha-id="f3"] td').nth(3).innerText(),'Admin');
 assert.match(await page.locator('[data-folha-id="f4"]').innerText(),/Beta.*Armazém/s);
 assert.match(await page.locator('[data-folha-id="f5"]').innerText(),/Álvaro & Filhos.*Sede/s);
 await page.selectOption('#folhasFiltro_cliente','c1');assert.equal(await rows.count(),3);
 await page.selectOption('#folhasFiltro_instalacao','l1');assert.equal(await rows.count(),2);
 await page.selectOption('#folhasFiltro_obra','o1');assert.equal(await rows.count(),2);
 await page.selectOption('#folhasFiltro_tecnico','t1');assert.equal(await rows.count(),1);
 await page.selectOption('#folhasFiltro_validacao','validada');assert.equal(await rows.count(),0);
 await page.getByRole('button',{name:'Limpar filtros'}).click();assert.equal(await rows.count(),5);
 const validate=()=>page.locator('[data-folha-validacao="f1"]');
 assert.equal(await validate().innerText(),'Não validada');await validate().click();
 await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='f1').validada===true);
 assert.equal(await validate().innerText(),'Validada');
 // A refresh from persistent server state keeps the validation.
 await page.evaluate(()=>{dados.folhasObra=JSON.parse(JSON.stringify(server));renderizarFolhas();});
 assert.equal(await validate().innerText(),'Validada');await validate().click();
 await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='f1').validada===false);
 assert.equal(await validate().innerText(),'Não validada');
 await page.evaluate(()=>failSave=true);await validate().click();await page.waitForFunction(()=>msgs.length===1);
 assert.equal(await validate().innerText(),'Não validada');
 await page.evaluate(()=>{usuarioLogado={id:'t1',adminId:'tenant',role:'funcionario'};renderizarFolhas();});
 assert.equal(await rows.count(),2);assert.equal(await page.locator('[data-folha-validacao]').count(),0);
 const previousRequests=await page.evaluate(()=>requests);await page.evaluate(()=>tgFolhasValidar('f1'));assert.equal(await page.evaluate(()=>requests),previousRequests);
 await page.evaluate(()=>{usuarioLogado={id:'sub',adminId:'tenant',role:'subadmin'};failSave=false;renderizarFolhas();});
 assert.equal(await rows.count(),5);assert.equal(await page.locator('[data-folha-validacao]').count(),5);
 await page.evaluate(()=>{usuarioLogado={id:'other',role:'admin'};renderizarFolhas();});
 assert.equal(await rows.count(),1);assert(!await page.locator('#folhasFiltro_cliente').innerText().then(s=>s.includes('Álvaro')));
 await page.evaluate(()=>{usuarioLogado={id:'tenant',role:'admin'};renderizarFolhas();});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:950});await page.evaluate(()=>document.getElementById('secao-folhas').classList.add('active'));
  for(const dark of [false,true]){
   await page.evaluate(d=>document.body.classList.toggle('dark-mode',d),dark);await page.waitForTimeout(250);
   assert.equal(await page.locator('#folhasFiltros').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   await page.screenshot({path:'/workspace/scratch/fdd5760edb73/folhas-'+width+'-'+(dark?'noite':'dia')+'.png'});
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS: colunas, relações antigas, 5 filtros combinados, validar/repor/persistência, erro de rede, permissões e mobile/dia/noite');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
