const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('app-principal.js','utf8'),native=fs.readFileSync('tg-assist-native.js','utf8'),host=fs.readFileSync('tg-integrated-modules.js','utf8');
function setup(){
 const dom=new JSDOM(`<body><header id="shell">TG</header><div id="cardsGrid"><a class="card-principal" data-card="assistencias"></a><a class="card-principal" data-card="crm"></a></div><div id="wsClienteOverlay"></div><div class="modal-overlay" id="modalGenericoOverlay"><div class="modal"><h3 id="modalGenericoTitulo"></h3><form id="modalGenericoForm"><div id="modalGenericoCampos"></div><div id="modalGenericoAcoes"><button type="submit">Guardar</button></div></form></div></div></body>`,{url:'https://tg.test/login.html',runScripts:'dangerously'}),w=dom.window;
 w.usuarioLogado={id:'admin',role:'admin',nome:'Admin'};w.admin={id:'admin'};w.license=true;w.calls=[];w.alert=x=>w.calls.push(['alert',x]);w.confirm=()=>true;
 w.dados={administradores:[{id:'admin',empresa:'Empresa'}],clientes:[{id:'c',adminId:'admin',nome:'Cliente <Teste>'}],locais:[{id:'l',adminId:'admin',clienteId:'c',nome:'Instalação Centro'}],funcionarios:[{id:'f',adminId:'admin',nome:'Técnico',ativo:true}],encarregados:[],servicos:[],assistencias:[{id:'a',adminId:'admin',clienteId:'c',localId:'l',numero:'AST-001',assunto:'Alarme',estado:'aberta',prioridade:'alta',descricao:'Sem sinal',notas:[{texto:'Nota anterior',autor:'Ana',data:1}],dataCriacao:Date.now()},{id:'other',adminId:'tenant-b',assunto:'Segredo',notas:[]}]};
 w._tenantId=()=>w.usuarioLogado?.role==='admin'?w.usuarioLogado.id:w.usuarioLogado?.adminId;w._licencaValidaTenant=()=>w.license;w.adminDoUtilizador=()=>w.admin;w.moduloAssistAtivo=()=>true;w.moduloCrmAtivo=()=>true;
 w._pessoasParaAtribuir=()=>w.dados.funcionarios.filter(f=>f.adminId===w._tenantId());w.obterNomeFuncionario=id=>w.dados.funcionarios.find(f=>f.id===id)?.nome||'Por atribuir';w._empresaIniciais=()=> 'EMP';w.getDataHoje=()=> '2026-10-28';w.gerarId=()=> 'new-'+Math.random();w.gerarNumeroRegistoServidor=async()=> 'OS-009';w.gerarNumeroRegisto=()=> 'OS-fallback';
 w.escapeHtmlSimples=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));w.guardarDados=async()=>{w.calls.push(['save'])};w._notificarFuncionario=(...args)=>w.calls.push(['notify',...args]);w._bloquearSeAusenteEmOS=()=>false;w.renderizarTudo=()=>w.document.dispatchEvent(new w.Event('tg:interface-updated'));w.irParaInicio=()=>w.document.querySelectorAll('.section-container').forEach(e=>e.classList.remove('active'));w.abrirVerOS=id=>w.calls.push(['viewOS',id]);w._fecharModalGenerico=()=>w.document.getElementById('modalGenericoOverlay').classList.remove('open');
 w.abrirSecao=name=>{if(!w.TGModules.prepare(name))return;w.document.querySelectorAll('.section-container').forEach(e=>e.classList.toggle('active',e.id==='secao-'+name))};
 w.eval(source.slice(0,source.indexOf('\n}')+2));w.eval(native);w.eval(host);return {dom,w};
}
test('native entry uses the existing TG section, records, indicators and filters without iframe',()=>{const {dom,w}=setup();try{
 w.TGModules.open('assistencias');assert.equal(w.document.querySelectorAll('#secao-assistencias iframe').length,0);assert(w.document.getElementById('shell').isConnected);assert(w.document.getElementById('tgAssistResults').textContent.includes('Instalação Centro'));assert(!w.document.getElementById('tgAssistResults').textContent.includes('Segredo'));
 const input=w.document.getElementById('tgAssistSearch');input.value='Não existe';input.dispatchEvent(new w.Event('input'));assert.match(w.document.getElementById('tgAssistResults').textContent,/Sem assistências/);input.value='';input.dispatchEvent(new w.Event('input'));
 w.TGAssistNative.mudarTabCRM('dashboard');assert.equal(w.document.getElementById('assistDashAbertas').textContent,'1');
}finally{dom.window.close()}});
test('edit, notes and OS creation reuse host saving and keep linked installation/duration',async()=>{const {dom,w}=setup();try{
 w.TGModules.open('assistencias');w.TGAssistNative.abrirModalAssistencia('a');const d=w.document;
 assert.equal(d.getElementById('assist_assunto').value,'Alarme');assert.match(d.getElementById('assist_notas_lista').textContent,/Nota anterior/);
 d.getElementById('assist_nova_nota').value='Nova nota';await w.TGAssistNative.adicionarNotaAssistencia('a');assert.equal(w.dados.assistencias[0].notas.length,2);
 d.getElementById('assist_assunto').value='Alarme reparado';await w.TGAssistNative.guardarAssistencia('a');assert.equal(w.dados.assistencias[0].assunto,'Alarme reparado');
 w.TGAssistNative.criarOSDeAssistencia('a');d.getElementById('assistOsDuracao').value='120';d.querySelector('.assist-os-func-chk').checked=true;
 await w.TGAssistNative._confirmarCriarOSDeAssistencia('a');assert.equal(w.dados.servicos.length,1);assert.equal(w.dados.servicos[0].localId,'l');assert.equal(w.dados.servicos[0].duracao,120);assert.equal(w.dados.assistencias[0].osGeradaId,w.dados.servicos[0].id);assert(w.calls.filter(c=>c[0]==='save').length>=3);
 w.TGAssistNative.criarOSDeAssistencia('a');assert.equal(d.getElementById('modalGenericoOverlay').classList.contains('open'),false);
}finally{dom.window.close()}});
test('cross-tenant actions, revoked license and a session switch during numbering fail closed',async()=>{const {dom,w}=setup();try{
 w.TGModules.open('assistencias');w.TGAssistNative.abrirModalAssistencia('other');assert(!w.document.getElementById('modalGenericoOverlay').classList.contains('open'));
 w.TGAssistNative.criarOSDeAssistencia('a');let finish;w.gerarNumeroRegistoServidor=()=>new Promise(r=>finish=r);const pending=w.TGAssistNative._confirmarCriarOSDeAssistencia('a');w.usuarioLogado={id:'new',role:'admin'};finish('OS-late');await assert.rejects(pending,/sessão/);assert.equal(w.dados.servicos.length,0);
 w.TGModules.validate();assert.equal(w.document.getElementById('secao-assistencias'),null);assert(!w.document.getElementById('modalGenericoOverlay').classList.contains('open'));
 w.usuarioLogado={id:'admin',role:'admin'};w.license=false;w.TGModules.open('assistencias');assert.equal(w.document.getElementById('secao-assistencias'),null);
}finally{dom.window.close()}});
test('host mapping preserves the existing assistance notes column in both directions',()=>{
 const parse=source.slice(0,source.indexOf('\n}')+2);const ctx=setup();try{ctx.w.eval(parse);assert.equal(ctx.w._assistLerNotas('[{"texto":"guardada"}]')[0].texto,'guardada');assert.equal(ctx.w._assistLerNotas('invalid').length,0);const start=source.indexOf('            assistencias: {'),end=source.indexOf('\n            },',start);const mapping=source.slice(start,end);assert.match(mapping,/notas:\s*_assistLerNotas\(r.notas\)/);assert.match(mapping,/notas:\s*_assistLerNotas\(o.notas\)/);}finally{ctx.dom.window.close()}
});

