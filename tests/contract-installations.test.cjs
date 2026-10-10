const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_PATH || 'jsdom');
const source=fs.readFileSync('app-principal.js','utf8');
const fn=name=>source.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0];
const plain=v=>JSON.parse(JSON.stringify(v));
function setup(){
 const w=new JSDOM('<input id="ct_cliente" value="c"><select id="ct_local"><option value="">Sede</option><option value="l">Loja</option><option value="b">Armazém</option><option value="__novo__">Nova</option></select><div id="ct_cobertura"></div><div id="ct_novo_local"></div><input id="ct_local_nome" value="Nova loja"><input id="ct_local_morada" value="Rua Nova"><input id="ct_local_numero"><input id="ct_local_cp"><input id="ct_local_cidade"><input id="ct_local_freguesia"><input id="ct_local_pin_mapa"><select id="ct_period"><option value="anual">Anual</option></select><select id="ct_interv"><option value="presencial">Presencial</option></select><select id="ct_tecnico"><option value=""></option></select><input id="ct_inicio" value="2026-10-10"><input id="ct_valor" value="100"><div id="modalGerarOSCampos"></div><div id="modalGerarOSOverlay"></div>',{runScripts:'outside-only'}).window;
 w.dados={clientes:[{id:'c',adminId:'a',nome:'Cliente',morada:'Sede rua',cidade:'Lisboa'}],locais:[{id:'l',adminId:'a',clienteId:'c',nome:'Loja',morada:'Rua Loja',cidade:'Porto'},{id:'b',adminId:'a',clienteId:'c',nome:'Armazém',morada:'Rua Armazém',cidade:'Braga'},{id:'foreign',adminId:'a',clienteId:'other',nome:'Outro cliente'},{id:'tenant',adminId:'z',clienteId:'c',nome:'Outra empresa'}],equipamentos:[{id:'e',adminId:'a',clienteId:'c',localId:'l',tipo:'cctv'}],contratos:[],servicos:[],funcionarios:[{id:'f',adminId:'a',role:'funcionario',nome:'Técnico'}]};
 w.usuarioLogado={id:'a',role:'admin'};w.alerts=[];w.alert=x=>w.alerts.push(x);w.confirm=()=>true;w.escapeHtmlSimples=v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 let ids=0;w.gerarId=()=>`new-${++ids}`;w.gerarNumeroContrato=()=> 'CT-1';w.calcularProximaManutencao=()=> '2027-10-10';w._algumEquipExigePresencialAnual=()=>false;w._ctTiposTrabalhoSelecionados=()=>[];w.saves=0;w.guardarDados=async()=>{w.saves++;if(w.failSave)throw Error('offline')};w.fecharModalContrato=()=>w.closed=true;w.renderizarTudo=()=>{};w.abrirSecao=()=>{};w._atualizarSelectEquipDisponivel=()=>{};
 w.eval("let contratoEditandoId=null, _ctEquipamentosAtuais=['e'], gerarOSContratoId=null;"+['_contratoLocalIds','_contratoAbrangeLocal','_contratoInstalacoes','_contratoInstalacoesLabel','_contratoOpcoesInstalacao','_ctRenderCobertura','_ctCoberturaChange','onClienteContratoChange','onLocalContratoChange','salvarContrato','abrirGerarOSContrato','confirmarGerarOS','_moradaCompletaLocal'].map(fn).join('\n'));
 w._ctRenderCobertura(['l']);w.document.getElementById('ct_local').value='l';
 return w;
}
test('coverage round-trips and legacy records keep their original location',()=>{const w=setup();try{
 const start=source.indexOf('            contratos: {',source.indexOf('const M ='));
 w.isoToMs=v=>v;w.msToISO=v=>v;w.nn=v=>v||null;w.eval('window.mapping={'+source.slice(start,source.indexOf('\n            },',start)+15)+'};');
 const old={id:'ct',admin_id:'a',cliente_id:'c',local_id:'l'};
 assert.deepEqual(plain(w._contratoLocalIds(w.mapping.contratos.from(old))),['l']);assert(!Object.hasOwn(w.mapping.contratos.to(w.mapping.contratos.from(old)),'locais_ids'));
 const raw={...old,locais_ids:['l','b','']};assert.deepEqual(plain(w.mapping.contratos.to(w.mapping.contratos.from(raw)).locais_ids),raw.locais_ids);
 assert.deepEqual(plain(w._contratoLocalIds({})),['']);
}finally{w.close()}});
test('coverage shows only the selected customer, restores multiple sites and moves a single principal',()=>{const w=setup();try{
 w._ctRenderCobertura(['l','b']);assert.equal(w.document.querySelectorAll('.ct-local-chk:checked').length,2);assert(!w.document.body.textContent.includes('Outro cliente'));assert(!w.document.body.textContent.includes('Outra empresa'));
 w._ctRenderCobertura(['']);w.document.getElementById('ct_local').dataset.principalAnterior='';w.onLocalContratoChange();assert.deepEqual([...w.document.querySelectorAll('.ct-local-chk:checked')].map(c=>c.value),['l']);
 w.document.getElementById('ct_local').value='b';w.onLocalContratoChange();assert.deepEqual([...w.document.querySelectorAll('.ct-local-chk:checked')].map(c=>c.value),['b']);
 w.document.getElementById('ct_cliente').value='other';w.onClienteContratoChange();assert(!w.document.querySelector('.ct-local-chk[value="l"]'));assert(w.document.querySelector('.ct-local-chk[value="foreign"]'));
}finally{w.close()}});
test('contract saves several sites and rejects foreign coverage or equipment',async()=>{const w=setup();try{
 w._ctRenderCobertura(['l','b']);await w.salvarContrato();assert.deepEqual(plain(w.dados.contratos[0].locaisIds),['l','b']);assert.equal(w.closed,true);assert.equal(w.saves,1);
 const before=JSON.stringify(w.dados.contratos);const injected=w.document.createElement('input');injected.className='ct-local-chk';injected.type='checkbox';injected.checked=true;injected.value='foreign';w.document.body.append(injected);await w.salvarContrato();assert.equal(JSON.stringify(w.dados.contratos),before);assert.equal(w.saves,1);
 injected.remove();w.dados.equipamentos[0].clienteId='other';await w.salvarContrato();assert.equal(w.saves,1);
}finally{w.close()}});
test('new site is not created on invalid form; synchronization retries reuse the contract and site',async()=>{const w=setup();try{
 w.document.getElementById('ct_local').value='__novo__';w._ctRenderCobertura([]);w.document.getElementById('ct_inicio').value='';await w.salvarContrato();assert.equal(w.dados.locais.length,4);
 w.document.getElementById('ct_inicio').value='2026-10-10';w.failSave=true;await w.salvarContrato();assert.equal(w.dados.locais.length,5);assert.equal(w.dados.contratos.length,1);assert.equal(w.closed,undefined);const site=w.dados.locais[4].id;assert.deepEqual(plain(w.dados.contratos[0].locaisIds),[site]);
 w.failSave=false;await w.salvarContrato();assert.equal(w.dados.locais.length,5);assert.equal(w.dados.contratos.length,1);assert.equal(w.closed,true);
}finally{w.close()}});
test('OS is created for the selected covered site with its address; foreign site is refused',async()=>{const w=setup();try{
 const c={id:'ct',numero:'CT-1',adminId:'a',clienteId:'c',localId:'l',locaisIds:['l','b',''],equipamentosIds:['e']};w.dados.contratos.push(c);w._equipStrContrato=()=> 'CCTV';w._horaMin=v=>Number(v.split(':')[0])*60+Number(v.split(':')[1]);w.gerarNumeroRegistoServidor=async()=> 'OS-1';w.fecharGerarOS=()=>{};
 w.abrirGerarOSContrato('ct');assert.equal(w.document.querySelectorAll('#os_gerar_local option').length,3);w.document.querySelector('.os-gerar-func-chk').checked=true;w.document.getElementById('os_gerar_local').value='b';await w.confirmarGerarOS();assert.equal(w.dados.servicos[0].localId,'b');assert.equal(w.dados.servicos[0].morada,'Rua Armazém');assert.equal(w.dados.servicos[0].cidade,'Braga');assert.equal(c.localId,'l');
 w.document.getElementById('os_gerar_local').value='';await w.confirmarGerarOS();assert.equal(w.dados.servicos[1].localId,null);assert.equal(w.dados.servicos[1].morada,'Sede rua');
 w.document.getElementById('os_gerar_local').add(new w.Option('Outro','foreign'));w.document.getElementById('os_gerar_local').value='foreign';await w.confirmarGerarOS();assert.equal(w.dados.servicos.length,2);
}finally{w.close()}});
test('deleting one covered site retains other sites and deleting the last moves contract to Sede',async()=>{const w=setup();try{
 w.dados.contratos=[{id:'ct',adminId:'a',clienteId:'c',localId:'l',locaisIds:['l','b']}];w.adminDoUtilizador=()=>({id:'a'});w.prompt=()=> 'APAGAR';w.eval(fn('eliminarLocalCliente'));await w.eliminarLocalCliente('l','c');assert.equal(w.dados.contratos[0].localId,'b');assert.deepEqual(plain(w.dados.contratos[0].locaisIds),['b']);await w.eliminarLocalCliente('b','c');assert.equal(w.dados.contratos[0].localId,null);assert.deepEqual(plain(w.dados.contratos[0].locaisIds),['']);
}finally{w.close()}});
test('mass generation creates one OS per covered installation without mixing tenants',async()=>{const w=setup();try{
 w.dados.contratos=[{id:'ct',numero:'CT-1',adminId:'a',clienteId:'c',localId:'l',locaisIds:['l','b']},{id:'foreign-ct',adminId:'z',clienteId:'c',localId:'tenant'}];
 w.document.body.insertAdjacentHTML('beforeend','<select id="massa_tecnico"><option value="f">Técnico</option></select><input id="massa_data_inicio" value="2026-10-10"><input id="massa_data_fim" value="2026-10-10"><input id="massa_hora" value="09:00"><div id="modalGerarOSMassaOverlay"></div>');
 w._equipStrContrato=()=> 'CCTV';w.gerarNumeroRegistoServidor=async()=> 'OS';w.eval("let _contratosSelecionados=['ct','foreign-ct'];"+fn('gerarOSEmMassaConfirmar'));
 await w.gerarOSEmMassaConfirmar();assert.deepEqual(plain(w.dados.servicos.map(os=>[os.localId,os.morada,os.adminId])),[['l','Rua Loja','a'],['b','Rua Armazém','a']]);
}finally{w.close()}});
test('manual maintenance and its original work sheet retain the chosen installation',()=>{const w=setup();try{
 w.dados.contratos=[{id:'ct',numero:'CT-1',adminId:'a',clienteId:'c',localId:'l',locaisIds:['l','b']}];
 w.document.body.insertAdjacentHTML('beforeend','<select id="rg_local"><option value="b">Armazém</option></select><input id="rg_data" value="2026-10-10"><select id="rg_tecnico"><option value="f">Técnico</option></select><textarea id="rg_obs">Manutenção real</textarea>');
 w.avancarPeriodicidade=()=> '2027-10-10';w._notificarFuncionario=()=>{};w._equipStrContrato=()=> 'CCTV';w.fecharModalRegisto=()=>{};w.eval("let registoContratoId='ct';"+fn('salvarRegisto'));
 w.salvarRegisto();assert.equal(w.dados.registosManutencao[0].localId,'b');assert.equal(w.dados.folhasObra[0].localId,'b');assert(w.dados.folhasObra[0].descricao.includes('Armazém'));
}finally{w.close()}});
