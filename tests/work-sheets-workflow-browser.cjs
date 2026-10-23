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
     {id:'d',adminId:'tenant',servicoId:'os2',funcionarioId:'t1',horasTrabalhadas:2,data:'2026-10-19'},
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
  assert.deepEqual(await rowIds(), ['a','b','c','f','g']);
  assert.equal(await page.locator('#folhasGrupoNumero_obras').innerText(), '5');
  assert.equal(await page.locator('#folhasGrupoNumero_os').innerText(), '1');
  assert.equal(await page.locator('#folhasGrupoNumero_concluidas').innerText(), '3');
  assert.match(await page.locator('[data-folha-id="g"]').innerText(), /Sem Obra\/OS associada/);
  // The open OS cannot be validated, including a direct call from a stale row.
  assert.equal(await page.locator('[data-folha-validacao="c"]').isDisabled(),true);
  const beforeValidation=await page.evaluate(()=>calls.filter(c=>c.mode==='rpc').length);
  await page.evaluate(()=>tgFolhasValidar('c'));
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.mode==='rpc').length),beforeValidation);
  assert.match(await page.evaluate(()=>mensagens.at(-1)),/Termina a OS/);
  // A finished OS in an unfinished work can be validated but cannot be billed.
  await page.evaluate(()=>{dados.servicos.find(s=>s.id==='os1').status='concluído';dados.obras.find(o=>o.id==='w1').valor=5000;renderizarFolhas();});
  assert.match(await page.locator('[data-folha-id="c"]').innerText(),/OS terminada · Obra em curso/);
  assert.equal(await page.locator('[data-folha-validacao="c"]').isDisabled(),false);
  await page.locator('[data-folha-validacao="c"]').click();
  await page.waitForFunction(()=>dados.folhasObra.find(f=>f.id==='c').validada===true);
  assert.deepEqual(await rowIds(),['a','b','c','f','g']);
  assert.equal(await page.locator('[data-folha-id="c"] [data-folha-faturacao]').count(),0);
  assert.equal(await page.evaluate(()=>dados.obras.find(o=>o.id==='w1').valor),5000);
  const nBilling=await page.evaluate(()=>calls.filter(c=>c.mode==='insert').length);
  await page.evaluate(()=>tgFolhasFaturar('c'));
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.mode==='insert').length),nBilling);
  await page.screenshot({path:(process.env.QA_OUTPUT || '/tmp')+'/folhas-obra-em-curso-os-terminada.png',fullPage:true});
  // A finished work does not validate an OS which is still open.
  assert.equal(await page.locator('[data-folha-validacao="f"]').isDisabled(),true);
  await page.locator('#folhasGrupo_os').click();assert.deepEqual(await rowIds(), ['i']);
  assert.equal(await page.locator('[data-folha-id="i"] [data-folha-faturacao]').count(),0);
  assert.equal(await page.locator('[data-folha-validacao="i"]').isDisabled(),true);
  await page.locator('#folhasGrupo_concluidas').click();assert.deepEqual(await rowIds(), ['e','h']);
  assert.match(await page.locator('[data-folha-id="h"]').innerText(), /Cliente Alfa.*OS antiga/s);
  await page.locator('[data-folha-faturacao="e"]').click();
  await page.waitForFunction(() => historyRows.some(r => r.folha_id==='e' && r.faturada));
  assert.deepEqual(await rowIds(), ['h']);
  await page.locator('#folhasTab_faturadas').click();assert.deepEqual(await rowIds(), ['d','e']);
  await page.evaluate(() => tgFolhasAtualizar());assert.deepEqual(await rowIds(), ['d','e']);
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
  // Completion is derived from the parent, never a sheet validation/paid flag.
  await page.evaluate(() => {dados.obras.find(o=>o.id==='w1').estado='concluida';renderizarFolhas();});
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
  console.log('PASS: grupos, estados dos pais, OS antigas, avulsas, filtros, faturação persistente, reversão com motivo, subadmin/funcionário, falhas de rede, ecrã pequeno e modo escuro.');
 } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