test('legacy cached records load their history with a tenant-scoped read before editing',async()=>{const {dom,w}=setup();try{
 w.TGModules.open('assistencias');delete w.dados.assistencias[0].notas;const query=[];
 w.supa={from(table){query.push(['from',table]);return{select(col){query.push(['select',col]);return this},eq(key,value){query.push(['eq',key,value]);return this},async maybeSingle(){return{data:{notas:[{texto:'Histórico já guardado',autor:'Ana'}]},error:null}}}}};
 await w.TGAssistNative.abrirModalAssistencia('a');assert.match(w.document.getElementById('assist_notas_lista').textContent,/Histórico já guardado/);
 assert.deepEqual(query,[['from','assistencias'],['select','notas'],['eq','id','a'],['eq','admin_id','admin']]);
}finally{dom.window.close()}});

test('two states and four counter buckets include legacy records and linked OS assignments',async()=>{const {dom,w}=setup();try{
 const d=w.document;
 w.dados.assistencias.push(
 {id:'assigned',adminId:'admin',estado:'andamento',atribuidoId:'f',assunto:'Atribuída'},
 {id:'linked',adminId:'admin',estado:'aberta',osGeradaId:'os1',assunto:'Com OS'},
 {id:'resolved',adminId:'admin',estado:'resolvida',assunto:'Resolvida'},
 {id:'closed',adminId:'admin',estado:'fechada',assunto:'Antiga fechada'},
 {id:'unassigned',adminId:'admin',estado:'andamento',assunto:'Antiga sem atribuição'},
 {id:'foreignOS',adminId:'admin',estado:'aberta',osGeradaId:'otherOS',assunto:'Sem técnico'},
 {id:'deleted',adminId:'admin',estado:'aberta',apagadoSuperAdmin:true});
 w.dados.servicos.push({id:'os1',adminId:'admin',funcionariosIds:['f']},{id:'otherOS',adminId:'other',funcionarioId:'foreign'});
 w.TGModules.open('assistencias');
 const button=state=>d.querySelector(`#tgAssistMetrics [data-state="${state}"]`);
 const count=state=>Number(button(state).querySelector('strong').textContent);
 const results=()=>d.querySelectorAll('#tgAssistResults tbody tr').length;
 assert.deepEqual([...d.querySelectorAll('#tgAssistMetrics button')].map(b=>b.dataset.state),['sem_atribuicao','atribuidas','resolvida','']);
 assert.equal(count(''),7);assert.equal(count('sem_atribuicao'),3);assert.equal(count('atribuidas'),2);assert.equal(count('resolvida'),2);
 assert.deepEqual([...d.querySelectorAll('#assistFiltroEstado option')].map(o=>o.value),['','aberta','resolvida']);
 for(const [state,n] of [['sem_atribuicao',3],['atribuidas',2],['resolvida',2],['',7]]){button(state).querySelector('strong').click();assert.equal(results(),n);assert.equal(button(state).getAttribute('aria-pressed'),'true');}
 const select=d.getElementById('assistFiltroEstado');select.value='aberta';select.dispatchEvent(new w.Event('change'));assert.equal(results(),5);
 button('atribuidas').click();const search=d.getElementById('tgAssistSearch');search.value='Com OS';search.dispatchEvent(new w.Event('input'));assert.equal(results(),1);assert.equal(count('atribuidas'),2);
 search.value='';search.dispatchEvent(new w.Event('input'));
 w.dados.assistencias.find(a=>a.id==='assigned').estado='resolvida';w.TGAssistNative.render();assert.equal(count('atribuidas'),1);assert.equal(count('resolvida'),3);assert.equal(results(),1);
 await w.TGAssistNative.abrirModalAssistencia('a');assert.deepEqual([...d.querySelectorAll('#assist_estado option')].map(o=>o.value),['aberta','resolvida']);d.getElementById('assist_estado').value='resolvida';await w.TGAssistNative.guardarAssistencia('a');assert.equal(w.dados.assistencias[0].estado,'resolvida');
}finally{dom.window.close()}});

