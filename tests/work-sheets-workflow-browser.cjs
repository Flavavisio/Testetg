const fs = require('node:fs'), assert = require('node:assert/strict'), { chromium } = require('playwright');
const html = fs.readFileSync('login.html', 'utf8');
const section = html.slice(html.indexOf('    <div id="secao-folhas"'), html.indexOf('    <div id="secao-requisicoes"'));
const source = fs.readFileSync('tg-work-sheets.js', 'utf8');
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_BINARY, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setContent(section);
  await page.addStyleTag({ content: fs.readFileSync('styles.css', 'utf8') });
  await page.addStyleTag({ content: fs.readFileSync('tg-work-sheets.css', 'utf8') });
  await page.evaluate(() => document.getElementById('secao-folhas').classList.add('active'));
  await page.addScriptTag({ content: `
   window.dados = {
    administradores:[{id:'tenant',nome:'Administrador'}],funcionarios:[{id:'t1',adminId:'tenant',nome:'Ana'},{id:'t2',adminId:'tenant',nome:'Bruno'}],encarregados:[],contratos:[],
    clientes:[{id:'c1',adminId:'tenant',nome:'Cliente Alfa'},{id:'c2',adminId:'tenant',nome:'Cliente Beta'}],
    locais:[{id:'l1',adminId:'tenant',clienteId:'c1',nome:'Instalação Centro'}],
    obras:[{id:'w1',adminId:'tenant',nome:'Obra ativa',clienteId:'c1',localId:'l1',estado:'ativa'},{id:'w2',adminId:'tenant',nome:'Obra concluída',clienteId:'c2',estado:'concluida'}],
    servicos:[{id:'os1',adminId:'tenant',numeroRegisto:'OS-01',obraId:'w1',descricao:'OS ativa',status:'em andamento'},{id:'os2',adminId:'tenant',numeroRegisto:'OS-02',clienteId:'c1',descricao:'OS concluída',status:'concluído'},{id:'os3',adminId:'tenant',obraId:'w2',status:'pendente'},{id:'os4',adminId:'tenant',status:'cancelado'}],
    folhasObra:[
     {id:'a',adminId:'tenant',obraId:'w1',funcionarioId:'t1',horasTrabalhadas:2,data:'2026-10-20',descricao:'Trabalho A'},
     {id:'b',adminId:'tenant',obraId:'w1',funcionarioId:'t2',horasTrabalhadas:3,data:'2026-10-21',validada:true},
     {id:'c',adminId:'tenant',servicoId:'os1',funcionarioId:'t1',horasTrabalhadas:4,data:'2026-10-22'},
     {id:'d',adminId:'tenant',validada:true,servicoId:'os2',funcionarioId:'t1',horasTrabalhadas:2,data:'2026-10-19'},
     {id:'e',adminId:'tenant',obraId:'w2',funcionarioId:'t2',horasTrabalhadas:3,data:'2026-10-18'},
     {id:'f',adminId:'tenant',servicoId:'os3',funcionarioId:'t1',horasTrabalhadas:1,data:'2026-10-17'},
     {id:'g',adminId:'tenant',obraDescricao:'Folha avulsa',funcionarioId:'t1',data:'2026-10-16'},
     {id:'h',adminId:'tenant',servicoId:'os-historica',funcionarioId:'t1',data:'2025-01-01'},
     {id:'i',adminId:'tenant',servicoId:'os4',funcionarioId:'t2',data:'2026-10-15'},
     {id:'foreign',adminId:'foreign',obraId:'w1',funcionarioId:'t1'}
    ]
   };
   window.usuarioLogado = {id:'tenant',role:'admin'};
   window._tenantId = () => usuarioLogado?.adminId || usuarioLogado?.id;
   window._folhasOrdem='desc';window._folhasCarregadoDesde='2026-07-23';window.renderizarFolhas=()=>{};
   window.escapeHtmlSimples = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.mensagens=[];window.mostrarErro=m=>mensagens.push(m);window._guardarCacheLocal=()=>{};
   window.abrirFolhaDetalhe=()=>{};window.gerarPDFFolha=()=>{};window.excluirEntidade=()=>{};
   window.confirmar=true;window.motivo='Correção da marcação';window.tgConfirm=async()=>confirmar;window.tgPrompt=async()=>motivo;
   window.historyRows=[{admin_id:'tenant',folha_id:'d',faturada:true,versao:1,alterado_por:'admin-auth',alterado_em:'2026-10-23T01:00:00Z'}];
   window.calls=[];window.failWrite=false;window.failRead=false;
   window.supa={from(table){let mode='read',payload,eqs={},ids=[];const builder={
    select(){return builder},eq(k,v){eqs[k]=v;return builder},in(k,v){ids=v;return builder},
    insert(p){mode='insert';payload=p;return builder},update(p){mode='update';payload=p;return builder},
    async single(){
     calls.push({table,mode,payload,eqs});
     if(failWrite)return {error:{message:'Erro simulado'}};
     if(mode==='update')return {data:{id:eqs.id,validada:payload.validada,validada_por:'auth-admin',validada_em:'2026-10-23T01:00:00Z'}};
     const last=historyRows.filter(r=>r.folha_id===payload.folha_id).at(-1);
     if(payload.versao!==(last?.versao||0)+1)return {error:{code:'40001'}};
     const data={...payload,alterado_por:'auth-'+usuarioLogado.role,alterado_em:'2026-10-23T01:00:00Z'};
     historyRows.push(data);return {data};
    },
    then(resolve,reject){
     calls.push({table,mode,ids,eqs});
     if(failRead)return Promise.resolve({error:{message:'Leitura indisponível'}}).then(resolve,reject);
     let data=[];
     if(table==='servicos'&&ids.includes('os-historica'))data=[{id:'os-historica',admin_id:'tenant',cliente_id:'c1',descricao:'OS antiga',status:'concluído'}];
     if(table==='tg_teste_folhas_faturacao_atual'){const m=new Map();for(const r of historyRows)if(ids.includes(r.folha_id)&&r.admin_id===eqs.admin_id)m.set(r.folha_id,r);data=[...m.values()];}
     return Promise.resolve({data}).then(resolve,reject);
    }
   };return builder;}};
  ` });
  await page.evaluate(() => {
   supa.rpc = (name, payload) => ({async single() {
    calls.push({table:name,mode:'rpc',payload});
    if(failWrite)return {error:{message:'Erro simulado'}};
    return {data:{id:payload.p_folha_id,validada:payload.p_validada,validada_por:'auth-admin',validada_em:'2026-10-23T10:00:00Z'}};
   }});
  });
  await page.addScriptTag({ content: source });
  await page.evaluate(() => renderizarFolhas());
  await page.waitForFunction(() => document.getElementById('folhasGrupoInfo_concluidas').textContent.includes('por faturar'));
  const rows = () => page.locator('#tabelaFolhas tr');
  const rowIds = async () => (await rows().evaluateAll(rs => rs.map(r => r.dataset.folhaId))).sort();
  // Only validated sheets enter the completed group, even if parents are already done.
  assert.deepEqual(await rowIds(), ['a','c','e','f','g']);
  assert.equal(await page.locator('#folhasGrupoNumero_obras').innerText(), '5');
  assert.equal(await page.locator('#folhasGrupoNumero_os').innerText(), '2');
  assert.equal(await page.locator('#folhasGrupoNumero_concluidas').innerText(), '2');
  assert.match(await page.locator('[data-folha-id="g"]').innerText(), /Sem Obra\/OS associada/);
  assert.equal(await page.locator('[data-folha-id="e"]').count(),1); // finished work, not validated
  const beforeUnvalidatedBilling=await page.evaluate(()=>calls.filter(c=>c.mode==='insert').length);
  await page.evaluate(()=>tgFolhasFaturar('e'));
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.mode==='insert').length),beforeUnvalidatedBilling);
  await page.locator('#folhasGrupo_concluidas').click();assert.deepEqual(await rowIds(),['b']);
  assert.equal(await page.locator('[data-folha-faturacao="b"]').count(),0); // validated, work still open
  await page.locator('#folhasTab_faturadas').click();assert.deepEqual(await rowIds(),['d']);
  await page.evaluate(()=>{dados.folhasObra.find(f=>f.id==='d').validada=false;renderizarFolhas();});
  assert.deepEqual(await rowIds(),[]); // even the paid tab only lists validated sheets
  await page.evaluate(()=>{dados.folhasObra.find(f=>f.id==='d').validada=true;renderizarFolhas();});
  await page.locator('#folhasGrupo_obras').click();
  assert.equal(await page.locator('[data-folha-validacao="c"]').isDisabled(),false);
  assert.equal(await page.locator('[data-folha-validacao="f"]').isDisabled(),false);
  // A pending OS on a completed work can also be validated; billing still waits for the OS.
  await page.locator('[data-folha-validacao="f"]').click();
  await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='f').validada===true);
  await page.locator('#folhasGrupo_concluidas').click();
  assert.equal(await page.locator('[data-folha-faturacao="f"]').count(),0);
  assert.match(await page.locator('[data-folha-id="f"]').innerText(),/Faturação disponível após terminar a OS/);
  const beforePendingBilling=await page.evaluate(()=>calls.filter(c=>c.mode==='insert').length);
  await page.evaluate(()=>tgFolhasFaturar('f'));
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.mode==='insert').length),beforePendingBilling);
  await page.locator('[data-folha-validacao="f"]').click();
  await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='f').validada===false);
  await page.locator('#folhasGrupo_obras').click();
  await page.evaluate(()=>{dados.obras.find(o=>o.id==='w1').valor=5000;renderizarFolhas();});
  const totalHours=await page.evaluate(()=>dados.folhasObra.reduce((n,f)=>n+(Number(f.horasTrabalhadas)||0),0));
  await page.locator('[data-folha-validacao="c"]').click();
  await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='c').validada===true);
  assert.deepEqual(await rowIds(),['a','e','f','g']);
  assert.match(await page.locator('#folhasFaturacaoFeedback').innerText(),/movida para Concluídas/);
  await page.locator('#folhasGrupo_concluidas').click();assert.deepEqual(await rowIds(),['b','c']);
  assert.match(await page.locator('[data-folha-id="c"]').innerText(),/OS em curso · Obra em curso/);
  assert.match(await page.locator('[data-folha-id="c"]').innerText(),/Faturação disponível após concluir a obra/);
  assert.equal(await page.locator('[data-folha-faturacao="c"]').count(),0);
  const nBilling=await page.evaluate(()=>calls.filter(c=>c.mode==='insert').length);
  await page.evaluate(()=>tgFolhasFaturar('c'));
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.mode==='insert').length),nBilling);
  await page.screenshot({path:(process.env.QA_OUTPUT || '/tmp')+'/folhas-validadas-obra-em-curso.png',fullPage:true});
  // Reversing validation moves just that sheet back, without changing hours or parent state.
  await page.locator('[data-folha-validacao="c"]').click();
  await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='c').validada===false);
  assert.deepEqual(await rowIds(),['b']);
  await page.locator('#folhasGrupo_obras').click();assert.deepEqual(await rowIds(),['a','c','e','f','g']);
  await page.locator('[data-folha-validacao="c"]').click();
  await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='c').validada===true);
  await page.evaluate(()=>{dados.servicos.find(s=>s.id==='os1').status='concluído';dados.obras.find(o=>o.id==='w1').estado='concluida';renderizarFolhas();});
  assert.deepEqual(await rowIds(),['a','e','f','g']); // finishing work alone moves nothing
  await page.locator('[data-folha-validacao="a"]').click();
  await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='a').validada===true);
  assert.deepEqual(await rowIds(),['e','f','g']);
  assert.equal(await page.evaluate(()=>dados.folhasObra.reduce((n,f)=>n+(Number(f.horasTrabalhadas)||0),0)),totalHours);
  assert.equal(await page.evaluate(()=>dados.obras.find(o=>o.id==='w1').valor),5000);
  await page.locator('#folhasGrupo_os').click();assert.deepEqual(await rowIds(),['h','i']);
  assert.equal(await page.locator('[data-folha-validacao="i"]').isDisabled(),true);
  assert.match(await page.locator('[data-folha-id="h"]').innerText(),/Cliente Alfa.*OS antiga/s);
  await page.locator('[data-folha-validacao="h"]').click();
  await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='h').validada===true);
  assert.deepEqual(await rowIds(),['i']);
  await page.locator('#folhasGrupo_obras').click();
  await page.locator('[data-folha-validacao="e"]').click();
  await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='e').validada===true);
  assert.deepEqual(await rowIds(),['f','g']);
  await page.locator('#folhasGrupo_concluidas').click();assert.deepEqual(await rowIds(),['a','b','c','e','h']);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#tabelaFolhas tr')].every(r=>dados.folhasObra.find(f=>f.id===r.dataset.folhaId).validada===true)),true);
  await page.locator('[data-folha-faturacao="e"]').click();
  await page.waitForFunction(()=>historyRows.some(r=>r.folha_id==='e'&&r.faturada));
  assert.deepEqual(await rowIds(),['a','b','c','h']);
  await page.locator('#folhasTab_faturadas').click();assert.deepEqual(await rowIds(),['d','e']);
  await page.evaluate(()=>tgFolhasAtualizar());assert.deepEqual(await rowIds(),['d','e']);
  await page.evaluate(() => {usuarioLogado={id:'sub',adminId:'tenant',role:'subadmin'};renderizarFolhas();});
  await page.waitForFunction(() => document.getElementById('folhasGrupoInfo_concluidas').textContent.includes('por faturar'));
  await page.locator('#folhasGrupo_concluidas').click();await page.locator('#folhasTab_faturadas').click();
  assert.equal(await page.locator('[data-folha-faturacao]').count(),0);
  const nWrites = await page.evaluate(() => calls.filter(c=>c.mode==='insert').length);
  await page.evaluate(() => tgFolhasFaturar('d'));
  assert.equal(await page.evaluate(() => calls.filter(c=>c.mode==='insert').length), nWrites);
  await page.locator('#folhasTab_por_faturar').click();await page.locator('[data-folha-faturacao="h"]').click();
  await page.waitForFunction(() => historyRows.some(r=>r.folha_id==='h' && r.faturada));
  await page.evaluate(() => {usuarioLogado={id:'tenant',role:'admin'};renderizarFolhas();});
  await page.waitForFunction(() => document.getElementById('folhasGrupoInfo_concluidas').textContent.includes('por faturar'));
  await page.locator('#folhasGrupo_concluidas').click();await page.locator('#folhasTab_faturadas').click();
  await page.evaluate(() => motivo='   ');await page.locator('[data-folha-faturacao="d"]').click();
  assert.match(await page.evaluate(() => mensagens.at(-1)), /motivo/);assert.deepEqual(await rowIds(), ['d','e','h']);
  await page.evaluate(() => motivo='Correção da marcação');await page.locator('[data-folha-faturacao="d"]').click();
  await page.waitForFunction(() => historyRows.filter(r=>r.folha_id==='d').at(-1).faturada===false);
  assert.deepEqual(await rowIds(), ['e','h']);assert.match(await page.locator('#folhasFaturacaoFeedback').innerText(), /Correção da marcação/);
  // The two remaining work sheets are unvalidated; no completed row is unvalidated.
  assert.equal(await page.locator('#folhasGrupoNumero_obras').innerText(), '2');
  assert.equal(await page.locator('#folhasGrupoNumero_os').innerText(), '1');
  await page.locator('#folhasTab_por_faturar').click();assert.deepEqual(await rowIds(), ['a','b','c','d']);
  await page.selectOption('#folhasFiltro_tecnico','t1');assert.deepEqual(await rowIds(), ['a','c','d']);
  await page.getByRole('button',{name:'Limpar filtros'}).click();assert.equal(await rows().count(),4);
  await page.evaluate(() => failWrite=true);await page.locator('[data-folha-faturacao="a"]').click();
  await page.waitForFunction(() => mensagens.some(m=>m.includes('Não foi possível confirmar a alteração')));
  assert.equal(await page.evaluate(() => historyRows.filter(r=>r.folha_id==='a').length),0);
  await page.evaluate(() => {failWrite=false;usuarioLogado={id:'t1',adminId:'tenant',role:'funcionario'};renderizarFolhas();});
  await page.waitForFunction(() => document.getElementById('folhasGrupoInfo_concluidas').textContent.includes('por faturar'));
  await page.locator('#folhasGrupo_concluidas').click();
  assert.deepEqual(await rowIds(), ['a','c','d']);assert.equal(await page.locator('[data-folha-faturacao]').count(),0);
  assert.equal(await page.locator('#folhasFiltro_tecnico option').count(),2);
  assert.equal(await page.evaluate(() => calls.filter(c=>c.mode==='insert'&&c.table!=='tg_teste_folhas_faturacao').length),0);
  await page.evaluate(() => {usuarioLogado={id:'tenant',role:'admin'};renderizarFolhas();});
  await page.waitForFunction(() => document.getElementById('folhasGrupoInfo_concluidas').textContent.includes('por faturar'));
  await page.locator('#folhasGrupo_concluidas').click();
  for(const width of [1440,390])for(const dark of [false,true]){
   await page.setViewportSize({width,height:1100});await page.evaluate(d=>document.body.classList.toggle('dark-mode',d),dark);
   assert.equal(await page.locator('#folhasGrupos').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
   assert.equal(await page.locator('#folhasFiltros').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
   await page.screenshot({path:(process.env.QA_OUTPUT || '/tmp')+'/folhas-workflow-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
  }
  await page.evaluate(() => failRead=true);await page.evaluate(() => tgFolhasAtualizar());
  assert.equal(await rows().count(),0);assert.match(await page.locator('#folhasEstadoAviso').innerText(),/Não foi possível/);
  assert.equal(await page.locator('[data-folha-faturacao]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: só validadas em Concluídas, movimento/reversão individual, conclusão sem validação mantém origem, faturação bloqueada em obra aberta, permissões, filtros, rede, mobile/dia/noite.');
 } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
