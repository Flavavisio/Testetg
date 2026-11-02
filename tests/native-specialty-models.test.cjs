const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=';
function setup(){
 const w=new JSDOM('<div id="tgReportMenu"><div class="tgr-menu"></div></div>',{runScripts:'outside-only',url:'https://totalgest.test/'}).window;
 w.usuarioLogado={id:'a',nome:'Técnico QA',role:'admin'};w.licensed=true;w.REPORT_TEMPLATES={};
 w.dados={administradores:[{id:'a',ativo:true,areasNegocio:['avac','limpeza','eletricidade'],empresa:'Empresa QA',nomeFiscal:'Empresa Fiscal'}],clientes:[{id:'c',adminId:'a',nome:'Cliente',numeroCliente:'42'}],locais:[{id:'l',adminId:'a',clienteId:'c',nome:'Loja',morada:'Rua da Loja'}],servicos:[{id:'os',adminId:'a',clienteId:'c',localId:'l',numeroRegisto:'OS-1',funcionariosIds:['f'],tiposTrabalho:['Recarga de gás']}],funcionarios:[{id:'f',adminId:'a',podeAssinarRelatorios:true}],encarregados:[{id:'enc',adminId:'a',funcionariosIds:['f']}],relatoriosEspecialidade:[],equipamentos:[]};
 w._licencaValidaTenant=()=>w.licensed;w.adminDoUtilizador=()=>w.dados.administradores[0];w.getDataHoje=()=> '2026-10-30';w.gerarId=()=> 'new-id';w.numberCalls=0;w.proximoNumeroRelatorio=async()=>++w.numberCalls;w.writes=[];w._guardarCacheLocal=()=>{};w.M={relatoriosEspecialidade:{to:x=>x}};
 w.supa={from:table=>{let value,mode;const q={insert:v=>(value=v,mode='insert',q),update:v=>(value=v,mode='update',q),eq:()=>q,select:()=>q,single:async()=>{w.writes.push({table,value,mode});return w.fail?{error:{message:'Sem ligação'}}:{data:{id:value.id}}}};return q}};
 for(const file of ['tg-specialty-catalog.js','tg-equipment-reports.js','tg-specialty-templates.js'])w.eval(fs.readFileSync(file,'utf8'));
 return w;
}
function sheet(html){const messages=[];const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://totalgest.test/report',beforeParse(w){Object.defineProperty(w,'parent',{value:{postMessage:msg=>messages.push(msg)}});w.HTMLCanvasElement.prototype.getContext=()=>({beginPath(){},moveTo(){},lineTo(){},stroke(){},clearRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=>png;}});return {w:dom.window,messages};}
function init(w){w.dispatchEvent(new w.MessageEvent('message',{source:w.parent,data:{type:'init',numero:'RAVAC-42-001',data:'2026-10-30',cliente:'Cliente QA',nCliente:'42',morada:'Rua da Loja',instalacaoNome:'Loja QA',osNumero:'OS-1',tecnicoNome:'Técnico QA',empresaNome:'Empresa QA',empresaFiscal:'Empresa Fiscal QA',podeAssinar:true,equipamento:{marca:'Marca QA',numeroSerie:'S-123',fichaTecnica:{modelo:'Modelo QA'}}}}));}
function complete(w){w.document.querySelectorAll('[data-native-required]').forEach(el=>el.value='Registado em teste');w.document.querySelectorAll('.seg').forEach(seg=>seg.querySelector('input').checked=true);w.document.getElementById('native-work').value='Trabalhos registados pelo técnico';w.document.getElementById('native-result').selectedIndex=1;w.document.getElementById('native-client-status').value='Cliente ausente';w.document.getElementById('native-sign-tecnico').value=png;}
const plain=x=>JSON.parse(JSON.stringify(x));
test('fourteen ready-made native models contain authored sections, fields and unanswered checklists',()=>{
 const host=setup();try{const models=host.TGNativeReportModels.models;assert.equal(Object.values(models).reduce((n,v)=>n+Object.keys(v).length,0),14);
 for(const [type,variants]of Object.entries(models))for(const [code,html]of Object.entries(variants)){const {w}=sheet(html);try{assert(w.document.querySelector('body[data-native-model="'+type+'"]'));assert(w.document.querySelectorAll('.section-head').length>=4,code);assert(w.document.querySelectorAll('.seg').length>=8,code);assert.equal(w.document.querySelectorAll('input[type=radio]:checked').length,0);assert(w.document.getElementById('_relBtnRascunho'));assert(w.document.getElementById('_relBtnConcluir'));assert(w.document.getElementById('sign_tecnico'));assert(!html.includes('Crie o seu relatório'));}finally{w.close()}}
 }finally{host.close()}
});
test('each work type opens its exact native model; multiple selected works combine authored sheets',()=>{
 const host=setup();try{const api=host.TGNativeReportModels;for(const c of host.TGSpecialtyCatalog.list)for(const [code,label]of c.work){assert.deepEqual(plain(api.selection({tiposTrabalho:[code]},c.type)),[code]);assert.deepEqual(plain(api.selection({tiposTrabalho:[label]},c.type)),[code]);}
 const html=api.templateFor({tiposTrabalho:['Recarga de gás','Limpeza de filtros']},'RAVAC');assert(html.includes('Registo de refrigerante'));assert(html.includes('Limpeza e substituições'));assert(!api.templateFor({tiposTrabalho:['Limpeza regular']},'RLIM').includes('Registo de refrigerante'));
 }finally{host.close()}
});
test('known company, customer, installation, OS, technician and equipment are prefilled; observations and measurements remain for the visit',()=>{
 const host=setup(),{w}=sheet(host.TGNativeReportModels.models.RAVAC['Recarga de gás']);try{init(w);assert.equal(w.document.getElementById('native-cliente').value,'Cliente QA');assert.equal(w.document.getElementById('native-instalacao').value,'Loja QA');assert.equal(w.document.getElementById('native-os').value,'OS-1');assert.equal(w.document.getElementById('native-fiscal').textContent,'Empresa Fiscal QA');assert.equal(w.document.querySelector('[data-native-label="Marca"]').value,'Marca QA');assert.equal(w.document.querySelector('[data-native-label="Número de série"]').value,'S-123');assert.equal(w.document.querySelector('[data-native-label="Quantidade adicionada (kg)"]').value,'');assert.equal(w.document.getElementById('native-work').value,'');assert.equal(w.document.querySelectorAll('input[type=radio]:checked').length,0);
 }finally{w.close();host.close()}
});
test('native draft restores answers, text, photo captions and signatures without duplicating the model',()=>{
 const host=setup(),first=sheet(host.TGNativeReportModels.models.RLIM['Limpeza regular']);let reopened;try{init(first.w);first.w.document.querySelector('input[type=radio]').checked=true;first.w.document.getElementById('native-work').value='Texto do rascunho';first.w.document.getElementById('native-sign-tecnico').value=png;first.w.document.getElementById('native-photos').innerHTML='<figure data-native-photo><img src="'+png+'"><input value="Antes da limpeza"><button data-photo-remove>Retirar</button></figure>';
 const count=first.w.document.querySelectorAll('.seg').length,snapshot=first.w.TGNativeSheet.serialize(false);reopened=sheet(snapshot.html);assert.equal(reopened.w.document.querySelectorAll('.seg').length,count);assert.equal(reopened.w.document.getElementById('native-work').value,'Texto do rascunho');assert.equal(reopened.w.document.querySelectorAll('input[type=radio]:checked').length,1);assert.equal(reopened.w.TGNativeSheet.state().photos[0].caption,'Antes da limpeza');assert.equal(reopened.w.document.getElementById('native-sign-tecnico').value,png);
 }finally{reopened?.w.close();first.w.close();host.close()}
});
test('completion requires answers and signature; frozen document preserves results and is ready for PDF',()=>{
 const host=setup(),{w}=sheet(host.TGNativeReportModels.models.RELE['Quadro elétrico']);try{init(w);assert(w.TGNativeSheet.validate(true).length);complete(w);assert.equal(w.TGNativeSheet.validate(true).length,0);const final=w.TGNativeSheet.serialize(true);assert(final.html.includes('Trabalhos registados pelo técnico'));assert(final.html.includes('native-print-value'));assert(!final.html.includes('<script>'));assert(!final.html.includes('<canvas'));assert(!final.html.includes('type="radio"'));assert(final.html.includes('Imprimir / Guardar PDF'));assert(final.html.includes('Empresa Fiscal QA'));assert.equal(host.TGNativeReportModels.validate('RELE',final.estadoNativo,true).length,0);
 }finally{w.close();host.close()}
});
for(const [type,code]of [['RAVAC','Recarga de gás'],['RLIM','Limpeza regular'],['RELE','Quadro elétrico']])test(type+' saves a native draft then finalizes the same record after confirmed server writes',async()=>{
 const host=setup(),{w}=sheet(host.TGNativeReportModels.models[type][code]);try{host.dados.servicos[0].tiposTrabalho=[code];init(w);const draft=w.TGNativeSheet.serialize(false);await host.TGNativeReportModels.persist('os',type,null,{type:'relatorioEspecialidadeRascunho',...draft});assert.equal(host.numberCalls,0);assert.equal(host.dados.relatoriosEspecialidade.length,1);assert(host.dados.relatoriosEspecialidade[0].rascunho);complete(w);const final=w.TGNativeSheet.serialize(true);await host.TGNativeReportModels.persist('os',type,null,{type:'relatorioEspecialidadeConcluido',...final});assert.equal(host.numberCalls,1);assert.equal(host.writes[1].mode,'update');assert.equal(host.dados.relatoriosEspecialidade.length,1);const record=host.dados.relatoriosEspecialidade[0];assert(!record.rascunho);assert.equal(record.localId,'l');assert.equal(record.campos.modeloNativo,2);assert(record.campos.htmlSnapshot.includes(type+'-42-001'));assert.equal(host.TGEquipmentReports.pending(host.dados.servicos[0]).length,0);
 }finally{w.close();host.close()}
});
test('native save failure preserves draft editor state and access restrictions still apply',async()=>{
 const host=setup(),{w}=sheet(host.TGNativeReportModels.models.RAVAC['Recarga de gás']);try{init(w);host.fail=true;await assert.rejects(()=>host.TGNativeReportModels.persist('os','RAVAC',null,{type:'relatorioEspecialidadeRascunho',...w.TGNativeSheet.serialize(false)}),/Sem ligação/);assert.equal(host.dados.relatoriosEspecialidade.length,0);assert(!host.TGNativeReportModels.scope(host.dados,{id:'alien',role:'funcionario',adminId:'a'},'os','RAVAC'));host.dados.servicos[0].relatorioResponsavelId='other';assert(!host.TGNativeReportModels.scope(host.dados,{id:'f',role:'funcionario',adminId:'a'},'os','RAVAC'));host.dados.administradores[0].areasNegocio=[];assert(!host.TGNativeReportModels.guard('os','RAVAC'));
 }finally{w.close();host.close()}
});
test('both app entries use the native template bundle and cache instead of the generic editor',()=>{
 const sw=fs.readFileSync('sw.js','utf8');for(const f of ['index.html','login.html']){const html=fs.readFileSync(f,'utf8');assert(html.includes('tg-specialty-templates.js?v=2.0.3'));assert(!html.includes('src="tg-specialty-reports.js'));assert(!html.includes('tg-specialty-reports.css'));}assert(sw.includes('tg-specialty-templates.js?v=2.0.3'));
 const main=fs.readFileSync('app-principal.js','utf8');assert(main.includes('templateFor(os,tipo)'));assert(!main.includes('return window.TGSpecialtyReports.open(osId, tipo'));
});
test('the actual OS report entrypoint uses the CCTV/intrusion iframe pipeline, fills the installation and confirms the native save',async()=>{
 const host=setup();let doc;try{
 const main=fs.readFileSync('app-principal.js','utf8'),fn=main.match(/        async function _abrirModalRelatorioEspecialidade\([^]*?\n        \}/)[0];
 host._tenantId=()=> 'a';host._numeroSeqPreview=()=>1;host.prompt=()=>null;host.escapeHtmlSimples=v=>String(v??'');host.obterNomeFuncionario=()=> 'Técnico QA';host._tgPrepararNomeFiscalEspecialidade=html=>html;host.REPORT_TYPE_DEFS={RAVAC:{nome:'AVAC'}};host.renderizarTudo=()=>{};host.eval(main.slice(main.indexOf('        function _tgAssinaturasRascunhoRuntime'),main.indexOf('        // O nome fiscal faz parte do branding:'))+'var _relEspecOnMessageAtual=null;'+fn);
 let done=0;const opening=host._abrirModalRelatorioEspecialidade('os','RAVAC',()=>done++);const frame=host.document.getElementById('re_iframe');assert(frame);assert(frame.srcdoc.includes('Registo de refrigerante'));assert(!host.document.querySelector('.avac-form'));let initMsg;frame.contentWindow.postMessage=msg=>{if(msg.type==='init')initMsg=msg;};frame.dispatchEvent(new host.Event('load'));await opening;await new Promise(r=>setTimeout(r,180));assert.equal(initMsg.morada,'Rua da Loja');assert.equal(initMsg.instalacaoNome,'Loja');assert.equal(initMsg.osNumero,'OS-1');
 doc=sheet(frame.srcdoc);doc.w.dispatchEvent(new doc.w.MessageEvent('message',{source:doc.w.parent,data:initMsg}));const draft=doc.w.TGNativeSheet.serialize(false);host.dispatchEvent(new host.MessageEvent('message',{source:frame.contentWindow,data:{type:'relatorioEspecialidadeRascunho',...draft}}));await new Promise(r=>setImmediate(r));assert.equal(host.writes.length,1);assert.equal(done,1);assert(!host.document.getElementById('overlayRelEspec').classList.contains('open'));assert.equal(host.dados.relatoriosEspecialidade[0].campos.modeloNativo,2);
 }finally{doc?.w.close();host.close()}
});
for(const [type,code]of [['RAVAC','Recarga de gás'],['RLIM','Limpeza regular'],['RELE','Quadro elétrico']])test(type+' customer satisfaction survives drafts, final PDF and dashboard extraction',async()=>{
 const host=setup();host.eval(fs.readFileSync('tg-satisfaction.js','utf8'));const first=sheet(host.TGNativeReportModels.models[type][code]);let reopened;
 try{
  host.dados.servicos[0].tiposTrabalho=[code];init(first.w);
  const select=first.w.document.getElementById('native-satisfaction');assert.equal(select.value,'');
  assert.equal(host.TGSatisfaction.extract(first.w.TGNativeSheet.serialize(true).html).grau,null);
  select.value='insatisfeito';const draft=first.w.TGNativeSheet.serialize(false);
  assert.equal(host.TGSatisfaction.extract(draft.html).grau,'insatisfeito');
  reopened=sheet(draft.html);init(reopened.w);assert.equal(reopened.w.document.getElementById('native-satisfaction').value,'insatisfeito');complete(reopened.w);
  for(const key of ['muito_insatisfeito','insatisfeito','satisfeito','muito_satisfeito']){
   reopened.w.document.getElementById('native-satisfaction').value=key;
   const final=reopened.w.TGNativeSheet.serialize(true);
   assert.equal(final.estadoNativo.values['native-satisfaction'],key);
   assert.equal(host.TGSatisfaction.extract(final.html).grau,key);
   assert.equal(new JSDOM(final.html).window.document.querySelectorAll('.sat-box').length,4);
  }
  const final=reopened.w.TGNativeSheet.serialize(true);await host.TGNativeReportModels.persist('os',type,null,{type:'relatorioEspecialidadeConcluido',...final});
  const ctx={tenantId:'a',user:host.usuarioLogado,reports:host.dados.relatoriosEspecialidade,clients:host.dados.clientes};
  const summary=host.TGSatisfaction.summarize(ctx,{ini:'2026-10-30',fim:'2026-10-30'});assert.equal(summary.total,1);assert.equal(summary.counts.muito_satisfeito,1);
 }finally{reopened?.w.close();first.w.close();host.close()}
});
test('all fourteen models can save again and finish after reopening a draft saved through the actual buttons',()=>{
 const host=setup();try{for(const variants of Object.values(host.TGNativeReportModels.models))for(const html of Object.values(variants)){
  const first=sheet(html);let second,third;try{
   init(first.w);first.w.document.getElementById('_relBtnRascunho').click();assert.equal(first.messages.length,1);
   const saved=first.messages[0];second=sheet(saved.html);init(second.w);
   for(const id of ['_relBtnRascunho','_relBtnConcluir'])assert.equal(second.w.document.getElementById(id).disabled,false);
   second.w.document.getElementById('_relBtnRascunho').click();assert.equal(second.messages.length,1);
   third=sheet(second.messages[0].html);init(third.w);complete(third.w);third.w.document.getElementById('_relBtnConcluir').click();
   assert.equal(third.messages[0]?.type,'relatorioEspecialidadeConcluido');
  }finally{first.w.close();second?.w.close();third?.w.close()}
 }}finally{host.close()}
});
test('old native draft snapshots with disabled buttons use current templates and restore saved values',async()=>{
 const host=setup();try{
  const main=fs.readFileSync('app-principal.js','utf8'),fn=main.match(/        async function _abrirModalRelatorioEspecialidade\([^]*?\n        \}/)[0];
  host.dados.relatoriosEspecialidade=[{id:'draft',adminId:'a',servicoId:'os',tipo:'RAVAC',rascunho:true,campos:{modeloNativo:2,estadoNativo:{type:'RAVAC',version:2,modelKeys:['Recarga de gás'],values:{'native-work':'Trabalho guardado'}},htmlSnapshot:'<html><body>OLD DISABLED SNAPSHOT</body></html>'}}];
  host._tenantId=()=> 'a';host._numeroSeqPreview=()=>1;host.prompt=()=>null;host.escapeHtmlSimples=v=>String(v??'');host.obterNomeFuncionario=()=> 'Técnico QA';host._tgPrepararNomeFiscalEspecialidade=html=>html;host.REPORT_TYPE_DEFS={RAVAC:{nome:'AVAC'}};host.eval(main.slice(main.indexOf('        function _tgAssinaturasRascunhoRuntime'),main.indexOf('        // O nome fiscal faz parte do branding:'))+'var _relEspecOnMessageAtual=null;'+fn);
  const opening=host._abrirModalRelatorioEspecialidade('os','RAVAC',()=>{});const frame=host.document.getElementById('re_iframe');assert(!frame.srcdoc.includes('OLD DISABLED SNAPSHOT'));assert(frame.srcdoc.includes('Registo de refrigerante'));let message;frame.contentWindow.postMessage=m=>{if(m.type==='init')message=m};frame.dispatchEvent(new host.Event('load'));await opening;await new Promise(r=>setTimeout(r,180));assert.equal(message.nativeRestoreState.values['native-work'],'Trabalho guardado');
 }finally{host.close()}
});
test('every native model persists a customer-signed incomplete draft and repaints it on fresh reopening before finalization',async()=>{
 const host=setup();try{for(const [type,variants]of Object.entries(host.TGNativeReportModels.models))for(const [code,html]of Object.entries(variants)){
  host.dados.relatoriosEspecialidade=[];host.dados.servicos[0].tiposTrabalho=[code];const first=sheet(html);let reopened;try{
   init(first.w);first.w.document.getElementById('native-sign-cliente').value=png;first.w.document.getElementById('sign_cliente_nome').value='Cliente QA';
   first.w.document.getElementById('_relBtnRascunho').click();await host.TGNativeReportModels.persist('os',type,null,first.messages[0]);
   const saved=plain(host.writes.at(-1).value);assert(saved.rascunho);assert.equal(saved.assinaturaCliente,png);assert.equal(saved.assinaturaClienteNome,'Cliente QA');
   // Fresh template + persisted state is the actual application reopening route.
   reopened=sheet(html);const painted=[];reopened.w.Image=class{set src(value){this.onload?.()}};
   reopened.w.HTMLCanvasElement.prototype.getContext=function(){return{clearRect(){},drawImage:()=>painted.push(this.id)}};
   init(reopened.w);reopened.w.dispatchEvent(new reopened.w.MessageEvent('message',{source:reopened.w.parent,data:{type:'init',podeAssinar:true,nativeRestoreState:saved.campos.estadoNativo}}));
   assert(painted.includes('sign_cliente'),code+' visibly restored');assert.equal(reopened.w.document.getElementById('native-sign-cliente').value,png);
   reopened.w.document.getElementById('_relBtnRascunho').click();await host.TGNativeReportModels.persist('os',type,null,reopened.messages.at(-1));assert.equal(host.writes.at(-1).value.assinaturaCliente,png);
   reopened.w.dispatchEvent(new reopened.w.MessageEvent('message',{source:reopened.w.parent,data:{type:'nativeSaveError'}}));complete(reopened.w);reopened.w.document.getElementById('native-client-status').value='Assinado';reopened.w.document.getElementById('_relBtnConcluir').click();
   const final=reopened.messages.at(-1);assert.equal(final.type,'relatorioEspecialidadeConcluido');await host.TGNativeReportModels.persist('os',type,null,final);assert.equal(host.writes.at(-1).value.assinaturaCliente,png);assert(!host.writes.at(-1).value.rascunho);assert(final.html.includes(png));
  }finally{first.w.close();reopened?.w.close();}
 }}finally{host.close();}
});
for(const type of ['REX','RCCTV'])test(type+' actual host saves customer signature in draft record and confirms writes before closing',async()=>{
 const host=setup();let doc;try{
  const main=fs.readFileSync('app-principal.js','utf8'),fn=main.match(/        async function _abrirModalRelatorioEspecialidade\([^]*?\n        \}/)[0];
  const b64=main.match(new RegExp(type+':\\s*"([A-Za-z0-9+/=]{10000,})"'))[1];
  host._tenantId=()=> 'a';host._numeroSeqPreview=()=>1;host.prompt=()=>null;host.alert=()=>{};host.escapeHtmlSimples=v=>String(v??'');host.obterNomeFuncionario=()=> 'Técnico QA';host._tgPrepararNomeFiscalEspecialidade=html=>html;host._tgAtualizarNomeFiscalDocumento=()=>{};host.REPORT_TYPE_DEFS={[type]:{nome:type}};host.REPORT_TEMPLATES={[type]:Buffer.from(b64,'base64').toString('utf8')};host._uploadTextoStorage=async()=>false;host.renderizarTudo=()=>{};
  let release,confirmed=0,closed=0;host.guardarDados=()=>new Promise(r=>{release=()=>{confirmed++;r()}});
  host.eval(main.slice(main.indexOf('        function _tgAssinaturasRascunhoRuntime'),main.indexOf('        // O nome fiscal faz parte do branding:'))+'var _relEspecOnMessageAtual=null;'+fn);
  const opening=host._abrirModalRelatorioEspecialidade('os',type,()=>closed++);const frame=host.document.getElementById('re_iframe');frame.dispatchEvent(new host.Event('load'));await opening;
  const signatureState={images:{sign_cliente:png},names:{sign_cliente_nome:'Cliente QA'}};
  const draft={type:'relatorioEspecialidadeRascunho',html:'<!doctype html><html><head></head><body>Draft</body></html>',assinaturaCliente:png,assinaturaClienteNome:'Cliente QA',assinaturasRascunho:signatureState,...(type==='REX'?{estadoRex:JSON.stringify({colIds:[1],assinaturasRascunho:signatureState})}:{})};
  host.dispatchEvent(new host.MessageEvent('message',{source:frame.contentWindow,data:draft}));await new Promise(r=>setImmediate(r));
  const record=host.dados.relatoriosEspecialidade[0];assert(record.rascunho);assert.equal(record.assinaturaCliente,png);assert.equal(record.assinaturaClienteNome,'Cliente QA');assert.deepEqual(plain(record.campos.assinaturasRascunho),signatureState);assert.equal(closed,0);assert(host.document.getElementById('overlayRelEspec').classList.contains('open'));
  release();await new Promise(r=>setImmediate(r));assert.equal(confirmed,1);assert.equal(closed,1);
 }finally{doc?.w.close();host.close()}
});