test('host persistence reads and writes only the two canonical assistance states',()=>{const {dom,w}=setup();try{
 w.eval(source.match(/function _assistEstado\(value\) \{[\s\S]*?\n\}/)[0]);w.isoToMs=v=>v;w.msToISO=v=>v;
 const start=source.indexOf('            assistencias: {'),end=source.indexOf('\n            },',start);
 const mapping=w.eval('({'+source.slice(start,end)+'}}).assistencias');
 for(const [old,expected] of [['aberta','aberta'],['andamento','aberta'],['em_tratamento','aberta'],['resolvida','resolvida'],['fechada','resolvida'],[null,'aberta']]){
  assert.equal(mapping.from({estado:old}).estado,expected);assert.equal(mapping.to({estado:old}).estado,expected);
 }
 const fo=source.match(/<select id="fo_estado_assistencia"[\s\S]*?<\/select>/)[0];assert.match(fo,/value="aberta"/);assert.match(fo,/value="resolvida"/);assert.doesNotMatch(fo,/value="andamento"|value="fechada"/);
}finally{dom.window.close()}});

test('locality filter uses the installation or headquarters, remains tenant-scoped and combines with other filters',()=>{const {dom,w}=setup();try{
 const d=w.document;w.dados.clientes[0].cidade='Porto';w.dados.locais[0].cidade='Lisboa';
 w.dados.clientes.push({id:'c2',adminId:'admin',nome:'Cliente Sul',cidade:'Faro'});
 w.dados.locais.push({id:'no-city',adminId:'admin',clienteId:'c',nome:'Sem cidade'},{id:'foreign-local',adminId:'other',clienteId:'c',cidade:'Segredo'});
 w.dados.assistencias.push({id:'sede',adminId:'admin',clienteId:'c2',estado:'aberta',assunto:'Sede Sul',prioridade:'normal'},{id:'unknown',adminId:'admin',clienteId:'c',localId:'no-city',estado:'aberta',assunto:'Instalação desconhecida'},{id:'invalid',adminId:'admin',clienteId:'c',localId:'foreign-local',estado:'resolvida',assunto:'Não revelar cidade'});
 w.TGModules.open('assistencias');const select=d.getElementById('assistFiltroLocalidade');
 assert.deepEqual([...select.options].map(o=>o.textContent),['Todas as localidades','Faro','Lisboa','Sem localidade indicada']);assert(!select.textContent.includes('Segredo'));assert(!select.textContent.includes('Porto'));
 const rows=()=>d.querySelectorAll('#tgAssistResults tbody tr').length;
 select.value='lisboa';select.dispatchEvent(new w.Event('change'));assert.equal(rows(),1);
 d.querySelector('#tgAssistMetrics [data-state="resolvida"]').click();assert.equal(rows(),0);
 d.querySelector('#tgAssistMetrics [data-state=""]').click();assert.equal(rows(),1);
 const search=d.getElementById('tgAssistSearch');search.value='Lisboa';search.dispatchEvent(new w.Event('input'));assert.equal(rows(),1);
 search.value='';search.dispatchEvent(new w.Event('input'));select.value='__sem_localidade__';select.dispatchEvent(new w.Event('change'));assert.equal(rows(),2);
 select.value='';select.dispatchEvent(new w.Event('change'));assert.equal(rows(),4);
}finally{dom.window.close()}});

