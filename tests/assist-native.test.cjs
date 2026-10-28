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
