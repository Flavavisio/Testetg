const fs=require('node:fs'), assert=require('node:assert/strict'), {chromium}=require('playwright');
const main=fs.readFileSync('app-principal.js','utf8');
const fn=name=>{const m=main.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'));if(!m)throw Error(name);return m[0];};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BINARY,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:1000},locale:'pt-PT'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<div id="cardsGrid" class="cards-grid"><div id="omeudia"></div><div id="dashboardGrupos"><div class="grupo-cards" data-grupo="equipa"><div class="grupo-header"><h3>Equipa</h3></div><div class="card-principal" data-card="funcionarios"></div></div><div class="grupo-cards" data-grupo="obras"><div class="grupo-header"><h3>Obras e Serviços</h3></div><div class="card-principal" data-card="servicos"></div></div></div></div><nav id="menuInferiorMobile"></nav><div id="painelGrupoMobile" style="display:none"></div><div class="section-container" id="secao-calendario-equipa"><div id="calMesLabel"></div><table id="tabelaCalendarioEquipa"></table><div id="emptyCalendarioEquipa"></div></div>`);
  for(const file of ['styles.css','tg-supervisor-home.css'])await page.addStyleTag({content:fs.readFileSync(file,'utf8')});
  await page.addScriptTag({content:`
   window.usuarioLogado={id:'manager',adminId:'tenant',role:'encarregado'};
   window.today='2026-10-23';
   window.dados={administradores:[{id:'tenant',layout:'aurora'}],
    encarregados:[{id:'manager',adminId:'tenant',nome:'André Gomes',funcionariosIds:['os','work','general','done','idle','suspended',...Array.from({length:8},(_,i)=>'extra'+i),'foreign','admin-record']},{id:'other-manager',adminId:'tenant',nome:'Outro encarregado'}],
    funcionarios:[...['os','work','general','done','idle','suspended'].map((id,i)=>({id,adminId:'tenant',nome:['Ana','Bruno','Carla','Daniel','Eva','Filipe'][i],suspenso:id==='suspended'})),...Array.from({length:8},(_,i)=>({id:'extra'+i,adminId:'tenant',nome:'Técnico '+(i+1)})),{id:'secret',adminId:'tenant',nome:'PESSOA NÃO ATRIBUÍDA'},{id:'foreign',adminId:'foreign',nome:'OUTRA EMPRESA'},{id:'admin-record',adminId:'tenant',role:'admin',nome:'ADMIN PRIVADO'}],
    clientes:[{id:'mine',adminId:'tenant',nome:'Cliente pessoal'},{id:'team',adminId:'tenant',nome:'Cliente da equipa'},{id:'secret',adminId:'tenant',nome:'CLIENTE PRIVADO'},{id:'foreign',adminId:'foreign',nome:'CLIENTE ESTRANGEIRO'}],
    servicos:[{id:'own-os',adminId:'tenant',clienteId:'mine',data:today,hora:'09:00',status:'pendente',funcionariosIds:['manager'],descricao:'O meu serviço'},
     {id:'team-os',adminId:'tenant',clienteId:'team',data:today,hora:'10:00',status:'em andamento',funcionariosIds:['os','secret']},
     {id:'done-os',adminId:'tenant',clienteId:'team',data:today,hora:'13:00',status:'concluído',funcionariosIds:['done']},
     {id:'cancelled-os',adminId:'tenant',clienteId:'team',data:today,status:'cancelado',funcionariosIds:['os']},
     {id:'private-os',adminId:'tenant',clienteId:'secret',data:today,status:'pendente',funcionariosIds:['secret']},
     {id:'foreign-os',adminId:'foreign',clienteId:'foreign',data:today,status:'pendente',funcionariosIds:['manager','os']}],
    obras:[{id:'team-work',adminId:'tenant',nome:'Obra da equipa',estado:'ativa',responsaveisIds:['work']}],
    ponto:[{id:'p1',adminId:'tenant',funcionarioId:'os',servicoId:'team-os',data:today,entrada:'10:00'},
     {id:'p2',adminId:'tenant',funcionarioId:'general',data:today,entrada:'08:00'},
     {id:'p3',adminId:'tenant',funcionarioId:'done',data:today,entrada:'08:00',saida:'12:00'},
     {id:'p4',adminId:'tenant',funcionarioId:'done',servicoId:'done-os',data:today,entrada:'13:00',saida:'17:00'},
     {id:'p5',adminId:'foreign',funcionarioId:'idle',data:today,entrada:'08:00'}],
    obraPontoLonga:[{id:'w1',adminId:'tenant',funcionarioId:'work',obraId:'team-work',data:today,entrada:'08:00'}],pedidos:[],obraMateriais:[],artigos:[]};
   window.getDataHoje=()=>today;window.adminDoUtilizador=()=>dados.administradores[0];window.obterConfig=()=>({layout:'aurora'});
   window.expressAtivo=()=>false;window._tgmMostrarTempo=()=>{};window._osMapaInfo=()=>null;window._obraLongaPontoAberto=()=>null;window._botaoPontoObraHTML=()=>'';window._moradaCompletaObra=()=>'';
   window.obterNomeCliente=id=>dados.clientes.find(c=>c.id===id&&c.adminId==='tenant')?.nome||'';
   window.escapeHtmlSimples=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window._htmlPainelAdminHoje=()=>'<div>PAINEL ADMIN ORIGINAL</div>';window._htmlResumoEquipaHoje=()=>'<div>RESUMO ADMIN ORIGINAL</div>';
   window._ultimoGrupoMobileAberto=null;window._calMesRef=new Date('2026-10-01T12:00:00');window.feriadosNacionais=()=>[];window.feriadoMunicipal=()=>null;
   window.opened=[];window.abrirVerOS=id=>opened.push(id);
  `});
  await page.addScriptTag({content:['_estadoPresencaPessoa','obterLayout','_dispositivoEhMobile','_ehPerfilMobile','_montarMenuInferiorMobile','_fecharSecaoAbertaMobile','_voltarMeuDia','renderizarOMeuDia','renderizarCalendarioEquipa','_gerarLinhasCalendarioMes'].map(fn).join('\n')});
  await page.addScriptTag({content:fs.readFileSync('tg-supervisor-home.js','utf8')});
  await page.evaluate(()=>{renderizarOMeuDia();_montarMenuInferiorMobile();});
  assert.equal(await page.evaluate(()=>obterLayout()),'cards');assert.equal(await page.evaluate(()=>_ehPerfilMobile()),true);
  assert.equal(await page.locator('#omeudia .tgm-panel--dia').isVisible(),true);
  assert.equal(await page.locator('#tgm-os-own-os').count(),1);assert.equal(await page.locator('#tgm-os-team-os').count(),0);
  assert.equal(await page.locator('#menuInfHome').count(),1);assert.equal(await page.locator('#menuInf_equipa').count(),1);assert.equal(await page.locator('#menuInfDashboardCentral').count(),0);
  assert.equal(await page.locator('[data-supervisor-person]').count(),14); // no 12-person truncation
  for(const [id,label] of [['os','Em OS — Cliente da equipa'],['work','Em Obra — Obra da equipa'],['general','Em serviço'],['done','Terminou o dia'],['idle','Ainda não começou'],['suspended','Suspenso']]){
   assert.match(await page.locator('[data-supervisor-person="'+id+'"]').innerText(),new RegExp(label));
  }
  assert.deepEqual(await page.locator('[data-supervisor-os]').evaluateAll(es=>es.map(e=>e.dataset.supervisorOs)),['own-os','team-os','done-os']);
  assert.doesNotMatch(await page.locator('#omeudia').innerText(),/PESSOA NÃO ATRIBUÍDA|OUTRA EMPRESA|ADMIN PRIVADO|Outro encarregado|CLIENTE PRIVADO|CLIENTE ESTRANGEIRO|€|Aprovar férias|Enviar notificação|PAINEL ADMIN/);
  await page.locator('[data-supervisor-os="team-os"]').click();assert.deepEqual(await page.evaluate(()=>opened),['team-os']);
  // Revocation takes effect at click time, before a row has even been rerendered.
  await page.evaluate(()=>{dados.encarregados[0].funcionariosIds=dados.encarregados[0].funcionariosIds.filter(id=>id!=='os');});
  await page.locator('[data-supervisor-os="team-os"]').click();assert.deepEqual(await page.evaluate(()=>opened),['team-os']);
  await page.evaluate(()=>renderizarOMeuDia());assert.equal(await page.locator('[data-supervisor-person="os"]').count(),0);assert.equal(await page.locator('[data-supervisor-os="team-os"]').count(),0);
  await page.evaluate(()=>{dados.encarregados[0].funcionariosIds.push('os');renderizarOMeuDia();renderizarOMeuDia();});
  assert.equal(await page.locator('.tgs-supervisor-panel').count(),2);
  const snapshot=await page.evaluate(()=>JSON.stringify(dados));
  await page.evaluate(()=>renderizarCalendarioEquipa());
  assert.equal(await page.locator('#tabelaCalendarioEquipa tbody tr').count(),15);
  assert.doesNotMatch(await page.locator('#tabelaCalendarioEquipa').innerText(),/PESSOA NÃO ATRIBUÍDA|OUTRA EMPRESA|ADMIN PRIVADO|Outro encarregado/);
  const exported=await page.evaluate(()=>_gerarLinhasCalendarioMes('tenant',2026,9));
  assert.equal(exported.pessoas.length,15);assert.equal(exported.linhas.length,15);
  assert.equal(await page.evaluate(()=>_gerarLinhasCalendarioMes('foreign',2026,9).linhas.length),0);
  assert.equal(await page.evaluate(()=>JSON.stringify(dados)),snapshot);
  // A reassigned team member disappears from the calendar/export as well.
  await page.evaluate(()=>{dados.encarregados[0].funcionariosIds=['work'];renderizarCalendarioEquipa();renderizarOMeuDia();});
  assert.equal(await page.locator('[data-supervisor-person]').count(),1);assert.equal(await page.locator('#tabelaCalendarioEquipa tbody tr').count(),2);
  await page.evaluate(()=>{dados.encarregados[0].funcionariosIds=[];renderizarOMeuDia();});assert.match(await page.locator('#omeudia').innerText(),/Ainda não tens funcionários atribuídos/);
  // Missing supervisor records and other roles never fall back to all company employees.
  await page.evaluate(()=>{dados.encarregados[0].funcionariosIds=['os','work','general','done','idle'];renderizarOMeuDia();});
  for(const width of [390,768])for(const dark of [false,true]){
   await page.setViewportSize({width,height:1000});await page.evaluate(d=>{document.body.classList.toggle('dark-mode',d);renderizarOMeuDia();_montarMenuInferiorMobile();},dark);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:(process.env.QA_OUTPUT||'/tmp')+'/supervisor-home-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
  }
  for(const role of ['funcionario','cliente','admin','subadmin']){
   await page.evaluate(role=>usuarioLogado={id:role==='admin'?'tenant':'someone',adminId:'tenant',role},role);
   assert.equal(await page.evaluate(()=>TGSupervisorHome.html('tenant',today)),'');assert.equal(await page.evaluate(()=>TGSupervisorHome.people('tenant',true).length),0);
  }
  await page.evaluate(()=>{usuarioLogado={id:'manager',adminId:'tenant',role:'encarregado'};dados.encarregados=[];renderizarOMeuDia();});
  assert.equal(await page.locator('[data-supervisor-person]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile Nexus, dia próprio, equipa atribuída completa, estados, OS sem nomes externos, remoção imediata, calendário/exportação, conta/empresa, vazios, dia/noite e zero alterações aos registos.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