test('request creation cannot assign a technician; assignment is made when creating the OS and preserved when editing',async()=>{const {dom,w}=setup();try{
 const d=w.document;w.TGModules.open('assistencias');await w.TGAssistNative.abrirModalAssistencia(null);
 assert.equal(d.getElementById('assist_atribuido'),null);assert.equal(d.getElementById('assist_plan_data'),null);
 d.getElementById('assist_cliente').value='c';d.getElementById('assist_assunto').value='Pedido sem atribuição';
 const injected=d.createElement('select');injected.id='assist_atribuido';injected.add(new w.Option('Técnico','f'));d.getElementById('modalGenericoCampos').appendChild(injected);
 await w.TGAssistNative.guardarAssistencia(null);const request=w.dados.assistencias.find(a=>a.assunto==='Pedido sem atribuição');assert(request);assert.equal(request.atribuidoId,null);assert.equal(w.calls.filter(c=>c[0]==='notify').length,0);
 w.TGAssistNative.criarOSDeAssistencia(request.id);assert(d.querySelector('.assist-os-func-chk'));d.querySelector('.assist-os-func-chk').checked=true;
 await w.TGAssistNative._confirmarCriarOSDeAssistencia(request.id);assert.equal(request.atribuidoId,'f');assert(w.dados.servicos.some(os=>os.id===request.osGeradaId&&os.funcionariosIds.includes('f')));assert(w.calls.some(c=>c[0]==='notify'&&c[1]==='f'));
 await w.TGAssistNative.abrirModalAssistencia(request.id);assert.equal(d.getElementById('assist_atribuido'),null);await w.TGAssistNative.guardarAssistencia(request.id);assert.equal(request.atribuidoId,'f');
}finally{dom.window.close()}});

