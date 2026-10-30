 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const canonical=type=>type==='AVAC'?'RAVAC':type;
 const configFor=type=>window.TGSpecialtyCatalog.list.find(c=>c.type===canonical(type));
 const actor=()=>typeof usuarioLogado==='undefined'?null:usuarioLogado;
 const safeImage=v=>typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v)&&v.length<1500000;
 function selection(os,type){const c=configFor(type),keys=Object.keys(MODEL_DATA[canonical(type)]||{});const selected=keys.filter(code=>(os?.tiposTrabalho||[]).some(t=>[norm(code),norm(c.work.find(w=>w[0]===code)?.[1])].includes(norm(t))));return selected.length?selected:keys.slice(0,1);}
 function blueprint(type,keys){
  type=canonical(type);const models=MODEL_DATA[type];let number=0;const checkIds=[],requiredFields=[],sections=[];
  for(const key of keys){if(!models?.[key])continue;const modelIndex=Object.keys(models).indexOf(key);
   models[key].forEach((section,sectionIndex)=>{
    const id=type+'_'+modelIndex+'_'+sectionIndex;number++;
    const fields=section.fields.map((label,i)=>{const fid='field_'+id+'_'+i;const required=(section.required||[]).includes(label);if(required)requiredFields.push({id:fid,label});const tag=label.length>65||/trabalhos|anomalias|reparaç|diagnóstico|tarefas|resíduos|limitações|observações|condições|materiais|ensaios|circuitos intervencionados/i.test(label)?'textarea':'input';return '<label class="config-field">'+esc(label)+(tag==='textarea'?'<textarea id="'+fid+'" data-native-label="'+esc(label)+'" '+(required?'data-native-required':'')+' rows="2"></textarea>':'<input type="text" id="'+fid+'" data-native-label="'+esc(label)+'" '+(required?'data-native-required':'')+'>')+'</label>';}).join('');
    const checks=section.checks.map((text,i)=>{const name='check_'+id+'_'+i;checkIds.push(name);return '<tr><td class="code">'+number+'.'+(i+1)+'</td><td class="desc">'+esc(text)+'<input class="obs-input" id="obs_'+name+'" type="text" aria-label="Observação da verificação '+number+'.'+(i+1)+'" placeholder="Observação / valor / limitação"></td><td class="result"><div class="seg" role="radiogroup" aria-label="'+esc(text)+'">'+[['OK','OK','ok'],['NOK','NÃO OK','nok'],['N/A','N/A','na']].map(([value,label,cls],j)=>'<input type="radio" name="'+name+'" id="'+name+'_'+j+'" value="'+value+'"><label class="'+cls+'" for="'+name+'_'+j+'">'+label+'</label>').join('')+'</div></td></tr>';}).join('');
    sections.push('<section class="section"><div class="section-head"><span class="num">'+number+'</span><h2>'+esc(section.title)+'</h2></div><div class="config-row">'+fields+'</div><table class="checklist" aria-label="'+esc(section.title)+'">'+checks+'</table></section>');
   });
  }
  return {html:sections.join(''),checkIds,requiredFields,count:number};
 }
 function build(type,keys){
  type=canonical(type);const c=configFor(type);keys=keys||Object.keys(MODEL_DATA[type]).slice(0,1);const spec=blueprint(type,keys);
  const labels=[['contrato','Ref.ª contrato'],['numero','Relatório n.º'],['data','Data'],['nCliente','N.º cliente'],['cliente','Cliente',true],['morada','Morada da instalação',true],['porta','Número de porta'],['localidade','Localidade'],['codigoPostal','Código postal'],['os','Ordem de serviço'],['instalacao','Instalação / local',true],['tecnico','Técnico responsável',true]];
  const meta=labels.map(([id,label,wide])=>'<label class="cell'+(wide?' wide':'')+'">'+esc(label)+'<input id="native-'+id+'" type="'+(id==='data'?'date':'text')+'"></label>').join('');
  const subtitle=keys.map(k=>c.work.find(([code])=>code===k)?.[1]||k).join(' · ');
  const replacements={TITLE:c.title+' — '+subtitle,TYPE:type,TRADE:c.area==='avac'?'AVAC':c.area==='limpeza'?'Limpeza e Desinfeção':'Eletricidade',SUBTITLE:subtitle,META:meta,SECTIONS:spec.html,FINAL_NUMBER:spec.count+1,RESULTS:'<option value="">Escolher…</option>'+(c.results||['Operacional','Operacional com recomendações','Não operacional','Desativado']).map(x=>'<option>'+esc(x)+'</option>').join(''),NOTE:esc(c.note),CONFIG_JSON:JSON.stringify({type,keys,checkIds:spec.checkIds,requiredFields:spec.requiredFields}).replace(/</g,'\\u003c')};
  return SHELL.replace(/__(TITLE|TYPE|TRADE|SUBTITLE|META|SECTIONS|FINAL_NUMBER|RESULTS|NOTE|CONFIG_JSON)__/g,(_,key)=>replacements[key]);
 }
 function scope(data,user,osId,type,licensed=true){
  const config=configFor(type);if(!config||!user||!licensed||!['admin','subadmin','encarregado','funcionario'].includes(user.role))return null;
  const tenant=user.role==='admin'?user.id:user.adminId;
  const admin=(data.administradores||[]).find(a=>a.id===tenant&&a.ativo!==false);
  if(!Array.isArray(admin?.areasNegocio)||!admin.areasNegocio.includes(config.area))return null;
  const os=(data.servicos||[]).find(o=>o.id===osId&&o.adminId===tenant);if(!os)return null;
  const manager=['admin','subadmin'].includes(user.role),ids=Array.isArray(os.funcionariosIds)&&os.funcionariosIds.length?os.funcionariosIds:[os.funcionarioId].filter(Boolean);
  const person=(user.role==='encarregado'?data.encarregados:data.funcionarios)?.find(p=>p.id===user.id&&p.adminId===tenant);
  if((user.permissoesNegadas||person?.permissoesNegadas||[]).some(x=>['servicos','relatorio-os'].includes(x)))return null;
  if(!manager&&(!person||person.suspenso))return null;
  const team=user.role==='encarregado'?person.funcionariosIds||[]:[];
  if(!manager&&!ids.includes(user.id)&&!ids.includes('todos')&&!ids.includes('Todos')&&!team.some(id=>ids.includes(id)))return null;
  if(!manager&&os.relatorioResponsavelId&&os.relatorioResponsavelId!==user.id&&!team.includes(os.relatorioResponsavelId))return null;
  const customer=(data.clientes||[]).find(c=>c.id===os.clienteId&&c.adminId===tenant),local=os.localId?(data.locais||[]).find(l=>l.id===os.localId&&l.adminId===tenant&&l.clienteId===os.clienteId):null;
  if(!customer||(os.localId&&!local))return null;
  return {tenant,admin,os,customer,local,canSign:manager||user.role==='encarregado'||person?.podeAssinarRelatorios!==false};
 }
 const guard=(osId,type)=>scope(dados,actor(),osId,type,typeof _licencaValidaTenant==='function'&&_licencaValidaTenant());
 function validate(type,state,final){
  const errors=[];type=canonical(type);if(!state||state.type!==type||state.version!==2||!Array.isArray(state.modelKeys)||!state.modelKeys.length||state.modelKeys.some(k=>!MODEL_DATA[type]?.[k]))return ['O relatório não corresponde a um modelo de especialidade válido.'];
  if(!final)return errors;
  const v=state.values||{},spec=blueprint(type,state.modelKeys);
  if(spec.requiredFields.some(f=>!String(v[f.id]||'').trim()))errors.push('Preenche os campos de identificação e registo técnico obrigatórios.');
  if(spec.checkIds.some(id=>!['OK','NOK','N/A'].includes(state.answers?.[id])))errors.push('Existem verificações por preencher.');
  if(!v['native-work']?.trim()||!v['native-result'])errors.push('Regista os trabalhos e o resultado.');
  if(!v.sign_tecnico_nome?.trim()||!safeImage(state.techSignature))errors.push('Falta o nome ou a assinatura do técnico.');
  if(!['Assinado','Cliente ausente','Cliente não assinou'].includes(v['native-client-status']))errors.push('Regista a receção pelo cliente.');
  if(v['native-client-status']==='Assinado'&&(!v.sign_cliente_nome?.trim()||!safeImage(state.clientSignature)))errors.push('Falta o nome ou a assinatura do cliente.');
  if(Object.values(state.answers||{}).includes('NOK')&&!v['native-observations']?.trim())errors.push('Descreve as anomalias nas observações.');
  return errors;
 }
 async function persist(osId,type,equipmentId,msg){
  type=canonical(type);const ctx=guard(osId,type),user=actor();if(!ctx)throw Error('O acesso à OS ou à especialidade mudou. Reabre o relatório.');
  const draft=msg.type==='relatorioEspecialidadeRascunho',state=msg.estadoNativo,errors=validate(type,state,!draft);
  if(!draft&&!ctx.canSign)errors.push('Não tens autorização para assinar este relatório.');
  if(JSON.stringify(state?.modelKeys)!==JSON.stringify(selection(ctx.os,type)))errors.push('Os trabalhos da OS mudaram. Reabre o relatório para carregar o modelo atual.');
  if(errors.length)throw Error(errors.join(' '));
  if(!msg.html?.includes('data-native-model="'+type+'"'))throw Error('O documento não corresponde ao modelo da especialidade.');
  if(equipmentId&&!window.TGEquipmentReports?.requirements(ctx.os).some(r=>r.tipo===type&&r.equipamentoId===equipmentId))throw Error('O equipamento já não está associado a este relatório.');
  const existing=(dados.relatoriosEspecialidade||[]).find(r=>r.adminId===ctx.tenant&&r.servicoId===osId&&r.tipo===type&&(r.campos?.equipamentoId||null)===(equipmentId||null)&&r.rascunho);
  const id=existing?.id||gerarId();let number=existing?.numeroDocumento||'RASCUNHO-'+type+'-'+id;
  if(!draft){const n=await proximoNumeroRelatorio(ctx.customer.id,type,1);if(n==null)throw Error('Não foi possível reservar o número do relatório.');number=type+'-'+(ctx.customer.numeroCliente||ctx.customer.id.slice(0,6))+'-'+String(n).padStart(3,'0');}
  const current=guard(osId,type);if(!current||actor().id!==user.id||(!draft&&!current.canSign))throw Error('A sessão ou as permissões mudaram. Reabre o relatório.');
  const document=new DOMParser().parseFromString(msg.html,'text/html'),no=document.getElementById('native-numero');if(no){if(no.tagName==='INPUT')no.setAttribute('value',number);else no.textContent=number;}
  const html='<!doctype html>'+document.documentElement.outerHTML;
  const record={id,adminId:ctx.tenant,servicoId:osId,clienteId:ctx.customer.id,localId:ctx.os.localId||null,tipo:type,numeroDocumento:number,data:state.values['native-data']||getDataHoje(),local:state.values['native-morada']||'',rascunho:draft,campos:{htmlSnapshot:html,estadoNativo:state,modeloNativo:2,equipamentoId:equipmentId||null,...(existing&&!existing.campos?.modeloNativo?{rascunhoAnterior:existing.campos}:{})},assinaturaTecnico:draft?null:state.techSignature,assinaturaTecnicoNome:state.values.sign_tecnico_nome||'',assinaturaCliente:!draft&&state.values['native-client-status']==='Assinado'?state.clientSignature:null,assinaturaClienteNome:state.values.sign_cliente_nome||'',tecnicoId:user.id,criadoEm:existing?.criadoEm||Date.now()};
  let query=supa.from('relatorios_especialidade');query=existing?query.update(M.relatoriosEspecialidade.to(record)).eq('id',id).eq('admin_id',ctx.tenant).eq('rascunho',true):query.insert(M.relatoriosEspecialidade.to(record));
  const result=await query.select('id').single();if(result.error||result.data?.id!==id)throw Error(result.error?.message||'O servidor não confirmou a gravação.');
  if(actor()?.id!==user.id||!guard(osId,type))return false;
  dados.relatoriosEspecialidade=(dados.relatoriosEspecialidade||[]).filter(r=>r.id!==id);dados.relatoriosEspecialidade.push(record);
  if(typeof _snap!=='undefined')_snap.relatoriosEspecialidade?.set(id,JSON.stringify(M.relatoriosEspecialidade.to(record)));
  if(typeof _guardarCacheLocal==='function')_guardarCacheLocal();
  if(!draft)window.TGContractMaintenance?.registerMaintenance(ctx.os,(dados.folhasObra||[]).find(f=>f.servicoId===osId&&f.adminId===ctx.tenant));
  return true;
 }
 function open(osId,type,onSaved,equipmentId){return _abrirModalRelatorioEspecialidade(osId,canonical(type),onSaved||(()=>{if(typeof renderizarTudo==='function')renderizarTudo();}),equipmentId);}
 function choose(type){
  const config=configFor(type),os=(dados.servicos||[]).filter(s=>guard(s.id,type)&&config.matches(s));
  const dialog=document.createElement('dialog');dialog.style='border:0;border-radius:12px;max-width:540px;width:92vw;padding:20px';dialog.innerHTML='<h2>'+esc(config.title)+'</h2><label>Selecionar OS<select style="width:100%;font-size:16px;padding:12px">'+os.map(s=>'<option value="'+esc(s.id)+'">'+esc((s.numeroRegisto||s.id)+' · '+(guard(s.id,type).customer.nome||''))+'</option>').join('')+'</select></label>'+(!os.length?'<p>Cria ou atribui uma OS com um trabalho desta especialidade.</p>':'')+'<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"><button type="button" data-close>Cancelar</button><button type="button" data-open '+(!os.length?'disabled':'')+'>Abrir relatório</button></div>';
  document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.remove();dialog.querySelector('[data-open]').onclick=()=>{const id=dialog.querySelector('select').value;dialog.remove();open(id,type);};dialog.addEventListener('cancel',()=>dialog.remove());dialog.showModal();
 }
 function refresh(){
  const host=document.getElementById('tgReportMenu');if(!host)return;host.querySelectorAll('[data-specialty-launcher]').forEach(el=>el.remove());
  if(!actor()||!['admin','subadmin','encarregado','funcionario'].includes(actor().role)||!_licencaValidaTenant())return;
  for(const c of window.TGSpecialtyCatalog.available()){
   const b=document.createElement('button');b.type='button';b.className='tgr-option';b.dataset.specialtyLauncher=c.type;b.innerHTML='<i class="fas '+esc(c.icon)+'" aria-hidden="true"></i><span><strong>'+esc(c.title)+'</strong><small>Modelos completos · checklists · medições · assinaturas</small></span><span aria-hidden="true">›</span>';b.onclick=()=>choose(c.type);(host.querySelector('.tgr-menu')||host).append(b);
  }
 }
 const models={};for(const type of Object.keys(MODEL_DATA)){models[type]={};for(const key of Object.keys(MODEL_DATA[type]))models[type][key]=build(type,[key]);if(typeof REPORT_TEMPLATES!=='undefined')REPORT_TEMPLATES[type]=build(type);}
 window.TGNativeReportModels={models,build,selection,templateFor:(os,type)=>build(type,selection(os,type)),blueprint,guard,scope,validate,persist,open,refresh};
 window.TGSpecialtyReports={open};window.TGAVACReport={openForOS:(id,cb)=>open(id,'RAVAC',cb),isAVAC:()=>window.TGSpecialtyCatalog.available().some(c=>c.type==='RAVAC')};
 if(typeof window.prepararRelatoriosGestao==='function'){const original=window.prepararRelatoriosGestao;window.prepararRelatoriosGestao=function(...args){const value=original.apply(this,args);refresh();return value;};}
 document.addEventListener('tg:interface-updated',refresh);
