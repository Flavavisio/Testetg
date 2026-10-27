const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app-principal.js','utf8');
const fn=name=>source.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0];
function setup(active=true,lunch=false){
 const admin={id:'a',testePontoAssiduidadeAtivo:active};
 const c=vm.createContext({admin,usuarioLogado:{id:'f',adminId:'a',role:'funcionario'},dados:{administradores:[admin],ponto:[],obraPontoLonga:[],servicos:[{id:'os',adminId:'a',funcionariosIds:['f'],descricao:'OS teste'}],obras:[{id:'w',adminId:'a',nome:'Obra teste'}]},_picandoEntradaObraLonga:false,
 Date,Promise,console,expressAtivo:()=>false,adminDoUtilizador:()=>admin,adminAtual:()=>admin,getDataHoje:()=> '2026-10-26',_tenantId:()=> 'a',_tenantIdAtual:()=> 'a',_gpsPontoAtivo:()=>false,_obraLongaPontoAbertoQualquer:()=>null,_pausaAlmocoPendente:()=>null,gerarId:()=>Math.random().toString(),guardarDados:async()=>{},renderizarTudo:()=>{},_refrescarModalObraLongaSeAberto:()=>{},_mostrarCarregando:()=>{},_esconderCarregando:()=>{},_checklistEntradaVerificar:(id,cb)=>cb(),_nomeClienteOS:()=> 'Cliente',alert:()=>{},avisarPicarPontoPrimeiro:()=>{c.blocked=true;},abrirSliderConfirmacao:(a,b,cb)=>{c.confirm=cb;}});
 vm.runInContext(['pontoAssiduidadeAtivo','pontoAbertoHoje','obraLongaPicarEntrada','picarPontoOS','_quiosqueGarantirEntradaGeral','guardarRegistosTempoTeste'].map(fn).join('\n'),c);
 return c;
}
for(const type of ['os','obra']){
 test(type+': attendance disabled writes work time without a general clock',async()=>{
  const c=setup(false);await (type==='os'?c.picarPontoOS('os','entrada'):c.obraLongaPicarEntrada('w'));
  assert(c.confirm);await c.confirm();
  assert.equal(c.dados.ponto.filter(p=>!p.servicoId).length,0);
  assert.equal(type==='os'?c.dados.ponto.length:c.dados.obraPontoLonga.length,1);
 });
 test(type+': existing companies still require the general clock',async()=>{
  const c=setup();await (type==='os'?c.picarPontoOS('os','entrada'):c.obraLongaPicarEntrada('w'));
  assert(c.blocked);assert(!c.confirm);
 });
 test(type+': return from lunch creates no attendance when disabled',async()=>{
  const c=setup(false);c._pausaAlmocoPendente=()=>type==='os'?{tipo:'os',servicoId:'os'}:{tipo:'obra',obraId:'w'};
  await (type==='os'?c.picarPontoOS('os','entrada'):c.obraLongaPicarEntrada('w'));await c.confirm();
  assert.equal(c.dados.ponto.filter(p=>!p.servicoId).length,0);
 });
 test(type+': lunch still reopens attendance when enabled',async()=>{
  const c=setup();c._pausaAlmocoPendente=()=>type==='os'?{tipo:'os',servicoId:'os'}:{tipo:'obra',obraId:'w'};
  await (type==='os'?c.picarPontoOS('os','entrada'):c.obraLongaPicarEntrada('w'));await c.confirm();
  assert.equal(c.dados.ponto.filter(p=>!p.servicoId).length,1);
 });
 test(type+': disabling attendance does not permit overlapping OS/work',async()=>{
  const c=setup(false);
  if(type==='os')c.dados.obraPontoLonga.push({funcionarioId:'f',obraId:'w',entrada:'08:00'});
  else c.dados.ponto.push({funcionarioId:'f',servicoId:'os',entrada:'08:00'});
  await (type==='os'?c.picarPontoOS('os','entrada'):c.obraLongaPicarEntrada('w'));assert(!c.confirm);
 });
}
test('default remains enabled and Express remains separate',()=>{
 const c=setup();delete c.admin.testePontoAssiduidadeAtivo;assert(c.pontoAssiduidadeAtivo());
 c.expressAtivo=()=>true;assert(!c.pontoAssiduidadeAtivo());
});
test('kiosk cannot auto-create general attendance when disabled',()=>{
 const c=setup(false);c._quiosqueGarantirEntradaGeral('f','a','08:00');assert.equal(c.dados.ponto.length,0);
 c.admin.testePontoAssiduidadeAtivo=true;c._quiosqueGarantirEntradaGeral('f','a','08:00');assert.equal(c.dados.ponto.length,1);
});
test('company preference save is role gated and does not change local state after server failure',async()=>{
 const c=setup(true);let writes=0;const button={disabled:false};c.document={getElementById:id=>id==='perf_ponto_assiduidade'?{checked:false}:button};
 c.supa={from:()=>({update:()=>{writes++;return {eq:()=>({select:()=>({single:async()=>({error:{message:'offline'}})})})};}})};
 await c.guardarRegistosTempoTeste();assert.equal(writes,0);
 c.usuarioLogado.role='admin';await c.guardarRegistosTempoTeste();assert.equal(writes,1);assert.equal(c.admin.testePontoAssiduidadeAtivo,true);assert.equal(button.disabled,false);
 c.supa.from=()=>({update:()=>({eq:()=>({select:()=>({single:async()=>({data:{id:'a',teste_tg_ponto_assiduidade_ativo:false}})})})})});
 await c.guardarRegistosTempoTeste();assert.equal(c.admin.testePontoAssiduidadeAtivo,false);
});
test('open attendance must be closed before disabling; OS clocks do not block configuration',async()=>{
 const c=setup();c.usuarioLogado.role='admin';let writes=0;c.document={getElementById:id=>id==='perf_ponto_assiduidade'?{checked:false}:{disabled:false}};c.supa={from:()=>{writes++;throw new Error('sent');}};
 c.dados.ponto=[{adminId:'a',funcionarioId:'f',entrada:'08:00'}];await c.guardarRegistosTempoTeste();assert.equal(writes,0);
 c.dados.ponto[0].servicoId='os';await c.guardarRegistosTempoTeste();assert.equal(writes,1);
});
for(const active of [true,false])for(const mode of ['agenda','fixed']){
 test(`kiosk ${mode}: attendance ${active?'enabled':'disabled'} controls the prerequisite`,async()=>{
  const c=setup(active);let asked=0;c._tenantQuiosque=()=> 'a';c._quiosqueAgendaPessoaSelecionada={id:'f',nome:'Técnico'};c._quiosquePessoaSelecionada=c._quiosqueAgendaPessoaSelecionada;c._quiosqueAgendaSessaoAtual={tipo:'obra',id:'w'};
  c._quiosqueObterLocalizacaoAgora=async()=>null;c._quiosquePerguntarEntradaGeral=()=>{asked++;};c._quiosqueAgendaGrid=()=>{};c._quiosqueMostrarGrid=()=>{};c.setTimeout=()=>{};
  c.document={getElementById:()=>({innerHTML:''})};c.localStorage={getItem:key=>({'tg_quiosque_obra':'w','tg_quiosque_obra_nome':'Obra teste'}[key]||null)};
  vm.runInContext(fn(mode==='agenda'?'_quiosqueAgendaPicar':'quiosquePicar'),c);
  await (mode==='agenda'?c._quiosqueAgendaPicar('entrada'):c.quiosquePicar('entrada'));
  assert.equal(asked,active?1:0);assert.equal(c.dados.obraPontoLonga.length,active?0:1);assert.equal(c.dados.ponto.length,0);
 });
}
test('phone focus offers direct intervention without attendance prerequisite',()=>{
 const tech=fs.readFileSync('tg-technician.js','utf8');
 const focus=tech.match(/    function focusHTML\([^]*?\n    \}/)[0];
 const c=vm.createContext({passportTarget:()=>true,attendance:()=>false,personalClock:()=>null,resumingLunch:()=>false,icon:()=>'',esc:x=>x,button:label=>label,label:()=> 'OS'});
 vm.runInContext(focus,c);
 const html=c.focusHTML({kind:'os',id:'os',row:{},title:'Serviço',client:'Cliente'});
 assert(html.includes('Iniciar intervenção'));assert(!html.includes('Picar entrada no dia'));assert(!html.includes('Regista primeiro'));
 c.attendance=()=>true;assert(c.focusHTML({kind:'os',id:'os',row:{},title:'Serviço',client:'Cliente'}).includes('Picar entrada no dia'));
});