function contractFeature(w){
 w.dados.contratos=[];w.tgConfirm=(message,options)=>{w.calls.push(['tgConfirm',message,options]);return Promise.resolve(false)};w.adminAtual=()=>w.admin;w.moduloContratosAtivo=()=>true;
 w.eval(fs.readFileSync('tg-assist-contracts.js','utf8'));
}
test('customer installation is required, contract reserves once, and OS context is immutable',async()=>{const {dom,w}=setup();try{
 contractFeature(w);const d=w.document;
 w.dados.contratos=[{id:'ct',adminId:'admin',clienteId:'c',localId:'l',numero:'CT-1',dataInicio:'2026-01-01',validadeContrato:'2026-12-31'}];
 w.dados.clientes.push({id:'other-client',adminId:'admin',nome:'Outro'});
 w.TGModules.open('assistencias');await w.TGAssistNative.abrirModalAssistencia(null);
 d.getElementById('assist_cliente').value='c';w.TGAssistNative._assistAtualizarContactosRapidos();
 const local=d.getElementById('assist_local');assert.deepEqual([...local.options].map(o=>o.value),['','__sede__','l']);assert.equal(local.value,'');
 d.getElementById('assist_assunto').value='Visita incluída';await w.TGAssistNative.guardarAssistencia(null);assert.equal(w.dados.assistencias.length,2);
 local.value='l';local.dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('assist_contrato').value,'ct');
 await w.TGAssistNative.guardarAssistencia(null);const a=w.dados.assistencias.find(a=>a.assunto==='Visita incluída');assert.equal(a.localId,'l');assert.equal(a.testeContratoId,'ct');assert.equal(a.testeVisitaAno,2026);assert.equal(a.atribuidoId,null);
 await w.TGAssistNative.abrirModalAssistencia(a.id);await w.TGAssistNative.guardarAssistencia(a.id);assert.equal(a.testeVisitaAno,2026);assert.equal(w.dados.assistencias.filter(x=>x.testeContratoId==='ct').length,1);
 w.TGAssistNative.criarOSDeAssistencia(a.id);assert(d.getElementById('assistOsCliente').disabled);assert(d.getElementById('assistOsLocalNome').readOnly);assert.equal(d.getElementById('assistOsLocal').value,'l');
 d.getElementById('assistOsCliente').value='other-client';await w.TGAssistNative._confirmarCriarOSDeAssistencia(a.id);assert.equal(w.dados.servicos.length,0);
 d.getElementById('assistOsCliente').value='c';d.getElementById('assistOsLocal').value='';await w.TGAssistNative._confirmarCriarOSDeAssistencia(a.id);assert.equal(w.dados.servicos.length,0);
 d.getElementById('assistOsLocal').value='l';await w.TGAssistNative._confirmarCriarOSDeAssistencia(a.id);assert.equal(w.dados.servicos.length,1);assert.equal(w.dados.servicos[0].localId,'l');assert.equal(w.dados.servicos[0].clienteId,'c');assert.equal(w.dados.servicos[0].contratoId,'ct');assert.equal(a.testeVisitaAno,2026);
}finally{dom.window.close()}});

test('potential lists tenant customers and sites without active contracts; popup opens the prefilled contract',async()=>{const {dom,w}=setup();try{
 contractFeature(w);const d=w.document;w._clienteLabel=c=>c.nome;let prompted=0;w.tgConfirm=()=>{prompted++;return Promise.resolve(false);};
 w.dados.clientes.push({id:'foreign',adminId:'other',nome:'Segredo'});w.dados.locais.push({id:'l2',adminId:'admin',clienteId:'c',nome:'Outra loja'});
 w.dados.contratos=[{id:'ct',adminId:'admin',clienteId:'c',localId:'l',dataInicio:'2026-01-01',validadeContrato:'2026-12-31'},{id:'expired',adminId:'admin',clienteId:'c',localId:'l2',validadeContrato:'2025-12-31'}];
 assert.equal(w.TGAssistContracts.potential().length,0);w.dados.assistencias.push({id:'lead',adminId:'admin',clienteId:'c',localId:'l2',estado:'aberta',assunto:'Pedido sem contrato'});assert.deepEqual(Array.from(w.TGAssistContracts.potential(),r=>r.client.id),['c']);
 w.TGModules.open('assistencias');d.querySelector('[data-assist-action=potential]').click();assert(d.querySelector('[data-potential-action=sites]'));d.querySelector('[data-potential-action=sites]').click();assert.match(d.getElementById('tgAssistPotentialPane').textContent,/Sede/);assert(!d.getElementById('tgAssistPotentialPane').textContent.includes('Segredo'));
 d.querySelector('#tgAssistMetrics [data-state=""]').click();assert(d.getElementById('tgAssistPotentialPane').hidden);assert(!d.getElementById('tgAssistResults').hidden);
 await w.TGAssistNative.abrirModalAssistencia(null);d.getElementById('assist_cliente').value='c';w.TGAssistNative._assistAtualizarContactosRapidos();const local=d.getElementById('assist_local');local.value='l2';local.dispatchEvent(new w.Event('change'));assert.equal(prompted,1);assert.match(d.getElementById('assistContractSummary').textContent,/Potencial para contrato/);
 w.abrirModalContrato=()=>{d.body.insertAdjacentHTML('beforeend','<input id="ct_cliente"><input id="ct_cliente_busca"><select id="ct_local"><option value=""></option><option value="l2"></option></select>')};w.onClienteContratoChange=()=>{};w.onLocalContratoChange=()=>{};
 d.getElementById('assistCreateContract').click();assert.equal(d.getElementById('ct_cliente').value,'c');assert.equal(d.getElementById('ct_local').value,'l2');
}finally{dom.window.close()}});

