 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const canonical=type=>type==='AVAC'?'RAVAC':type;
 const configFor=type=>window.TGSpecialtyCatalog.list.find(c=>c.type===canonical(type));
 const separate=type=>['RAVAC','RLIM','RELE'].includes(canonical(type));
 const actor=()=>typeof usuarioLogado==='undefined'?null:usuarioLogado;
 const safeImage=v=>typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v)&&v.length<1500000;
 function selection(os,type,modelKey){const c=configFor(type);if(c?.scie)return c.matches(os)&&(!modelKey||modelKey===c.type)?[c.type]:[];const keys=Object.keys(MODEL_DATA[canonical(type)]||{});const selected=keys.filter(code=>(os?.tiposTrabalho||[]).some(t=>c.codeFor(t)===code));const available=selected.length?selected:keys.slice(0,1);return modelKey?available.filter(k=>k===modelKey):available;}
 function draftFor(os,type,equipmentId,modelKey){return (dados.relatoriosEspecialidade||[]).find(r=>r.adminId===os.adminId&&r.servicoId===os.id&&canonical(r.tipo)===canonical(type)&&(r.campos?.equipamentoId||null)===(equipmentId||null)&&r.rascunho&&(!modelKey||JSON.stringify(r.campos?.estadoNativo?.modelKeys)===JSON.stringify([modelKey])));}
 function chooseWork(osId,type,onSaved,equipmentId){
  const ctx=guard(osId,type);if(!ctx)return;
  const config=configFor(type),dialog=document.createElement('dialog');dialog.id='native-work-picker';dialog.style='border:0;border-radius:12px;max-width:540px;width:92vw;padding:20px';
  dialog.innerHTML='<h2>Selecionar relatório — '+esc(config.title)+'</h2><p>Cada tipo de trabalho tem o seu relatório e rascunho.</p>'+selection(ctx.os,type).map(key=>'<button type="button" data-native-work="'+esc(key)+'" style="display:block;width:100%;padding:14px;margin:8px 0;font-size:16px">'+esc(config.work.find(w=>w[0]===key)?.[1]||key)+'</button>').join('')+'<button type="button" data-close>Cancelar</button>';
  document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.remove();dialog.addEventListener('cancel',()=>dialog.remove());
  dialog.querySelectorAll('[data-native-work]').forEach(b=>b.onclick=()=>{const key=b.dataset.nativeWork;dialog.remove();open(osId,type,onSaved,equipmentId,key);});dialog.showModal();
 }
 function blueprint(type,keys){
  type=canonical(type);const models=MODEL_DATA[type];let number=0;const checkIds=[],requiredFields=[],sections=[];
  for(const key of keys){if(!models?.[key])continue;const modelIndex=Object.keys(models).indexOf(key);
   models[key].forEach((section,sectionIndex)=>{
    const id=type+'_'+modelIndex+'_'+sectionIndex;number++;
    const fields=section.fields.map((item,i)=>{
     const def=typeof item==='string'?{label:item}:item,label=def.label,fid=def.key?'electric-'+def.key:'field_'+id+'_'+i,required=def.required||(section.required||[]).includes(label);
     if(required)requiredFields.push({id:fid,label});
     const kind=def.type||(label.length>65||/trabalhos|anomalias|reparaç|diagnóstico|tarefas|resíduos|limitações|observações|condições|materiais|ensaios|circuitos intervencionados/i.test(label)?'textarea':'text');
     const attrs=' id="'+fid+'" data-native-label="'+esc(label)+'" '+(required?'data-native-required':'');
     const control=kind==='textarea'?'<textarea'+attrs+' rows="'+(def.rows||3)+'"></textarea>':kind==='select'?'<select'+attrs+'><option value="">Escolher…</option>'+(def.options||[]).map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select>':'<input type="'+esc(kind)+'"'+attrs+(kind==='number'?' min="0" step="any"':'')+'>';
     const group=section.group&&def.key!==section.group+'_app'?' data-electric-detail="'+section.group+'"':'';
     return '<label class="config-field"'+group+'>'+esc(label)+control+'</label>';
    }).join('');
    const checks=section.checks.map((text,i)=>{const name='check_'+id+'_'+i;checkIds.push(name);return '<tr><td class="code">'+(section.checkPrefix||number)+'.'+(i+1)+'</td><td class="desc">'+esc(text)+'<input class="obs-input" id="obs_'+name+'" type="text" aria-label="Observação da verificação '+(section.checkPrefix||number)+'.'+(i+1)+'" placeholder="Observação / valor / limitação"></td><td class="result"><div class="seg" role="radiogroup" aria-label="'+esc(text)+'">'+[['OK',section.officialChecks?'C':'OK','ok'],['NOK',section.officialChecks?'NC':'NÃO OK','nok'],['N/A',section.officialChecks?'NA':'N/A','na']].map(([value,label,cls],j)=>'<input type="radio" name="'+name+'" id="'+name+'_'+j+'" value="'+value+'"><label class="'+cls+'" for="'+name+'_'+j+'">'+label+'</label>').join('')+'</div></td></tr>';}).join('');
    sections.push('<section class="section"><div class="section-head"><span class="num">'+esc(section.code||number)+'</span><h2>'+esc(section.title)+'</h2></div><div class="config-row">'+fields+'</div><table class="checklist" aria-label="'+esc(section.title)+'">'+checks+'</table></section>');
   });
  }
  return {html:sections.join(''),checkIds,requiredFields,count:number};
 }
 function buildSCIE(config){
  const installation=config.type===SCIE.installation;
  const systems='<input id="scie-equipment" aria-label="Equipamentos e/ou sistemas" maxlength="160">';
  const maintenance='<input id="scie-maintenance" aria-label="Serviços de manutenção prestados" maxlength="180">';
  const replacements={
   TITLE:esc(config.title),TYPE:config.type,PAGE:installation?'12':'13',
   SUBTITLE:installation?'(Técnico responsável da entidade instaladora de equipamentos e sistemas de SCIE)':'(Técnico responsável da entidade prestadora de serviços de manutenção de equipamentos e sistemas de SCIE)',
   DECLARATION:installation
    ? 'no âmbito da Portaria n.º 773/2009, de 21 de julho, na sua redação atual, declara que instalou os seguintes equipamentos e/ou sistemas '+systems+', no edifício/recinto acima referido, o(s) qual (quais) se encontra(m) em conformidade com o projeto de segurança, as normas aplicáveis e em perfeita operacionalidade.'
    : 'no âmbito da Portaria n.º 773/2009, de 21 de julho, declara que prestou os seguintes serviços de manutenção '+maintenance+', relativos ao seguintes equipamentos e/ou sistemas '+systems+', no edifício/recinto acima referido, o(s) qual (quais) se encontra(m) em perfeita operacionalidade.',
   ENTITY_DECLARATION:installation
    ? 'Mais se declara que o signatário instalou os equipamentos e/ou sistemas ao serviço da entidade'
    : 'Mais se declara que o signatário prestou os serviços de manutenção aos equipamentos e/ou sistemas ao serviço da entidade',
   ATTACHMENT_DECLARATION:installation
    ? 'Deste termo de responsabilidade faz parte integrante a lista do(s) equipamento(s) e/ou sistema(s) instalado(s) e respetivos certificados.'
    : 'Deste termo de responsabilidade faz parte integrante a lista do(s) equipamento(s) e/ou sistema(s) objeto das ações de manutenção referidas.',
   CERTIFICATES:installation?'<label>Referências dos certificados<textarea id="scie-certificates" maxlength="12000"></textarea></label><p class="native-screen">Junta os certificados referenciados ao entregar o termo.</p>':'',
   CONFIG_JSON:JSON.stringify({type:config.type,keys:[config.type],scie:true}),
  };
  return SCIE_SHELL.replace(/__(TITLE|TYPE|PAGE|SUBTITLE|DECLARATION|ENTITY_DECLARATION|ATTACHMENT_DECLARATION|CERTIFICATES|CONFIG_JSON)__/g,(_,key)=>replacements[key]);
 }
 function build(type,keys){
  type=canonical(type);const c=configFor(type);if(c?.scie)return buildSCIE(c);keys=keys||Object.keys(MODEL_DATA[type]).slice(0,1);const spec=blueprint(type,keys);
  const labels=[['contrato','Ref.ª contrato'],['numero','Relatório n.º'],['data','Data'],['nCliente','N.º cliente'],['cliente','Cliente',true],['morada','Morada da instalação',true],['porta','Número de porta'],['localidade','Localidade'],['codigoPostal','Código postal'],['os','Ordem de serviço'],['instalacao','Instalação / local',true],['tecnico','Técnico responsável',true]];
  const meta=labels.map(([id,label,wide])=>'<label class="cell'+(wide?' wide':'')+'">'+esc(label)+'<input id="native-'+id+'" type="'+(id==='data'?'date':'text')+'"></label>').join('');
  const subtitle=keys.map(k=>c.work.find(([code])=>code===k)?.[1]||k).join(' · ');
  const title=type==='RAVAC'?'Relatório AVAC — '+subtitle:type==='RLIM'?'Relatório de limpeza — '+subtitle:c.title+' — '+subtitle;
  const legal=type==='RELE'&&keys.length===1&&keys[0]==='Relatório de exploração';
  const note=legal?'Modelo DGEG completo: Anexo I do Despacho n.º 31/2026, de 16 de abril. O relatório deve ser emitido pelo técnico habilitado responsável pela exploração. O registo do ato no SRIESP é efetuado pelo técnico; a Total Gest não efetua a submissão nem valida o registo profissional. Inspeções de verão e inverno: artigo 16.º do DL 96/2017.':c.note;
  const replacements={TITLE:title,TYPE:type,TRADE:c.area==='avac'?'AVAC':c.area==='limpeza'?'Limpeza e Desinfeção':'Eletricidade',SUBTITLE:subtitle,META:meta,SECTIONS:spec.html,FINAL_NUMBER:spec.count+1,RESULTS:'<option value="">Escolher…</option>'+(legal?['Boas condições de segurança','Condições deficientes','Cessação da responsabilidade']:c.results||['Operacional','Operacional com recomendações','Não operacional','Desativado']).map(x=>'<option>'+esc(x)+'</option>').join(''),NOTE:esc(note),CONFIG_JSON:JSON.stringify({type,keys,checkIds:spec.checkIds,requiredFields:spec.requiredFields,legal}).replace(/</g,'\\u003c')};
  return SHELL.replace(/__(TITLE|TYPE|TRADE|SUBTITLE|META|SECTIONS|FINAL_NUMBER|RESULTS|NOTE|CONFIG_JSON)__/g,(_,key)=>replacements[key]);
 }
 function scope(data,user,osId,type,licensed=true){
  const config=configFor(type);if(!config||!user||!licensed||!['admin','subadmin','encarregado','funcionario'].includes(user.role))return null;
  const tenant=user.role==='admin'?user.id:user.adminId;
  const admin=(data.administradores||[]).find(a=>a.id===tenant&&a.ativo!==false);
  if(!window.TGSpecialtyCatalog.areaEnabled(config,admin))return null;
  const os=(data.servicos||[]).find(o=>o.id===osId&&o.adminId===tenant);if(!os||(config.scie&&!config.matches(os)))return null;
  const manager=['admin','subadmin'].includes(user.role),ids=Array.isArray(os.funcionariosIds)&&os.funcionariosIds.length?os.funcionariosIds:[os.funcionarioId].filter(Boolean);
  const person=(user.role==='encarregado'?data.encarregados:data.funcionarios)?.find(p=>p.id===user.id&&p.adminId===tenant);
  if((user.permissoesNegadas||person?.permissoesNegadas||[]).some(x=>['servicos','relatorio-os'].includes(x)))return null;
  if(!manager&&(!person||person.suspenso))return null;
  const team=user.role==='encarregado'?person.funcionariosIds||[]:[];
  if(!manager&&!ids.includes(user.id)&&!ids.includes('todos')&&!ids.includes('Todos')&&!team.some(id=>ids.includes(id)))return null;
  if(!manager&&os.relatorioResponsavelId&&os.relatorioResponsavelId!==user.id&&!team.includes(os.relatorioResponsavelId))return null;
  const customer=(data.clientes||[]).find(c=>c.id===os.clienteId&&c.adminId===tenant),local=os.localId?(data.locais||[]).find(l=>l.id===os.localId&&l.adminId===tenant&&l.clienteId===os.clienteId):null;
  if(!customer||(os.localId&&!local))return null;
  const designated=config.scie ? os.relatorioResponsavelId : null;
  const signerName=designated&&designated!==user.id
   ? [...(data.funcionarios||[]),...(data.encarregados||[]),admin]
      .find(p=>p.id===designated&&(p.adminId===tenant||p.id===tenant))?.nome||''
   : user.nome||'';
  const canSign=(!designated||designated===user.id)&&(manager||user.role==='encarregado'||person?.podeAssinarRelatorios!==false);
  return {tenant,admin,os,customer,local,canSign,signerName};
 }
 const guard=(osId,type)=>scope(dados,actor(),osId,type,typeof _licencaValidaTenant==='function'&&_licencaValidaTenant());
 function validate(type,state,final){
  const errors=[];type=canonical(type);const scie=configFor(type)?.scie;
  if(!state||state.type!==type||state.version!==2||!Array.isArray(state.modelKeys)||!state.modelKeys.length||(scie?(state.modelKeys.length!==1||state.modelKeys[0]!==type):state.modelKeys.some(k=>!MODEL_DATA[type]?.[k])))return ['O relatório não corresponde a um modelo de especialidade válido.'];
  if(!final)return errors;
  const v=state.values||{};
  if(scie){
   if(!safeImage(state.techSignature))errors.push('Falta a assinatura do técnico responsável.');
   return errors.concat(SCIE.errors(state));
  }
  const spec=blueprint(type,state.modelKeys);
  if(spec.requiredFields.some(f=>!String(v[f.id]||'').trim()))errors.push('Preenche os campos de identificação e registo técnico obrigatórios.');
  if(spec.checkIds.some(id=>!['OK','NOK','N/A'].includes(state.answers?.[id])))errors.push('Existem verificações por preencher.');
  if(!v['native-work']?.trim()||!v['native-result'])errors.push('Regista os trabalhos e o resultado.');
  if(!v.sign_tecnico_nome?.trim()||!safeImage(state.techSignature))errors.push('Falta o nome ou a assinatura do técnico.');
  if(!['Assinado','Cliente ausente','Cliente não assinou'].includes(v['native-client-status']))errors.push('Regista a receção pelo cliente.');
  if(v['native-client-status']==='Assinado'&&(!v.sign_cliente_nome?.trim()||!safeImage(state.clientSignature)))errors.push('Falta o nome ou a assinatura do cliente.');
  if(Object.values(state.answers||{}).includes('NOK')&&!v['native-observations']?.trim()&&!v['electric-observations']?.trim())errors.push('Descreve as anomalias nas observações.');
  errors.push(...window.TGElectricalRules.validate(state,final));
  return errors;
 }
 async function persist(osId,type,equipmentId,msg,modelKey){
  type=canonical(type);const ctx=guard(osId,type),user=actor();if(!ctx)throw Error('O acesso à OS ou à especialidade mudou. Reabre o relatório.');
  const draft=msg.type==='relatorioEspecialidadeRascunho',state=msg.estadoNativo,errors=validate(type,state,!draft);
  if(!draft&&!ctx.canSign)errors.push('Não tens autorização para assinar este relatório.');
  if(!draft&&configFor(type).scie&&(state?.values?.['scie-signer']!==user.id||state?.values?.sign_tecnico_nome!==user.nome))errors.push('O termo deve ser assinado pelo técnico responsável na sua própria sessão.');
  const expected=selection(ctx.os,type,modelKey);
  if((separate(type)&&expected.length!==1)||JSON.stringify(state?.modelKeys)!==JSON.stringify(expected))errors.push('Os trabalhos da OS mudaram. Reabre o relatório para carregar o modelo atual.');
  if(errors.length)throw Error(errors.join(' '));
  if(!msg.html?.includes('data-native-model="'+type+'"'))throw Error('O documento não corresponde ao modelo da especialidade.');
  if(equipmentId&&!window.TGEquipmentReports?.requirements(ctx.os).some(r=>r.tipo===type&&r.equipamentoId===equipmentId))throw Error('O equipamento já não está associado a este relatório.');
  const existing=draftFor(ctx.os,type,equipmentId,separate(type)?expected[0]:null);
  const id=existing?.id||gerarId();let number=existing?.numeroDocumento||'RASCUNHO-'+type+'-'+id;
  if(!draft){const n=await proximoNumeroRelatorio(ctx.customer.id,type,1);if(n==null)throw Error('Não foi possível reservar o número do relatório.');number=type+'-'+(ctx.customer.numeroCliente||ctx.customer.id.slice(0,6))+'-'+String(n).padStart(3,'0');}
  const current=guard(osId,type);if(!current||actor().id!==user.id||(!draft&&!current.canSign))throw Error('A sessão ou as permissões mudaram. Reabre o relatório.');
  const document=new DOMParser().parseFromString(msg.html,'text/html'),no=document.getElementById('native-numero');if(no){if(no.tagName==='INPUT')no.setAttribute('value',number);else no.textContent=number;}
  state.values['native-numero']=number;
  const official=window.TGElectricalRules.active(state)&&!draft?await window.TGElectricalLegal.exportPDF(state,{final:true}):null;
  if(actor()?.id!==user.id||!guard(osId,type))throw Error('A sessão ou as permissões mudaram durante a preparação do PDF. Reabre o relatório.');
  if(official){const link=document.createElement('a');link.className='native-screen';link.dataset.nativeOfficialPdf='';link.href=official.dataUri;link.download=official.filename;link.textContent='Descarregar relatório no modelo DGEG completo ('+official.pages+' páginas, incluindo anexos)';link.style='display:block;padding:16px;background:#123f55;color:white;font-weight:bold';document.body.prepend(link);}
  const html='<!doctype html>'+document.documentElement.outerHTML;
  const record={id,adminId:ctx.tenant,servicoId:osId,clienteId:ctx.customer.id,localId:ctx.os.localId||null,tipo:type,numeroDocumento:number,data:state.values['native-data']||getDataHoje(),local:state.values['native-morada']||'',rascunho:draft,campos:{htmlSnapshot:html,estadoNativo:state,modeloNativo:2,equipamentoId:equipmentId||null,...(official?{modeloPdfDgeg:official.model,fonteDgeg:official.source}:{}),...(existing&&!existing.campos?.modeloNativo?{rascunhoAnterior:existing.campos}:{})},assinaturaTecnico:state.techSignature||null,assinaturaTecnicoNome:state.values.sign_tecnico_nome||'',assinaturaCliente:(draft||state.values['native-client-status']==='Assinado')?state.clientSignature||null:null,assinaturaClienteNome:state.values.sign_cliente_nome||'',tecnicoId:user.id,criadoEm:existing?.criadoEm||Date.now()};
  let query=supa.from('relatorios_especialidade');query=existing?query.update(M.relatoriosEspecialidade.to(record)).eq('id',id).eq('admin_id',ctx.tenant).eq('rascunho',true):query.insert(M.relatoriosEspecialidade.to(record));
  const result=await query.select('id').single();if(result.error||result.data?.id!==id)throw Error(result.error?.message||'O servidor não confirmou a gravação.');
  if(actor()?.id!==user.id||!guard(osId,type))return false;
  dados.relatoriosEspecialidade=(dados.relatoriosEspecialidade||[]).filter(r=>r.id!==id);dados.relatoriosEspecialidade.push(record);
  if(typeof _snap!=='undefined')_snap.relatoriosEspecialidade?.set(id,JSON.stringify(M.relatoriosEspecialidade.to(record)));
  if(typeof _guardarCacheLocal==='function')_guardarCacheLocal();
  if(!draft&&!configFor(type).scie)window.TGContractMaintenance?.registerMaintenance(ctx.os,(dados.folhasObra||[]).find(f=>f.servicoId===osId&&f.adminId===ctx.tenant));
  return true;
 }
 function open(osId,type,onSaved,equipmentId,modelKey){return _abrirModalRelatorioEspecialidade(osId,canonical(type),onSaved||(()=>{if(typeof renderizarTudo==='function')renderizarTudo();}),equipmentId,modelKey);}
 function choose(type){
  const config=configFor(type),os=(dados.servicos||[]).filter(s=>guard(s.id,type)&&config.matches(s));
  const dialog=document.createElement('dialog');dialog.style='border:0;border-radius:12px;max-width:540px;width:92vw;padding:20px';dialog.innerHTML='<h2>'+esc(config.title)+'</h2><label>Selecionar OS<select style="width:100%;font-size:16px;padding:12px">'+os.map(s=>'<option value="'+esc(s.id)+'">'+esc((s.numeroRegisto||s.id)+' · '+(guard(s.id,type).customer.nome||''))+'</option>').join('')+'</select></label>'+(!os.length?'<p>Cria ou atribui uma OS com um trabalho desta especialidade.</p>':'')+'<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"><button type="button" data-close>Cancelar</button><button type="button" data-open '+(!os.length?'disabled':'')+'>Abrir relatório</button></div>';
  document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.remove();dialog.querySelector('[data-open]').onclick=()=>{const id=dialog.querySelector('select').value;dialog.remove();open(id,type);};dialog.addEventListener('cancel',()=>dialog.remove());dialog.showModal();
 }
 function refresh(){
  const host=document.getElementById('tgReportMenu');if(!host)return;host.querySelectorAll('[data-specialty-launcher]').forEach(el=>el.remove());
  if(!actor()||!['admin','subadmin','encarregado','funcionario'].includes(actor().role)||!_licencaValidaTenant())return;
  for(const c of window.TGSpecialtyCatalog.available()){
   const b=document.createElement('button');b.type='button';b.className='tgr-option';b.dataset.specialtyLauncher=c.type;b.innerHTML='<i class="fas '+esc(c.icon)+'" aria-hidden="true"></i><span><strong>'+esc(c.title)+'</strong><small>'+(c.scie?'Modelo ANEPC · assinatura do técnico responsável':'Modelos completos · checklists · medições · assinaturas')+'</small></span><span aria-hidden="true">›</span>';b.onclick=()=>choose(c.type);(host.querySelector('.tgr-menu')||host).append(b);
  }
 }
 const models={};for(const type of window.TGSpecialtyCatalog.list.map(c=>c.type)){models[type]={};for(const key of Object.keys(MODEL_DATA[type]||{[type]:null}))models[type][key]=build(type,[key]);if(typeof REPORT_TEMPLATES!=='undefined')REPORT_TEMPLATES[type]=build(type);}
 window.TGNativeReportModels={models,build,selection,templateFor:(os,type,modelKey)=>{const keys=selection(os,type,modelKey);return (separate(type)||configFor(type)?.scie)&&keys.length!==1?null:build(type,keys);},draftFor,chooseWork,blueprint,guard,scope,validate,persist,open,refresh};
 window.TGSpecialtyReports={open};window.TGAVACReport={openForOS:(id,cb)=>open(id,'RAVAC',cb),isAVAC:()=>window.TGSpecialtyCatalog.available().some(c=>c.type==='RAVAC')};
 if(typeof window.prepararRelatoriosGestao==='function'){const original=window.prepararRelatoriosGestao;window.prepararRelatoriosGestao=function(...args){const value=original.apply(this,args);refresh();return value;};}
 document.addEventListener('tg:interface-updated',refresh);

