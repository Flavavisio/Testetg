const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const src=fs.readFileSync('app-principal.js','utf8');
const helpers=src.slice(src.indexOf('        function _acaoPendenciasAlerta('),src.indexOf('        // ==================== ARMAZÉM / STOCK',src.indexOf('        function _acaoPendenciasAlerta(')));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BINARY,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div id="alertasPendencias"></div>');
 await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});
 await page.addScriptTag({content:`
 window.usuarioLogado={role:'admin',id:'tenant'};
 window.calls=[];window.mobile=false;
 window.dados={administradores:[{id:'tenant'}],servicos:[{id:'one',adminId:'tenant',status:'pendente',descricao:'OS um'},{id:'two',adminId:'tenant',status:'pendente',descricao:'OS dois'},{id:'done',adminId:'tenant',status:'concluido'},{id:'foreign',adminId:'other',status:'pendente'}]};
 window._tenantId=()=>usuarioLogado.adminId||usuarioLogado.id;
 window.escapeHtmlSimples=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.moduloAssistAtivo=window.moduloContratosAtivo=window.moduloArmazemAtivo=()=>false;
 window.adminAtual=()=>dados.administradores[0];window._ehPerfilMobile=()=>mobile;
 window.abrirVerOS=id=>calls.push(['os',id]);window.abrirModalContrato=id=>calls.push(['contrato',id]);
 window.abrirModalVeiculo=id=>calls.push(['veiculo',id]);window.abrirObraLongaDetalhe=id=>calls.push(['obra',id]);
 window.abrirModal=(tipo,id)=>calls.push([tipo,id]);window.mostrarErro=s=>calls.push(['erro',s]);
 window.obterNomeFuncionario=id=>'Pessoa '+id;window.obterNomeCliente=id=>'Cliente '+id;
 window.aprovarPedido=id=>calls.push(['aprovar',id]);window.rejeitarPedido=id=>calls.push(['rejeitar',id]);
 window._assistResumoDados=()=>({cliente:'Cliente',local:'Sede',urgencia:'Normal'});
 window._abrirAssist=(ev,id)=>calls.push(['criarOS',id]);
 `+helpers});
 await page.evaluate(()=>renderizarAlertas());
 await page.getByText('2 ordens de serviço pendentes',{exact:true}).click();
 assert.equal(await page.locator('#tgPendenciasOverlay button').count(),3);
 assert(!await page.locator('#tgPendenciasOverlay').innerText().then(s=>s.includes('foreign')));
 await page.getByRole('button',{name:'OS dois',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>calls),[['os','two']]);
 await page.evaluate(()=>{dados.servicos=dados.servicos.filter(s=>s.id!=='two');renderizarAlertas();});
 await page.locator('.alerta-linha').filter({hasText:'1 ordem de serviço pendente'}).press('Enter');
 assert.deepEqual(await page.evaluate(()=>calls.at(-1)),['os','one']);
 assert.equal(await page.locator('#tgPendenciasOverlay').count(),0);
 for(const role of ['admin','subadmin']){
  await page.evaluate(role=>{usuarioLogado=role==='admin'?{role,id:'tenant'}:{role,id:'sub',adminId:'tenant'};calls=[];_abrirPendenciasAlerta('servico',['foreign']);},role);
  assert.equal(await page.evaluate(()=>calls[0][0]),'erro');
 }
 await page.evaluate(()=>{calls=[];dados.pedidos=[{id:'p',adminId:'tenant',tipo:'ferias',funcionarioId:'f',dataInicio:'2026-11-01',dataFim:'2026-11-02',status:'pendente_aprov'}];_abrirPendenciasAlerta('pedido',['p']);});
 assert.equal(await page.locator('#tgPendenciasOverlay').count(),1);
 assert.deepEqual(await page.evaluate(()=>calls),[]);
 await page.getByRole('button',{name:'Aprovar',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>calls),[['aprovar','p']]);
 await page.evaluate(()=>{calls=[];dados.assistencias=[{id:'a',adminId:'tenant',assunto:'Alarme',descricao:'Verificar sensor'}];_abrirPendenciasAlerta('assistencia',['a']);});
 assert.deepEqual(await page.evaluate(()=>calls),[]); // opening never creates a service order
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{mobile=true;dados.servicos.push({id:'two',adminId:'tenant',status:'pendente',descricao:'OS dois'});renderizarAlertas();});
 await page.locator('.alertas-h--acordeao').click();await page.getByText('2 ordens de serviço pendentes',{exact:true}).click();
 assert.equal(await page.locator('#tgPendenciasOverlay').count(),1);
 const rect=await page.locator('#tgPendenciasOverlay .modal').boundingBox();assert(rect.width<=390);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#tgPendenciasOverlay').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: scoped groups, direct OS, keyboard, mobile, tenant boundaries, explicit approval and read-only assistance opening');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
