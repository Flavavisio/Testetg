const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const fill=require('./fixtures/electrical-state.cjs');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=';
function setup(){
 const w=new JSDOM('<div id="tgReportMenu"></div>',{runScripts:'outside-only',url:'https://totalgest.test/'}).window;
 w.usuarioLogado={id:'a',nome:'Técnico QA',role:'admin'};w.dados={administradores:[{id:'a',ativo:true,areasNegocio:['eletricidade']}],clientes:[{id:'c',adminId:'a',nome:'Cliente QA',numeroCliente:'42'}],locais:[{id:'l',adminId:'a',clienteId:'c',nome:'Instalação QA'}],servicos:[{id:'os',adminId:'a',clienteId:'c',localId:'l',tiposTrabalho:['Relatório de exploração']}],relatoriosEspecialidade:[]};
 w.adminDoUtilizador=()=>w.dados.administradores[0];w._licencaValidaTenant=()=>true;w.REPORT_TEMPLATES={};w.getDataHoje=()=> '2026-10-30';let n=0;w.gerarId=()=> 'electric-'+(++n);w.proximoNumeroRelatorio=async()=>++n;w.M={relatoriosEspecialidade:{to:v=>v}};w._guardarCacheLocal=()=>{};w.writes=[];
 w.supa={from:()=>{let row,mode;const q={insert:v=>(row=v,mode='insert',q),update:v=>(row=v,mode='update',q),eq:()=>q,select:()=>q,single:async()=>{w.writes.push({row,mode});return {data:{id:row.id}};}};return q;}};
 w.fetch=async url=>{const file=fs.readFileSync(path.join(process.cwd(),new URL(url).pathname));return {ok:true,arrayBuffer:async()=>file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)}};
 for(const file of ['tg-specialty-catalog.js','tg-equipment-reports.js','vendor/pdf-lib-1.17.1.min.js','vendor/fontkit-1.1.1.min.js','tg-electrical-legal.js','tg-specialty-templates.js'])w.eval(fs.readFileSync(file,'utf8'));
 return w;
}
function sheet(host,code='Relatório de exploração'){
 const html=host.TGNativeReportModels.models.RELE[code];
 const w=new JSDOM(html,{runScripts:'dangerously',url:'https://totalgest.test/',beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},drawImage(){}});}}).window;
 w._relPrefill({cliente:'Cliente QA',tecnicoNome:'Técnico QA',empresaNome:'Empresa QA',empresaFiscal:'Empresa Fiscal QA',data:'2026-10-30',osNumero:'OS-QA',numero:'RELE-42-001'});fill(w);
 w.document.querySelectorAll('.seg').forEach(seg=>seg.querySelector('input').checked=true);w.document.getElementById('native-sign-tecnico').value=png;w.document.getElementById('native-work').value='Verificação da instalação em visita de teste';w.document.getElementById('native-client-status').value='Cliente ausente';return w;
}
const plain=v=>JSON.parse(JSON.stringify(v));
test('all six electrical works, including historical verification labels, route to independent reports',()=>{
 const host=setup();try{const c=host.TGSpecialtyCatalog.list.find(c=>c.type==='RELE'),os=host.dados.servicos[0];assert.equal(c.work.length,6);os.tiposTrabalho=c.work.map(w=>w[1]);const reqs=host.TGEquipmentReports.requirements(os);assert.equal(reqs.length,6);assert.equal(new Set(reqs.map(r=>r.modeloCodigo)).size,6);assert.equal(host.TGNativeReportModels.templateFor(os,'RELE'),null);assert.deepEqual(plain(host.TGNativeReportModels.selection({tiposTrabalho:['Certificação / vistoria']},'RELE')),['Certificação elétrica']);assert(c.work.find(w=>w[0]==='Certificação elétrica')[1].includes('preparação para inspeção'));
 }finally{host.close()}
});
test('exploration model contains every current DGEG section, 23 unanswered checks and all seasonal measurements',()=>{
 const host=setup(),w=sheet(host);try{
  assert.equal(w.document.querySelectorAll('.seg').length,23);assert.equal(w.TGNativeSheet.state().modelKeys[0],'Relatório de exploração');
  for(const id of ['division','period_start','period_end','owner_nif','tech_cc','tech_dgeg','tech_oe','tech_oet','site_parish','site_county','nip','installation_type','ptc','pt6','gg6','pt_unique_earth_winter','soc_service_summer','seg_protection_winter','bt_insulation','bt_test_voltage','bt_power_factor','observations','related','changes','owner_relations','attachment_count','sriesp'])assert(w.document.getElementById('electric-'+id),id);
  assert.equal(w.document.querySelectorAll('[data-electric-detail="pt"]:not([hidden])').length,0);
  assert.equal(host.TGNativeReportModels.validate('RELE',w.TGNativeSheet.state(),true).length,0);
 }finally{w.close();host.close()}
});
test('legal validation rejects missing professional registration, contradictory conditions, periods and unsupported measurements',()=>{
 const host=setup(),w=sheet(host);try{
  const state=w.TGNativeSheet.state(),valid=plain(state);assert.equal(host.TGElectricalRules.validate(state,true).length,0);
  for(const patch of [{'electric-tech_dgeg':'','electric-tech_oe':'','electric-tech_oet':''},{'electric-qualification':'Por confirmar'},{'electric-period_start':'2027-01-01'},{'electric-owner_nif':'123'},{'electric-bt_power_factor':'1.5'},{'electric-bt_insulation':'-1'},{'electric-bt_limitations':''},{'electric-safety':'Sim'},{'electric-installation_type':'B','electric-ptc':''},{sign_tecnico_nome:'Outra pessoa'}]){const s=plain(valid);Object.assign(s.values,patch);assert(host.TGElectricalRules.validate(s,true).length,JSON.stringify(patch));assert.equal(host.TGElectricalRules.validate(s,false).length,0);}
 }finally{w.close();host.close()}
});
test('six drafts remain independent; issuing one technical report cannot complete the exploration report',async()=>{
 const host=setup();try{const os=host.dados.servicos[0],c=host.TGSpecialtyCatalog.list.find(c=>c.type==='RELE');os.tiposTrabalho=c.work.map(w=>w[0]);
  for(const [code]of c.work){const w=sheet(host,code);try{await host.TGNativeReportModels.persist('os','RELE',null,{type:'relatorioEspecialidadeRascunho',...w.TGNativeSheet.serialize(false)},code);}finally{w.close()}}
  assert.equal(host.dados.relatoriosEspecialidade.length,6);assert.equal(new Set(host.dados.relatoriosEspecialidade.map(r=>r.id)).size,6);
  const w=sheet(host,'Quadro elétrico');try{w.document.querySelectorAll('[data-native-required]').forEach(el=>el.value='Identificação QA');w.document.getElementById('native-result').selectedIndex=1;await host.TGNativeReportModels.persist('os','RELE',null,{type:'relatorioEspecialidadeConcluido',...w.TGNativeSheet.serialize(true)},'Quadro elétrico');assert.equal(host.TGEquipmentReports.pending(os).length,5);assert(host.TGEquipmentReports.pending(os).some(r=>r.modeloCodigo==='Relatório de exploração'));}finally{w.close()}
 }finally{host.close()}
});
test('official PDF uses the original four pages, adds complete annexes, preserves source and is retained with the issued record',async()=>{
 const host=setup(),w=sheet(host);try{
  const snapshot=w.TGNativeSheet.serialize(true),state=snapshot.estadoNativo;
  const pdf=await host.TGElectricalLegal.exportPDF(state,{final:true});assert(pdf.dataUri.startsWith('data:application/pdf;base64,'));assert(pdf.pages>=5);assert.equal(pdf.model,'DGEG.DSEE.Mod_Relatorio_v2024');
  fs.mkdirSync('/tmp/electrical-qa',{recursive:true});fs.writeFileSync('/tmp/electrical-qa/exploration-filled.pdf',Buffer.from(pdf.dataUri.split(',')[1],'base64'));
  const draft=await host.TGElectricalLegal.exportPDF(state,{final:false});fs.writeFileSync('/tmp/electrical-qa/exploration-draft.pdf',Buffer.from(draft.dataUri.split(',')[1],'base64'));
  const changed=plain(state);changed.values['electric-qualification']='Por confirmar';await assert.rejects(()=>host.TGElectricalLegal.exportPDF(changed,{final:true}),/habilitação/);
  await host.TGNativeReportModels.persist('os','RELE',null,{type:'relatorioEspecialidadeConcluido',...snapshot},'Relatório de exploração');const record=host.dados.relatoriosEspecialidade[0];assert(!record.rascunho);assert(record.campos.htmlSnapshot.includes('data-native-official-pdf'));assert(record.campos.htmlSnapshot.includes('data:application/pdf;base64,'));assert.equal(record.campos.modeloPdfDgeg,pdf.model);assert.equal(record.campos.estadoNativo.values['native-numero'],record.numeroDocumento);
 }finally{w.close();host.close()}
});