function customerWorkspace(w){
 contractFeature(w);w._clienteLabel=c=>c.nome;
 w.eval(source.match(/function _assistEstado\(value\) \{[\s\S]*?\n\}/)[0]);
 for(const name of ['_wsAssistAcesso','_wsAssistNovoForm','_wsAssistGuardar','_wsAssistenciasHtml','_wsGerarNumeroAssistencia','_wsAssistBotaoAbrirApp'])w.eval(source.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0]);
 w.document.body.insertAdjacentHTML('beforeend','<div id="wsClienteConteudo"><div id="wsAssistFormArea"></div></div>');
}
test('customer menu creates the same installation-linked contract visit without an initial technician and preserves it on edit',async()=>{const {dom,w}=setup();try{
 customerWorkspace(w);const d=w.document;w.dados.contratos=[{id:'ct',adminId:'admin',clienteId:'c',localId:'l',numero:'CT',validadeContrato:'2026-12-31'}];
 w._wsAssistNovoForm('c');assert.equal(d.getElementById('wsa_cliente').value,'c');assert.equal(d.getElementById('wsa_atribuido'),null);assert.equal(d.getElementById('wsa_local').value,'');
 d.getElementById('wsa_assunto').value='Pedido no cliente';await w._wsAssistGuardar('c',null);assert.equal(w.dados.assistencias.length,2);
 d.getElementById('wsa_local').value='l';d.getElementById('wsa_local').dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('wsa_contrato').value,'ct');
 let finish;w.guardarDados=()=>new Promise(resolve=>finish=resolve);const pending=w._wsAssistGuardar('c',null);await w._wsAssistGuardar('c',null);assert.equal(w.dados.assistencias.length,3);finish();await pending;
 const a=w.dados.assistencias.find(a=>a.assunto==='Pedido no cliente');assert.equal(a.localId,'l');assert.equal(a.atribuidoId,null);assert.equal(a.testeContratoId,'ct');assert.equal(a.testeVisitaAno,2026);assert.match(d.getElementById('wsClienteConteudo').textContent,/Instalação Centro/);
 w.guardarDados=async()=>{};a.atribuidoId='f';w._wsAssistNovoForm('c',a.id);await w._wsAssistGuardar('c',a.id);assert.equal(a.atribuidoId,'f');assert.equal(w.dados.assistencias.filter(x=>x.testeContratoId==='ct').length,1);
 a.osGeradaId='os';w._wsAssistNovoForm('c',a.id);assert(d.getElementById('wsa_local').disabled);d.getElementById('wsa_local').value='__sede__';await w._wsAssistGuardar('c',a.id);assert.equal(a.localId,'l');
}finally{dom.window.close()}});
test('customer menu prompts for uncovered sites and rejects foreign sites, guessed records or revoked access',async()=>{const {dom,w}=setup();try{
 customerWorkspace(w);const d=w.document;let prompts=0;w.tgConfirm=()=>{prompts++;return Promise.resolve(false);};w._wsAssistNovoForm('c');d.getElementById('wsa_local').value='__sede__';d.getElementById('wsa_local').dispatchEvent(new w.Event('change'));assert.equal(prompts,1);assert.match(d.getElementById('wsaContractSummary').textContent,/Potencial para contrato/);
 d.getElementById('wsa_assunto').value='Sem contrato';await w._wsAssistGuardar('c',null);const a=w.dados.assistencias.find(x=>x.assunto==='Sem contrato');assert.equal(a.localId,null);assert.equal(a.testeContratoId,null);
 w._wsAssistNovoForm('c');d.getElementById('wsa_assunto').value='Intruso';const bad=new w.Option('Outra instalação','foreign');d.getElementById('wsa_local').add(bad);d.getElementById('wsa_local').value='foreign';const before=w.dados.assistencias.length;await w._wsAssistGuardar('c',null);assert.equal(w.dados.assistencias.length,before);
 await w._wsAssistGuardar('c','other');assert.equal(w.dados.assistencias.length,before);w.license=false;await w._wsAssistGuardar('c',null);assert.equal(w.dados.assistencias.length,before);
}finally{dom.window.close()}});
test('customer with only headquarters still receives the missing-contract popup when starting a request',()=>{const {dom,w}=setup();try{
 customerWorkspace(w);w.dados.locais=[];let prompts=0;w.tgConfirm=()=>{prompts++;return Promise.resolve(false);};w._wsAssistNovoForm('c');assert.equal(w.document.getElementById('wsa_local').value,'__sede__');assert.equal(prompts,1);assert.match(w.document.getElementById('wsaContractSummary').textContent,/Potencial para contrato/);
}finally{dom.window.close()}});
test('missing-contract prompt uses TG Sim/Não and never opens a contract after the selected customer changes',async()=>{const {dom,w}=setup();try{
 customerWorkspace(w);let resolvePrompt,options;w.confirm=()=>{throw Error('Native browser popup must not be used')};w.tgConfirm=(message,opts)=>{options=opts;return new Promise(resolve=>resolvePrompt=resolve)};
 w._wsAssistNovoForm('c');w.document.getElementById('wsa_local').value='__sede__';w.document.getElementById('wsa_local').dispatchEvent(new w.Event('change'));assert.equal(options.textoOk,'Sim');assert.equal(options.textoCancelar,'Não');
 let opened=0;w.abrirModalContrato=()=>opened++;w.document.getElementById('wsa_cliente').value='changed';resolvePrompt(true);await Promise.resolve();assert.equal(opened,0);
}finally{dom.window.close()}});
test('potential creates one customer card from requests and disappears after the requested installations have active contracts',()=>{const {dom,w}=setup();try{
 contractFeature(w);w.dados.clientes.push({id:'no-request',adminId:'admin',nome:'Sem pedidos'});w.dados.assistencias[0].localId='l';w.dados.assistencias.push({id:'second',adminId:'admin',clienteId:'c',localId:'l',estado:'aberta'});
 assert.equal(w.TGAssistContracts.potential().length,1);assert.equal(w.TGAssistContracts.potential()[0].client.id,'c');assert.equal(w.TGAssistContracts.potential()[0].locations.length,2);
 w.dados.contratos.push({id:'ct',adminId:'admin',clienteId:'c',localId:'l',validadeContrato:'2026-12-31'});assert.equal(w.TGAssistContracts.potential().length,0);
}finally{dom.window.close()}});
test('Sim in the TG popup opens a maintenance contract prefilled for the selected headquarters',async()=>{const {dom,w}=setup();try{
 customerWorkspace(w);w.dados.locais=[];w.confirm=()=>{throw Error('Browser popup forbidden')};w.tgConfirm=()=>Promise.resolve(true);const d=w.document;
 w.abrirModalContrato=()=>d.body.insertAdjacentHTML('beforeend','<input id="ct_cliente"><input id="ct_cliente_busca"><select id="ct_local"><option value=""></option></select>');w.onClienteContratoChange=()=>{};w.onLocalContratoChange=()=>{};
 w._wsAssistNovoForm('c');await new Promise(resolve=>setImmediate(resolve));assert.equal(d.getElementById('ct_cliente').value,'c');assert.equal(d.getElementById('ct_local').value,'');assert.equal(w.dados.assistencias.length,2);
}finally{dom.window.close()}});
test('a contract created after the assistance can be linked when its OS is created, without a completion debit',async()=>{const {dom,w}=setup();try{
 contractFeature(w);w.dados.contratos=[{id:'new-ct',adminId:'admin',clienteId:'c',localId:'l',numero:'Novo contrato'}];w.TGModules.open('assistencias');w.TGAssistNative.criarOSDeAssistencia('a');assert.equal(w.document.getElementById('assistOsContrato').value,'new-ct');await w.TGAssistNative._confirmarCriarOSDeAssistencia('a');assert.equal(w.dados.servicos[0].contratoId,'new-ct');assert.equal(w.dados.assistencias[0].testeContratoId,'new-ct');assert(!w.dados.assistencias[0].testeVisitaConcluidaEm);assert.equal(w.dados.servicos[0].status,'pendente');
}finally{dom.window.close()}});


