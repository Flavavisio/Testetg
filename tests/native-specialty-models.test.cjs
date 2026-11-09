const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=';
function setup(){
 const w=new JSDOM('<div id="tgReportMenu"><div class="tgr-menu"></div></div>',{runScripts:'outside-only',url:'https://totalgest.test/'}).window;
 w.usuarioLogado={id:'a',nome:'Técnico QA',role:'admin'};w.licensed=true;w.REPORT_TEMPLATES={};w.TGElectricalLegal={exportPDF:async()=>({dataUri:'data:application/pdf;base64,JVBERi0xLjQ=',filename:'teste.pdf',pages:4,source:'https://www.dgeg.gov.pt/media/nplnli53/anexo-1.pdf',model:'DGEG.DSEE.Mod_Relatorio_v2024'})};
 w.dados={administradores:[{id:'a',ativo:true,areasNegocio:['avac','limpeza','eletricidade'],empresa:'Empresa QA',nomeFiscal:'Empresa Fiscal'}],clientes:[{id:'c',adminId:'a',nome:'Cliente',numeroCliente:'42'}],locais:[{id:'l',adminId:'a',clienteId:'c',nome:'Loja',morada:'Rua da Loja'}],servicos:[{id:'os',adminId:'a',clienteId:'c',localId:'l',numeroRegisto:'OS-1',funcionariosIds:['f'],tiposTrabalho:['Recarga de gás']}],funcionarios:[{id:'f',adminId:'a',podeAssinarRelatorios:true}],encarregados:[{id:'enc',adminId:'a',funcionariosIds:['f']}],relatoriosEspecialidade:[],equipamentos:[]};
 w._licencaValidaTenant=()=>w.licensed;w.adminDoUtilizador=()=>w.dados.administradores[0];w.getDataHoje=()=> '2026-10-30';w.gerarId=()=> 'new-id';w.numberCalls=0;w.proximoNumeroRelatorio=async()=>++w.numberCalls;w.writes=[];w._guardarCacheLocal=async()=>true;w._snap={relatoriosEspecialidade:new Map()};w.indexedDB=new (require('fake-indexeddb').IDBFactory)();w.M={relatoriosEspecialidade:{to:x=>x}};
 w.supa={from:table=>{let value,mode;const q={insert:v=>(value=v,mode='insert',q),update:v=>(value=v,mode='update',q),eq:()=>q,is:()=>q,select:()=>q,then:resolve=>Promise.resolve(resolve({data:[],error:null})),single:async()=>{w.writes.push({table,value,mode});return w.fail?{error:{message:'Sem ligação'}}:{data:{id:value.id}}}};return q}};
 for(const file of ['tg-report-autosave.js','tg-specialty-catalog.js','tg-equipment-reports.js','tg-specialty-templates.js'])w.eval(fs.readFileSync(file,'utf8'));
 return w;
}
async function settled(){await new Promise(r=>setTimeout(r,30));}
async function ready(frame){for(let n=0;n<100&&!frame.srcdoc;n++)await new Promise(r=>setTimeout(r,5));}
function sheet(html){const messages=[];const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://totalgest.test/report',beforeParse(w){Object.defineProperty(w,'parent',{value:{postMessage:msg=>messages.push(msg)}});w.HTMLCanvasElement.prototype.getContext=()=>({beginPath(){},moveTo(){},lineTo(){},stroke(){},clearRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=>png;}});return {w:dom.window,messages};}
function init(w){w.dispatchEvent(new w.MessageEvent('message',{source:w.parent,data:{type:'init',numero:'RAVAC-42-001',data:'2026-10-30',cliente:'Cliente QA',nCliente:'42',morada:'Rua da Loja',instalacaoNome:'Loja QA',osNumero:'OS-1',tecnicoNome:'Técnico QA',empresaNome:'Empresa QA',empresaFiscal:'Empresa Fiscal QA',podeAssinar:true,equipamento:{marca:'Marca QA',numeroSerie:'S-123',fichaTecnica:{modelo:'Modelo QA'}}}}));}
function complete(w){w.document.querySelectorAll('[data-native-required]').forEach(el=>el.value='Registado em teste');w.document.querySelectorAll('.seg').forEach(seg=>seg.querySelector('input').checked=true);w.document.getElementById('native-work').value='Trabalhos registados pelo técnico';w.document.getElementById('native-result').selectedIndex=1;w.document.getElementById('native-client-status').value='Cliente ausente';w.document.getElementById('native-sign-tecnico').value=png;if(w.document.getElementById('electric-period_start'))fillExploration(w);}
const fillExploration=require('./fixtures/electrical-state.cjs');

const plain=x=>JSON.parse(JSON.stringify(x));
const checklistModels=host=>Object.entries(host.TGNativeReportModels.models).filter(([type])=>!host.TGSpecialtyCatalog.list.find(config=>config.type===type).scie);
function installEntry(host){
 const main=fs.readFileSync('app-principal.js','utf8'),fn=main.match(/        async function _abrirModalRelatorioEspecialidade\([^]*?\n        \}/)[0];
 host._tenantId=()=> 'a';host._numeroSeqPreview=()=>1;host.prompt=()=>null;host.alert=()=>{};host.escapeHtmlSimples=v=>String(v??'');host.obterNomeFuncionario=()=> 'Técnico QA';host._tgPrepararNomeFiscalEspecialidade=html=>html;host.REPORT_TYPE_DEFS={RAVAC:{nome:'AVAC'}};host.renderizarTudo=()=>{};
 host.eval(main.slice(main.indexOf('        function _tgAssinaturasRascunhoRuntime'),main.indexOf('        // O nome fiscal faz parte do branding:'))+(main.includes('// Checkpoints remain local')?main.slice(main.indexOf('        // Checkpoints remain local'),main.indexOf('        let _relEspecOnMessageAtual')):'')+'var _relEspecOnMessageAtual=null;'+fn);
}
test('all five AVAC works in the same OS have independent drafts, signatures, numbers and completion',async()=>{
 const host=setup();try{
  const works=host.TGSpecialtyCatalog.list[0].work,os=host.dados.servicos[0];os.tiposTrabalho=works.map(w=>w[1]);let next=0;host.gerarId=()=> 'isolated-'+(++next);
  assert.equal(host.TGEquipmentReports.requirements(os).length,5);
  for(const [code] of works){const {w}=sheet(host.TGNativeReportModels.templateFor(os,'RAVAC',code));try{
   init(w);w.document.getElementById('native-work').value='Trabalho de '+code;w.document.getElementById('native-sign-cliente').value=png;w.document.getElementById('sign_cliente_nome').value='Cliente '+code;
   await host.TGNativeReportModels.persist('os','RAVAC',null,{type:'relatorioEspecialidadeRascunho',...w.TGNativeSheet.serialize(false)},code);
  }finally{w.close()}}
  assert.equal(host.dados.relatoriosEspecialidade.length,5);assert.equal(host.TGEquipmentReports.pending(os).length,5);
  const ids=host.dados.relatoriosEspecialidade.map(r=>r.id);assert.equal(new Set(ids).size,5);
  for(const [code] of works){const draft=host.TGNativeReportModels.draftFor(os,'RAVAC',null,code);assert.equal(draft.assinaturaClienteNome,'Cliente '+code);assert.deepEqual(plain(draft.campos.estadoNativo.modelKeys),[code]);}
  const {w}=sheet(host.TGNativeReportModels.templateFor(os,'RAVAC','Instalação AVAC'));try{
   init(w);complete(w);const final={type:'relatorioEspecialidadeConcluido',...w.TGNativeSheet.serialize(true)};
   await assert.rejects(()=>host.TGNativeReportModels.persist('os','RAVAC',null,final,'Recarga de gás'),/trabalhos da OS mudaram/);
   await host.TGNativeReportModels.persist('os','RAVAC',null,final,'Instalação AVAC');assert.equal(host.dados.relatoriosEspecialidade.length,5);assert.equal(host.TGEquipmentReports.pending(os).length,4);assert.equal(host.numberCalls,1);
   assert.equal(host.dados.relatoriosEspecialidade.filter(r=>r.rascunho).length,4);assert.equal(host.dados.relatoriosEspecialidade.find(r=>!r.rascunho).id,ids[1]);
   assert(final.html.includes('Instalação'));assert(!final.html.includes('Registo de refrigerante'));assert(!final.html.includes('Limpeza e substituições'));
   os.tiposTrabalho=['Manutenção AC'];await assert.rejects(()=>host.TGNativeReportModels.persist('os','RAVAC',null,final,'Instalação AVAC'),/trabalhos da OS mudaram/);
  }finally{w.close()}
 }finally{host.close()}
});
test('AVAC native entry opens the requested subtype and generic entry offers a choice for a multi-work OS',async()=>{
 const host=setup();try{
  installEntry(host);const os=host.dados.servicos[0];os.tiposTrabalho=['Instalação AVAC','Recarga de gás'];host.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  await host._abrirModalRelatorioEspecialidade('os','RAVAC',()=>{});assert.equal(host.document.querySelectorAll('#native-work-picker [data-native-work]').length,2);assert(!host.document.getElementById('re_iframe'));host.document.getElementById('native-work-picker').remove();
  for(const code of os.tiposTrabalho){const opening=host._abrirModalRelatorioEspecialidade('os','RAVAC',()=>{},null,code);const frame=host.document.getElementById('re_iframe');await ready(frame);assert(frame.srcdoc.includes(code==='Recarga de gás'?'Registo de refrigerante':'Ensaios e colocação em serviço'));assert(!frame.srcdoc.includes(code==='Recarga de gás'?'Ensaios e colocação em serviço':'Registo de refrigerante'));frame.dispatchEvent(new host.Event('load'));await opening;}
 }finally{host.close()}
});
test('multi-work historical reports remain intact and cannot overwrite isolated drafts',async()=>{
 const host=setup();try{
  const os=host.dados.servicos[0];os.tiposTrabalho=['Instalação AVAC','Recarga de gás'];
  const legacy={id:'combined',adminId:'a',servicoId:'os',tipo:'RAVAC',rascunho:true,campos:{estadoNativo:{modelKeys:os.tiposTrabalho}}};host.dados.relatoriosEspecialidade=[legacy];
  assert.equal(host.TGNativeReportModels.draftFor(os,'RAVAC',null,'Instalação AVAC'),undefined);assert.equal(host.TGEquipmentReports.pending(os).length,2);
  legacy.rascunho=false;assert.equal(host.TGEquipmentReports.pending(os).length,0);assert.equal(host.dados.relatoriosEspecialidade[0],legacy);
  const otherTenant={...legacy,adminId:'other'};assert(!host.TGEquipmentReports.matches(otherTenant,os,host.TGEquipmentReports.requirements(os)[0]));
 }finally{host.close()}
});
test('fifteen ready-made native models contain authored sections, fields and unanswered checklists',()=>{
 const host=setup();try{const models=checklistModels(host);assert.equal(models.reduce((n,[,v])=>n+Object.keys(v).length,0),15);
 for(const [type,variants]of models)for(const [code,html]of Object.entries(variants)){const {w}=sheet(html);try{assert(w.document.querySelector('body[data-native-model="'+type+'"]'));assert(w.document.querySelectorAll('.section-head').length>=4,code);assert(w.document.querySelectorAll('.seg').length>=8,code);assert.equal(w.document.querySelectorAll('input[type=radio]:checked').length,0);assert(w.document.getElementById('_relBtnRascunho'));assert(w.document.getElementById('_relBtnConcluir'));assert(w.document.getElementById('sign_tecnico'));assert(!html.includes('Crie o seu relatório'));}finally{w.close()}}
 }finally{host.close()}
});
test('each work type opens its exact native model; AVAC works stay separate in a multi-work OS',()=>{
 const host=setup();try{const api=host.TGNativeReportModels;for(const c of host.TGSpecialtyCatalog.list)for(const [code,label]of c.work){assert.deepEqual(plain(api.selection({tiposTrabalho:[code]},c.type)),[code]);assert.deepEqual(plain(api.selection({tiposTrabalho:[label]},c.type)),[code]);}
 const os={tiposTrabalho:['Recarga de gás','Limpeza de filtros']};assert.equal(api.templateFor(os,'RAVAC'),null);const html=api.templateFor(os,'RAVAC','Recarga de gás');assert(html.includes('Registo de refrigerante'));assert(!html.includes('Limpeza e substituições'));assert(!api.templateFor({tiposTrabalho:['Limpeza regular']},'RLIM').includes('Registo de refrigerante'));
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
 const sw=fs.readFileSync('sw.js','utf8');for(const f of ['index.html','login.html']){const html=fs.readFileSync(f,'utf8');assert(html.includes('tg-specialty-templates.js?v=3.1.0-scie'));assert(!html.includes('src="tg-specialty-reports.js'));assert(!html.includes('tg-specialty-reports.css'));}assert(sw.includes('tg-specialty-templates.js?v=3.1.0-scie'));
 const main=fs.readFileSync('app-principal.js','utf8');assert(main.includes('templateFor(os,tipo,modeloCodigo)'));assert(!main.includes('return window.TGSpecialtyReports.open(osId, tipo'));
});
test('the actual OS report entrypoint uses the CCTV/intrusion iframe pipeline, fills the installation and confirms the native save',async()=>{
 const host=setup();let doc;try{
 const main=fs.readFileSync('app-principal.js','utf8'),fn=main.match(/        async function _abrirModalRelatorioEspecialidade\([^]*?\n        \}/)[0];
 host._tenantId=()=> 'a';host._numeroSeqPreview=()=>1;host.prompt=()=>null;host.escapeHtmlSimples=v=>String(v??'');host.obterNomeFuncionario=()=> 'Técnico QA';host._tgPrepararNomeFiscalEspecialidade=html=>html;host.REPORT_TYPE_DEFS={RAVAC:{nome:'AVAC'}};host.renderizarTudo=()=>{};host.eval(main.slice(main.indexOf('        function _tgAssinaturasRascunhoRuntime'),main.indexOf('        // O nome fiscal faz parte do branding:'))+main.slice(main.indexOf('        // Checkpoints remain local'),main.indexOf('        let _relEspecOnMessageAtual'))+'var _relEspecOnMessageAtual=null;'+fn);
 let done=0;const opening=host._abrirModalRelatorioEspecialidade('os','RAVAC',()=>done++);const frame=host.document.getElementById('re_iframe');await ready(frame);assert(frame);assert(frame.srcdoc.includes('Registo de refrigerante'));assert(!host.document.querySelector('.avac-form'));let initMsg;frame.contentWindow.postMessage=msg=>{if(msg.type==='init')initMsg=msg;};frame.dispatchEvent(new host.Event('load'));await opening;await new Promise(r=>setTimeout(r,180));assert.equal(initMsg.morada,'Rua da Loja');assert.equal(initMsg.instalacaoNome,'Loja');assert.equal(initMsg.osNumero,'OS-1');
 doc=sheet(frame.srcdoc);doc.w.dispatchEvent(new doc.w.MessageEvent('message',{source:doc.w.parent,data:initMsg}));const draft=doc.w.TGNativeSheet.serialize(false);host.dispatchEvent(new host.MessageEvent('message',{source:frame.contentWindow,data:{type:'relatorioEspecialidadeRascunho',...draft}}));await settled();assert.equal(host.writes.length,1);assert.equal(done,1);assert(!host.document.getElementById('overlayRelEspec').classList.contains('open'));assert.equal(host.dados.relatoriosEspecialidade[0].campos.modeloNativo,2);
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
test('all fifteen models can save again and finish after reopening a draft saved through the actual buttons',()=>{
 const host=setup();try{for(const [,variants] of checklistModels(host))for(const html of Object.values(variants)){
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
  host._tenantId=()=> 'a';host._numeroSeqPreview=()=>1;host.prompt=()=>null;host.escapeHtmlSimples=v=>String(v??'');host.obterNomeFuncionario=()=> 'Técnico QA';host._tgPrepararNomeFiscalEspecialidade=html=>html;host.REPORT_TYPE_DEFS={RAVAC:{nome:'AVAC'}};host.eval(main.slice(main.indexOf('        function _tgAssinaturasRascunhoRuntime'),main.indexOf('        // O nome fiscal faz parte do branding:'))+main.slice(main.indexOf('        // Checkpoints remain local'),main.indexOf('        let _relEspecOnMessageAtual'))+'var _relEspecOnMessageAtual=null;'+fn);
  const opening=host._abrirModalRelatorioEspecialidade('os','RAVAC',()=>{});const frame=host.document.getElementById('re_iframe');await ready(frame);assert(!frame.srcdoc.includes('OLD DISABLED SNAPSHOT'));assert(frame.srcdoc.includes('Registo de refrigerante'));let message;frame.contentWindow.postMessage=m=>{if(m.type==='init')message=m};frame.dispatchEvent(new host.Event('load'));await opening;await new Promise(r=>setTimeout(r,180));assert.equal(message.nativeRestoreState.values['native-work'],'Trabalho guardado');
 }finally{host.close()}
});
test('every checklist model persists a customer-signed incomplete draft and repaints it on fresh reopening before finalization',async()=>{
 const host=setup();try{for(const [type,variants]of checklistModels(host))for(const [code,html]of Object.entries(variants)){
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
  let release,confirmed=0,closed=0;host._guardarCacheLocal=()=>new Promise(r=>{release=()=>{confirmed++;r(true)}});
  host.eval(main.slice(main.indexOf('        function _tgAssinaturasRascunhoRuntime'),main.indexOf('        // O nome fiscal faz parte do branding:'))+main.slice(main.indexOf('        // Checkpoints remain local'),main.indexOf('        let _relEspecOnMessageAtual'))+'var _relEspecOnMessageAtual=null;'+fn);
  const opening=host._abrirModalRelatorioEspecialidade('os',type,()=>closed++);const frame=host.document.getElementById('re_iframe');await ready(frame);frame.dispatchEvent(new host.Event('load'));await opening;
  const signatureState={images:{sign_cliente:png},names:{sign_cliente_nome:'Cliente QA'}};
  const draft={type:'relatorioEspecialidadeRascunho',html:'<!doctype html><html><head></head><body>Draft</body></html>',assinaturaCliente:png,assinaturaClienteNome:'Cliente QA',assinaturasRascunho:signatureState,...(type==='REX'?{estadoRex:JSON.stringify({colIds:[1],assinaturasRascunho:signatureState})}:{})};
  host.dispatchEvent(new host.MessageEvent('message',{source:frame.contentWindow,data:draft}));await settled();
  const record=host.dados.relatoriosEspecialidade[0];assert(record.rascunho);assert.equal(record.assinaturaCliente,png);assert.equal(record.assinaturaClienteNome,'Cliente QA');assert.deepEqual(plain(record.campos.assinaturasRascunho),signatureState);assert.equal(closed,0);assert(host.document.getElementById('overlayRelEspec').classList.contains('open'));
  release();await settled();assert.equal(confirmed,1);assert.equal(closed,1);
 }finally{doc?.w.close();host.close()}
});

test('four cleaning works save separate signed drafts and finalizing one leaves the other three pending',async()=>{
 const host=setup();try{
  const os=host.dados.servicos[0],works=host.TGSpecialtyCatalog.list.find(c=>c.type==='RLIM').work;os.tiposTrabalho=works.map(w=>w[1]);let next=0;host.gerarId=()=> 'clean-'+(++next);
  const requirements=host.TGEquipmentReports.requirements(os);assert.equal(requirements.length,4);assert.equal(new Set(requirements.map(r=>r.modeloCodigo)).size,4);assert.equal(host.TGNativeReportModels.templateFor(os,'RLIM'),null);
  const photos={src:png,caption:'Antes do serviço'};
  for(const [code] of works){const {w}=sheet(host.TGNativeReportModels.templateFor(os,'RLIM',code));try{
   init(w);assert.equal(w.document.getElementById('modeloNome').textContent,code);w.document.getElementById('native-work').value='Trabalho '+code;w.document.getElementById('native-sign-cliente').value=png;w.document.getElementById('sign_cliente_nome').value='Cliente '+code;
   const snapshot=w.TGNativeSheet.serialize(false);snapshot.estadoNativo.photos=[photos];await host.TGNativeReportModels.persist('os','RLIM',null,{type:'relatorioEspecialidadeRascunho',...snapshot},code);
  }finally{w.close()}}
  assert.equal(host.dados.relatoriosEspecialidade.length,4);assert.equal(host.TGEquipmentReports.pending(os).length,4);assert.equal(new Set(host.dados.relatoriosEspecialidade.map(r=>r.id)).size,4);
  for(const [code] of works){const draft=host.TGNativeReportModels.draftFor(os,'RLIM',null,code);assert.equal(draft.assinaturaClienteNome,'Cliente '+code);assert.deepEqual(plain(draft.campos.estadoNativo.modelKeys),[code]);assert.equal(draft.campos.estadoNativo.photos[0].caption,photos.caption);}
  const draft=host.TGNativeReportModels.draftFor(os,'RLIM',null,'Desinfeção'),{w}=sheet(host.TGNativeReportModels.templateFor(os,'RLIM','Desinfeção'));try{
   init(w);w.dispatchEvent(new w.MessageEvent('message',{source:w.parent,data:{type:'init',podeAssinar:true,nativeRestoreState:draft.campos.estadoNativo}}));assert.equal(w.document.getElementById('native-work').value,'Trabalho Desinfeção');assert.equal(w.document.getElementById('native-sign-cliente').value,png);complete(w);
   const final={type:'relatorioEspecialidadeConcluido',...w.TGNativeSheet.serialize(true)};
   await assert.rejects(()=>host.TGNativeReportModels.persist('os','RLIM',null,final,'Limpeza profunda'),/trabalhos da OS mudaram/);
   await host.TGNativeReportModels.persist('os','RLIM',null,final,'Desinfeção');assert.equal(host.numberCalls,1);assert.equal(host.dados.relatoriosEspecialidade.length,4);assert.equal(host.dados.relatoriosEspecialidade.find(r=>!r.rascunho).id,draft.id);assert.equal(host.TGEquipmentReports.pending(os).length,3);
   assert(final.html.includes('Produto e aplicação'));assert(!final.html.includes('Remoção de resíduos e limpeza'));assert(!final.html.includes('Tratamentos e execução'));
   os.tiposTrabalho=['Limpeza profunda'];await assert.rejects(()=>host.TGNativeReportModels.persist('os','RLIM',null,final,'Desinfeção'),/trabalhos da OS mudaram/);
  }finally{w.close()}
 }finally{host.close()}
});
test('cleaning entry and work badges target each exact form while generic entry offers four choices',async()=>{
 const host=setup();try{
  installEntry(host);const os=host.dados.servicos[0];os.tiposTrabalho=['Limpeza regular','Limpeza profunda','Limpeza pós-obra','Desinfeção'];host.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  await host._abrirModalRelatorioEspecialidade('os','RLIM',()=>{});const picker=host.document.getElementById('native-work-picker');assert.equal(picker.querySelectorAll('[data-native-work]').length,4);assert(!picker.textContent.includes('AVAC'));picker.remove();
  for(const code of os.tiposTrabalho){const opening=host._abrirModalRelatorioEspecialidade('os','RLIM',()=>{},null,code),frame=host.document.getElementById('re_iframe');await ready(frame);const {w}=sheet(frame.srcdoc);try{assert.equal(w.document.getElementById('modeloNome').textContent,code);assert.deepEqual(plain(w.TGNativeSheet.state().modelKeys),[code]);}finally{w.close()}frame.dispatchEvent(new host.Event('load'));await opening;}
  const main=fs.readFileSync('app-principal.js','utf8');host.TIPOS_ESPECIALIDADE=['RAVAC','RLIM'];host.eval(main.match(/        function _tiposTrabalhoBadgesHTML\([^]*?\n        \}/)[0]);const dom=new JSDOM(host._tiposTrabalhoBadgesHTML(os));try{const badges=dom.window.document.querySelectorAll('span[onclick]');assert.equal(badges.length,4);for(const code of os.tiposTrabalho)assert([...badges].some(b=>b.getAttribute('onclick').includes("'RLIM'")&&b.getAttribute('onclick').includes("'"+code+"'")));}finally{dom.window.close()}
 }finally{host.close()}
});
test('cleaning exit queue starts four distinct reports and retains historical combined documents',()=>{
 const host=setup();try{
  const os=host.dados.servicos[0];os.tiposTrabalho=['Limpeza regular','Limpeza profunda','Limpeza pós-obra','Desinfeção'];const main=fs.readFileSync('app-principal.js','utf8');for(const name of ['_requisitosEspecialidadePorIniciar','abrirFilaRelatoriosEspecialidade'])host.eval(main.match(new RegExp('        function '+name+'\\([^]*?\\n        \\}'))[0]);
  const opened=[];host._abrirModalRelatorioEspecialidade=(id,type,saved,equipment,model)=>{opened.push(model);host.dados.relatoriosEspecialidade.push({id:model,adminId:'a',servicoId:id,tipo:type,rascunho:true,campos:{estadoNativo:{modelKeys:[model]}}});saved()};let finished=0;host.abrirFilaRelatoriosEspecialidade('os',[],()=>finished++);assert.deepEqual(plain(opened),os.tiposTrabalho);assert.equal(finished,1);assert.equal(host.TGEquipmentReports.pending(os).length,4);
  const old={id:'legacy-clean',adminId:'a',servicoId:'os',tipo:'RLIM',rascunho:false,campos:{estadoNativo:{modelKeys:os.tiposTrabalho}}};host.dados.relatoriosEspecialidade=[old];assert.equal(host.TGEquipmentReports.pending(os).length,0);assert.equal(host.dados.relatoriosEspecialidade[0],old);
 }finally{host.close()}
});

test('SCIE terms use the Incêndio OS options and independent drafts with technician-only signatures',async()=>{
 const host=setup();
 const views=[];
 try{
  const os=host.dados.servicos[0],admin=host.dados.administradores[0];
  os.tiposTrabalho=['TRSI','TRSM'];os.descricao='Verificação programada';
  os.planoManutencao={relatoriosEquipamentos:[{tipo:'RSI',equipamentoId:'eq',equipamentoNome:'Central de incêndio'}]};
  admin.areasNegocio=['seguranca'];admin.nomeFiscal='Instalações QA, Lda.';admin.nif='500000000';admin.numeroAnepc='456';
  host.dados.locais[0].codigoPostal='1000-001';
  host.TIPOS_TRABALHO_GRUPO_INCENDIO=['RSI','TRSI','TRSM'];
  installEntry(host);host.REPORT_TYPE_DEFS.RSI={nome:'Central de Incêndio (SADI)'};
  let serial=0;host.gerarId=()=> 'scie-'+(++serial);
  const entries=host.TGEquipmentReports.requirements(os);
  assert.deepEqual(plain(entries.filter(r=>!r.equipamentoId).map(r=>[r.tipo,r.modeloCodigo])),[['TRSI','TRSI'],['TRSM','TRSM']]);
  assert.equal(host.TGNativeReportModels.templateFor({tiposTrabalho:[]},'TRSI'),null);

  for(const type of ['TRSI','TRSM']){
   const opening=host._abrirModalRelatorioEspecialidade(os.id,type,()=>{});
   const frame=host.document.getElementById('re_iframe');await ready(frame);
   let prefill;frame.contentWindow.postMessage=m=>{if(m.type==='init')prefill=m;};
   frame.dispatchEvent(new host.Event('load'));await opening;
   for(let i=0;i<40&&!prefill;i++)await new Promise(resolve=>setTimeout(resolve,10));
   assert.equal(prefill.scieAddress,'Rua da Loja, 1000-001');
   assert.equal(prefill.scieEquipmentList,'Central de incêndio');
   const editor=sheet(frame.srcdoc);views.push(editor.w);
   const initWith=(w,msg)=>w.dispatchEvent(new w.MessageEvent('message',{source:w.parent,data:msg}));
   initWith(editor.w,prefill);
   const get=id=>editor.w.document.getElementById(id);
   assert.equal(get('native-instalacao').value,'Loja');
   assert.equal(get('scie-company').value,'Instalações QA, Lda.');
   assert.equal(get('scie-anepc').value,'456');
   assert.equal(get('sign_tecnico_nome').value,'Técnico QA');
   assert.equal(get('scie-tech-nif').value,'');
   assert.equal(get('sign_cliente'),null);
   get('_relBtnRascunho').click();
   await host.TGNativeReportModels.persist(os.id,type,null,editor.messages[0],type);
   const draft=host.dados.relatoriosEspecialidade.find(r=>r.tipo===type);
   assert(draft.rascunho);assert.equal(draft.assinaturaCliente,null);
   const next=sheet(frame.srcdoc);views.push(next.w);
   initWith(next.w,{...prefill,nativeRestoreState:draft.campos.estadoNativo});
   const field=id=>next.w.document.getElementById(id);
   assert.equal(field('scie-equipment-list').value,'Central de incêndio');
   assert.equal(next.w.TGNativeSheet.validate(true).length>0,true);
   field('scie-tech-nif').value='200000000';
   field(type==='TRSI'?'scie-certificates':'scie-maintenance').value=type==='TRSI'?'Certificado 2026/1':'Limpeza e ensaios';
   field('scie-confirm').checked=true;
   field('native-sign-tecnico').value=png;
   const signed=next.w.TGNativeSheet.serialize(false).estadoNativo;
   const another=sheet(frame.srcdoc);views.push(another.w);
   initWith(another.w,{...prefill,scieSigner:'other',tecnicoNome:'Outro técnico',nativeRestoreState:signed});
   assert.equal(another.w.document.getElementById('native-sign-tecnico').value,'');
   assert.equal(another.w.document.getElementById('scie-tech-nif').value,'');
   field('scie-equipment').dispatchEvent(new next.w.Event('input',{bubbles:true}));
   assert.equal(field('native-sign-tecnico').value,'');
   assert.equal(field('scie-confirm').checked,false);
   field('scie-confirm').checked=true;field('native-sign-tecnico').value=png;
   field('_relBtnConcluir').click();
   const final=next.messages[0];assert.equal(final.type,'relatorioEspecialidadeConcluido');
   assert(final.html.includes(type==='TRSI'?'PÁGINA 12/13':'PÁGINA 13/13'));
   assert(final.html.includes('assinatura do técnico responsável'));assert(!final.html.includes('<canvas'));
   await host.TGNativeReportModels.persist(os.id,type,null,final,type);
   const saved=host.dados.relatoriosEspecialidade.find(r=>r.tipo===type);
   assert.equal(saved.id,draft.id);assert.equal(saved.rascunho,false);assert.equal(saved.assinaturaTecnico,png);
  }
  assert.equal(host.numberCalls,2);
  assert.equal(host.TGEquipmentReports.pending(os).filter(r=>!r.equipamentoId).length,0);
 }finally{for(const view of views)view.close();host.close();}
});