test('OS staff drives assistance names, search and counters after reload and reassignment',()=>{const {dom,w}=setup();try{
 const d=w.document,a=w.dados.assistencias[0];
 a.osGeradaId='os';a.atribuidoId=null;
 w.dados.funcionarios.push({id:'g',adminId:'admin',nome:'Ana Técnica'},{id:'h',adminId:'other',nome:'Segredo Técnico'});
 w.dados.servicos.push({id:'os',adminId:'admin',clienteId:'c',assistenciaId:'a',funcionariosIds:['f','g','g'],funcionarioId:'f'});
 w.TGModules.open('assistencias');
 const count=state=>Number(d.querySelector(`[data-state="${state}"] strong`).textContent);
 const names=()=>d.querySelector('#tgAssistResults tbody tr td:nth-child(4)').textContent;
 assert.equal(count('atribuidas'),1);assert.equal(count('sem_atribuicao'),0);assert.equal(names(),'Técnico, Ana Técnica');
 assert.match(d.querySelector('.tg-assist-card-state').textContent,/Técnico, Ana Técnica/);
 // Simulate a reload from persisted data, with an old missing assignment copy.
 w.dados=JSON.parse(JSON.stringify(w.dados));w.TGAssistNative.render();assert.equal(names(),'Técnico, Ana Técnica');
 const search=d.getElementById('tgAssistSearch');search.value='Ana Técnica';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#tgAssistResults tbody tr').length,1);search.value='';search.dispatchEvent(new w.Event('input'));
 const os=w.dados.servicos[0];w.dados.assistencias[0].atribuidoId='f';os.funcionariosIds=['g'];os.funcionarioId='g';w.TGAssistNative.render();assert.equal(names(),'Ana Técnica');assert.equal(count('atribuidas'),1);
 os.funcionariosIds=[];os.funcionarioId=null;w.TGAssistNative.render();assert.equal(names(),'Por atribuir');assert.equal(count('sem_atribuicao'),1);assert.equal(count('atribuidas'),0);
 w.dados.assistencias[0].atribuidoId=null;w.dados.assistencias[0].osGeradaId=null;os.funcionariosIds=['g'];w.TGAssistNative.render();assert.equal(names(),'Ana Técnica');assert.equal(count('atribuidas'),1);
 os.adminId='other';os.funcionariosIds=['h'];w.TGAssistNative.render();assert.equal(count('atribuidas'),0);assert.equal(names(),'Por atribuir');assert(!d.getElementById('tgAssistResults').textContent.includes('Segredo Técnico'));
}finally{dom.window.close()}});


test('assistance table and mobile cards display the scoped installation locality',()=>{const {dom,w}=setup();try{
 const d=w.document;w.dados.locais[0].cidade='Lisboa <Centro>';w.dados.clientes[0].cidade='Porto';w.TGModules.open('assistencias');
 const header=[...d.querySelectorAll('#tgAssistResults th')].map(el=>el.textContent);assert(header.includes('Localidade'));
 const index=header.indexOf('Localidade');const cell=()=>d.querySelector('#tgAssistResults tbody tr').children[index];assert.equal(cell().textContent,'Lisboa <Centro>');assert.equal(cell().querySelector('centro'),null);assert.match(d.querySelector('.tg-assist-card-locality').textContent,/Lisboa <Centro>/);
 w.dados.locais[0].cidade='';w.TGAssistNative.render();assert.equal(cell().textContent,'Sem localidade indicada');
 w.dados.assistencias[0].localId=null;w.TGAssistNative.render();assert.equal(cell().textContent,'Porto');
}finally{dom.window.close()}});
