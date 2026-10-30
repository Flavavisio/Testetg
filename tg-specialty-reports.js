/* AVAC intervention reports. Uses existing tenant records, report storage and numbering. */
(function () {
 'use strict';
 const modules={};
 function create(config){
 const TYPE=config.type, TITLE=config.title;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const checkNames=config.checks||['Filtros','Baterias / permutadores','Ventiladores','Drenagem de condensados','Ligações e proteções elétricas','Isolamento e tubagem','Comandos e termóstatos','Estado geral e funcionamento'];
 const states=['Não verificado','Conforme','Não conforme','Não aplicável'];
 const operations=config.operations;
 const results=config.results||['Operacional','Operacional com recomendações','Não operacional','Desativado'];
 const dates=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 const numeric=v=>v!==''&&v!=null&&Number.isFinite(Number(v))&&Number(v)>=0;
 const safeImage=v=>typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v)&&v.length<1500000;
 function enabled(admin) {
  if(!admin&&typeof adminDoUtilizador==='function')admin=adminDoUtilizador();
  return Array.isArray(admin?.areasNegocio)&&admin.areasNegocio.includes(config.area);
 }
 function scope(data,user,osId,licensed=true){
  if(!user||!licensed||!['admin','subadmin','encarregado','funcionario'].includes(user.role))return null;
  const tenant=user.role==='admin'?user.id:user.adminId;
  const admin=(data.administradores||[]).find(a=>a.id===tenant&&a.ativo!==false);
  if(!enabled(admin))return null;
  const os=(data.servicos||[]).find(o=>o.id===osId&&o.adminId===tenant);
  if(!os)return null;
  const ids=Array.isArray(os.funcionariosIds)&&os.funcionariosIds.length?os.funcionariosIds:[os.funcionarioId].filter(Boolean);
  const manager=['admin','subadmin'].includes(user.role);
  const person=user.role==='encarregado'?(data.encarregados||[]).find(p=>p.id===user.id&&p.adminId===tenant):(data.funcionarios||[]).find(p=>p.id===user.id&&p.adminId===tenant);
  const denied=user.permissoesNegadas||person?.permissoesNegadas||[];
  if(denied.includes('servicos')||denied.includes('relatorio-os'))return null;
  if(!manager&&(!person||person.suspenso))return null;
  const team=user.role==='encarregado'?person.funcionariosIds||[]:[];
  if(!manager&&!ids.includes(user.id)&&!ids.includes('todos')&&!ids.includes('Todos')&&!team.some(id=>ids.includes(id)))return null;
  if(!manager&&os.relatorioResponsavelId&&os.relatorioResponsavelId!==user.id&&!team.includes(os.relatorioResponsavelId))return null;
  const customer=(data.clientes||[]).find(c=>c.id===os.clienteId&&c.adminId===tenant);
  const local=os.localId?(data.locais||[]).find(l=>l.id===os.localId&&l.adminId===tenant&&l.clienteId===os.clienteId):null;
  if(!customer||(os.localId&&!local))return null;
  return {tenant,admin,os,customer,local,canSign:manager||user.role==='encarregado'||person?.podeAssinarRelatorios!==false};
 }
 function equipment(s,data){return (data.equipamentos||[]).filter(e=>e.adminId===s.tenant&&(e.clienteId===s.customer.id||(!e.clienteId&&s.local&&e.localId===s.local.id))&&(e.localId||'')===(s.os.localId||''));}
 function validate(v,final=false){
  const errors=[];
  if(v.date&&!dates(v.date))errors.push('Indica uma data de intervenção válida.');
  if(v.nextDate&&!dates(v.nextDate))errors.push('A data da próxima manutenção não é válida.');
  if(v.nextDate&&v.date&&v.nextDate<v.date)errors.push('A próxima manutenção não pode ser anterior à intervenção.');
  for(const key of ['power','tReturn','tSupply','pressureLow','pressureHigh','current','voltage','charge','gwp','added','recovered','vacuum'])if(v[key]!==''&&v[key]!=null&&(!Number.isFinite(Number(v[key]))||(!['tReturn','tSupply'].includes(key)&&Number(v[key])<0)))errors.push('Revê o valor de '+labels[key]+'.');
  for(const k of config.numeric||[])if(v[k]!==''&&v[k]!=null&&(!Number.isFinite(Number(v[k]))||Number(v[k])<0))errors.push('Revê '+labels[k]+'.');
  if(!final)return errors;
  if(!dates(v.date)||!operations.includes(v.operation))errors.push('Preenche a data e o tipo de intervenção.');
  if(config.area==='avac'&&(!v.equipmentType?.trim()||!v.brand?.trim()||!v.model?.trim()||!v.serial?.trim()))errors.push('Identifica o tipo, marca, modelo e número de série do equipamento.');
  if(!v.work?.trim()||!results.includes(v.result))errors.push('Descreve os trabalhos e indica o resultado.');
  if(!v.techName?.trim()||!safeImage(v.techSignature))errors.push('É necessário o nome e a assinatura do técnico.');
  if(v.clientStatus==='Assinado'&&(!v.clientName?.trim()||!safeImage(v.clientSignature)))errors.push('Indica o nome e recolhe a assinatura do cliente.');
  if(!['Assinado','Cliente ausente','Cliente não assinou'].includes(v.clientStatus))errors.push('Indica a receção do trabalho pelo cliente.');
  if(config.area!=='avac'){for(const k of config.required||[])if(!String(v[k]||'').trim())errors.push('Preenche '+(labels[k]||k)+'.');}
  if(v.plan&&(!v.planTasks?.trim()||!v.planRef?.trim()))errors.push('Identifica o plano de manutenção e as tarefas executadas.');
  if(config.area==='limpeza'&&v.operation==='Desinfeção'){for(const k of ['products','dilution','contact','biocide'])if(!String(v[k]||'').trim())errors.push('Na desinfeção, preenche '+labels[k]+'.');}
  if(config.area==='avac'&&v.operation==='Recarga de gás refrigerante'&&!v.fgas)errors.push('Ativa e preenche a ficha de gases fluorados para a recarga.');
  if(v.fgas){
   if(!v.refrigerant?.trim()||!numeric(v.charge)||!numeric(v.added)||!numeric(v.recovered))errors.push('Nos gases fluorados, indica refrigerante, carga e quantidades adicionadas e recuperadas (incluindo zero, quando for o caso).');
   if(!v.companyCert?.trim()||!v.techCert?.trim())errors.push('Identifica os certificados da empresa e do técnico para a intervenção com gases fluorados.');
   if(Number(v.added)>0&&!['Virgem','Reciclado','Valorizado'].includes(v.gasOrigin))errors.push('Indica a origem do gás adicionado.');
   if(v.gwp!==''&&v.gwp!=null&&!v.gwpSource?.trim())errors.push('Indica a fonte do GWP utilizado no cálculo.');
   if(!['Realizado','Não realizado','Não aplicável'].includes(v.leakCheck))errors.push('Indica se foi efetuada a deteção de fugas.');
   if(v.leakCheck==='Realizado'&&(!v.leakMethod?.trim()||!['Sem fuga detetada','Fuga detetada'].includes(v.leakResult)))errors.push('Regista o método e o resultado da deteção de fugas.');
   if(v.leakResult==='Fuga detetada'&&!v.leakAction?.trim())errors.push('Regista as medidas tomadas para a fuga detetada.');
   if(['Reciclado','Valorizado'].includes(v.gasOrigin)&&Number(v.added)>0&&!v.gasFacility?.trim())errors.push('Identifica a instalação de reciclagem/valorização, morada e certificado, quando aplicável.');
   if(!['Sim','Não','Por confirmar'].includes(v.periodicCheck))errors.push('Indica a avaliação do controlo periódico de fugas.');
  }
  return errors;
 }
 const labels={equipmentType:'Tipo de equipamento',brand:'Marca',model:'Modelo',serial:'Número de série',location:'Localização do equipamento',power:'Potência nominal (kW)',tReturn:'Temperatura de retorno (°C)',tSupply:'Temperatura de insuflação (°C)',pressureLow:'Pressão de baixa (bar)',pressureHigh:'Pressão de alta (bar)',current:'Corrente (A)',voltage:'Tensão (V)',vacuum:'Vácuo final (micron)',commissioning:'Ensaios de colocação em serviço',refrigerant:'Refrigerante',charge:'Carga no equipamento (kg)',gwp:'GWP declarado / fonte',added:'Gás adicionado (kg)',recovered:'Gás recuperado (kg)',gasOrigin:'Origem do gás adicionado',gasFacility:'Instalação de reciclagem/valorização, morada e certificado',companyCert:'Certificado da empresa',techCert:'Certificado do técnico',leakCheck:'Deteção de fugas',leakMethod:'Método de deteção',leakResult:'Resultado da deteção',leakAction:'Reparação / medidas adotadas',recheck:'Verificação após reparação: data, resultado ou agendamento',periodicCheck:'Controlo periódico obrigatório',nextLeak:'Próxima verificação de fugas',fgasNotes:'Observações do circuito / destino do gás recuperado',planRef:'Referência do plano de manutenção',planTasks:'Tarefas previstas e executadas',period:'Periodicidade conforme o plano',nextDate:'Próxima manutenção',work:'Trabalhos realizados',materials:'Materiais e peças',anomalies:'Anomalias / limitações',recommendations:'Recomendações',result:'Resultado da intervenção'};
 labels.gwp='GWP declarado';labels.gwpSource='Fonte do GWP / ficha do refrigerante';Object.assign(labels,{cleanZones:'Componentes intervencionados',cleanMethod:'Método e produtos de limpeza',cleanBefore:'Estado anterior',cleanAfter:'Estado final',symptoms:'Sintomas reportados',diagnosis:'Diagnóstico técnico',repairTests:'Ensaios / reparações'},config.labels||{});
 function co2(v){return numeric(v.charge)&&numeric(v.gwp)?Number(v.charge)*Number(v.gwp)/1000:null;}
 function sections(v){
  const rows=keys=>keys.map(k=>[labels[k],v[k]??'']).filter(r=>r[1]!=='');
  if(config.area!=='avac')return config.sections.map(s=>({title:s.title,rows:rows(s.fields)})).concat([{title:'Verificações',rows:checkNames.map((n,i)=>[n,states.includes(v.checks?.[i])?v.checks[i]:'Não verificado'])},{title:'Trabalhos e resultado',rows:rows(['work','materials','anomalies','recommendations','result','nextDate'])}]);
  const out=[{title:'Equipamento',rows:rows(['equipmentType','brand','model','serial','location','power'])},{title:'Verificações',rows:checkNames.map((n,i)=>[n,states.includes(v.checks?.[i])?v.checks[i]:'Não verificado'])},{title:'Medições',rows:rows(['tReturn','tSupply','pressureLow','pressureHigh','current','voltage'])}];
  if(v.operation==='Limpeza de filtros / condutas')out.push({title:'Limpeza',rows:rows(['cleanZones','cleanMethod','cleanBefore','cleanAfter'])});
  if(v.operation==='Diagnóstico de avaria')out.push({title:'Diagnóstico',rows:rows(['symptoms','diagnosis','repairTests'])});
  if(v.operation==='Instalação / colocação em serviço')out.push({title:'Colocação em serviço',rows:rows(['vacuum','commissioning'])});
  if(v.fgas){const r=rows(['refrigerant','charge','gwp','gwpSource','added','recovered','gasOrigin','gasFacility','companyCert','techCert','leakCheck','leakMethod','leakResult','leakAction','recheck','periodicCheck','nextLeak','fgasNotes']);const t=co2(v);if(t!==null)r.push(['Carga em t CO₂ eq (kg × GWP ÷ 1000)',t.toLocaleString('pt-PT',{maximumFractionDigits:4})]);out.push({title:'Ficha de intervenção — gases fluorados',rows:r});}
  if(v.plan)out.push({title:'Execução do plano de manutenção',rows:rows(['planRef','planTasks','period','nextDate'])});
  out.push({title:'Intervenção e resultado',rows:rows(['work','materials','anomalies','recommendations','result',...(!v.plan?['nextDate']:[])])});return out;
 }
 function html(record,branding){
  const v=record.campos[config.area];
  const rows=sections(v).map(s=>`<section><h2>${esc(s.title)}</h2><table>${s.rows.length?s.rows.map(r=>`<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join(''):'<tr><td>Sem medições registadas.</td></tr>'}</table></section>`).join('');
  const logoSource=safeImage(branding.logo)||/^https:\/\//.test(branding.logo||'')?branding.logo:'';
  const logo=logoSource?`<img class="logo" src="${esc(logoSource)}" referrerpolicy="no-referrer" alt="Logótipo">`:'';
  const refs=v.fgas?'Regulamento (UE) 2024/573, artigos 5.º e 7.º; Decreto-Lei n.º 145/2017, na redação aplicável. Conservar a ficha e os registos durante pelo menos cinco anos, quando legalmente exigido.':'';
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(record.numeroDocumento)} — ${esc(TITLE)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#17243d;margin:0;line-height:1.45}header{border-bottom:3px solid #157b86;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;gap:16px}.logo{max-width:150px;max-height:60px;object-fit:contain}h1{font-size:20px;margin:7px 0}h2{font-size:14px;color:#12616b;border-bottom:1px solid #cbdde1;margin:18px 0 7px}.fiscal{color:#475569;margin-top:3px}.meta{font-size:11px;text-align:right}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:1px solid #e2e8f0;padding:7px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{width:38%;background:#f2f7f8;font-weight:600}tr,.signature,figure{break-inside:avoid}section h2{break-after:avoid}.signatures{display:flex;gap:20px;margin-top:20px}.signature{width:50%;border:1px solid #cbd5e1;border-radius:8px;padding:10px}.signature img{display:block;width:100%;height:65px;object-fit:contain}figure{margin:12px 0}figure img{max-width:100%;max-height:260px;object-fit:contain}.note{font-size:10px;color:#475569;margin-top:18px}.draft{color:#a16207}.toolbar{padding:12px;background:#edf7f8;margin-bottom:15px}.toolbar button{padding:10px 18px}@media screen{body{max-width:850px;margin:auto;padding:20px;background:white}}@media print{.toolbar{display:none}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div><header><div>${logo}<strong>${esc(branding.empresa||branding.nomeEmpresa||branding.nome||'')}</strong><div class="fiscal">${esc(branding.nomeFiscal||'')}</div><div>NIF: ${esc(branding.nif||'Não registado')}</div><h1>Relatório de ${TITLE}</h1></div><div class="meta"><strong>${esc(record.numeroDocumento)}</strong><br>${esc(v.date)}<br>${record.rascunho?'<b class="draft">RASCUNHO — não concluído</b>':'Intervenção concluída'}</div></header><table>${[['Cliente',v.customerName],['NIF do cliente',v.customerNif],['Instalação / morada',v.site],['Ordem de serviço',v.osNumber],['Tipo de intervenção',v.operation]].map(r=>`<tr><th>${esc(r[0])}</th><td>${esc(r[1]||'Não registado')}</td></tr>`).join('')}</table>${rows}${(v.photos||[]).filter(p=>safeImage(p.src)).map((p,i)=>`<figure><img src="${p.src}" alt="Fotografia ${i+1}"><figcaption>${esc(p.caption||'Fotografia '+(i+1))}</figcaption></figure>`).join('')}<div class="signatures"><div class="signature"><strong>Técnico</strong>${safeImage(v.techSignature)?`<img src="${v.techSignature}" alt="Assinatura do técnico">`:''}${esc(v.techName||'Por assinar')}</div><div class="signature"><strong>Receção pelo cliente</strong>${v.clientStatus==='Assinado'&&safeImage(v.clientSignature)?`<img src="${v.clientSignature}" alt="Assinatura do cliente">`:''}${esc(v.clientName||'')}<br>${esc(v.clientStatus||'Por confirmar')}</div></div><p class="note">${esc(refs)} ${v.plan?'Registo de execução de tarefas do plano: Decreto-Lei n.º 101-D/2020 e Despacho n.º 6476-C/2021, quando aplicáveis. ':''}${esc(config.note)} Campos sem valor não foram medidos ou registados. Receção pelo cliente não constitui certificação técnica.</p></body></html>`;
 }
 let current=null,picker=null;
 const actor=()=>typeof usuarioLogado==='undefined'?null:usuarioLogado;
 const live=id=>scope(dados,actor(),id,typeof _licencaValidaTenant==='function'&&_licencaValidaTenant());
 const same=s=>current===s&&JSON.stringify([actor()?.id,actor()?.adminId,actor()?.role])===s.identity&&!!live(s.osId);
 const option=(v,l=v)=>`<option value="${esc(v)}">${esc(l)}</option>`;
 const input=(k,label=labels[k],type='text')=>`<label>${esc(label)}<input data-avac="${k}" type="${type}" ${type==='number'?'step="any"':''}></label>`;
 const area=(k,label=labels[k])=>`<label class="avac-wide">${esc(label)}<textarea data-avac="${k}" rows="3"></textarea></label>`;
 const select=(k,label,items)=>`<label>${esc(label)}<select data-avac="${k}">${option('','Escolher…')}${items.map(x=>option(x)).join('')}</select></label>`;
 function collect(s){const v={...s.value,checks:[],photos:s.photos};s.form.querySelectorAll('[data-avac]:not([data-avac-ignore])').forEach(el=>v[el.dataset.avac]=el.type==='checkbox'?el.checked:el.value);s.form.querySelectorAll('[data-avac-check]').forEach(el=>v.checks[Number(el.dataset.avacCheck)]=el.value);for(const k of ['tech','client'])v[k+'Signature']=s.signatures[k]||'';return v;}
 function message(s,text){s.form.querySelector('[data-avac-status]').textContent=text;}
 function syncSections(s){const v=collect(s);s.form.querySelector('[data-specialty-cleaning]').hidden=config.area!=='avac'||v.operation!=='Limpeza de filtros / condutas';s.form.querySelector('[data-specialty-diagnosis]').hidden=config.area!=='avac'||v.operation!=='Diagnóstico de avaria';for(const k of ['fgas','plan'])s.form.querySelector('[data-avac-section="'+k+'"]').hidden=config.area!=='avac'||!v[k];s.form.querySelector('[data-avac-section="commissioning"]').hidden=config.area!=='avac'||v.operation!=='Instalação / colocação em serviço';const n=co2(v);s.form.querySelector('[data-avac-co2]').textContent=n===null?'Carga equivalente: por confirmar (kg × GWP ÷ 1000).':'Carga equivalente: '+n.toLocaleString('pt-PT')+' t CO₂ eq (kg × GWP ÷ 1000).';}
 function close(){if(!current)return;if(current.busy)return;current.overlay.remove();current=null;}
 function sign(s,key){
  const canvas=s.form.querySelector('[data-avac-sign="'+key+'"]'),ctx=canvas.getContext('2d');let active=false;
  const draw=(e,start)=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*canvas.width/r.width,y=(e.clientY-r.top)*canvas.height/r.height;ctx.lineWidth=2.5;ctx.lineCap='round';ctx.strokeStyle='#17243d';if(start){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.2,y+.2);}else ctx.lineTo(x,y);ctx.stroke();};
  canvas.onpointerdown=e=>{if(s.busy)return;e.preventDefault();active=true;canvas.setPointerCapture(e.pointerId);draw(e,true);s.signatures[key]=canvas.toDataURL('image/png');};
  canvas.onpointermove=e=>{if(active){e.preventDefault();draw(e,false);s.signatures[key]=canvas.toDataURL('image/png');}};
  canvas.onpointerup=canvas.onpointercancel=()=>{active=false;};
  if(s.signatures[key]){const im=new Image();im.onload=()=>ctx.drawImage(im,0,0,canvas.width,canvas.height);im.src=s.signatures[key];}
  s.form.querySelector('[data-avac-clear="'+key+'"]').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);s.signatures[key]='';};
 }
 async function photo(s,file){
  if(s.photos.length>=4)throw Error('Podes juntar até quatro fotografias por relatório.');
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>8*1024*1024)throw Error('Escolhe uma imagem JPG, PNG ou WebP até 8 MB.');
  const url=URL.createObjectURL(file);try{const image=new Image();await new Promise((ok,no)=>{image.onload=ok;image.onerror=()=>no(Error('Não foi possível ler a imagem.'));image.src=url;});if(!same(s))return;const c=document.createElement('canvas'),scale=Math.min(1,1000/Math.max(image.width,image.height));c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);const src=c.toDataURL('image/jpeg',.72);if(!safeImage(src))throw Error('A imagem é demasiado grande. Escolhe uma fotografia mais pequena.');s.photos.push({src,caption:file.name});renderPhotos(s);}finally{URL.revokeObjectURL(url);}
 }
 function renderPhotos(s){const host=s.form.querySelector('[data-avac-photos]');host.innerHTML=s.photos.map((p,i)=>`<figure><img src="${safeImage(p.src)?p.src:''}" alt="Fotografia ${i+1}"><input aria-label="Legenda da fotografia ${i+1}" data-photo-caption="${i}" value="${esc(p.caption)}"><button type="button" data-photo-remove="${i}">Retirar fotografia</button></figure>`).join('');host.querySelectorAll('[data-photo-remove]').forEach(b=>b.onclick=()=>{s.photos.splice(Number(b.dataset.photoRemove),1);renderPhotos(s);});host.querySelectorAll('[data-photo-caption]').forEach(el=>el.oninput=()=>s.photos[Number(el.dataset.photoCaption)].caption=el.value);}
 async function save(s,draft){
  if(!same(s)||s.busy)return;const ctx=live(s.osId),v=JSON.parse(JSON.stringify(collect(s))),errors=validate(v,!draft);
  if(!draft&&!ctx.canSign)errors.push('O teu perfil não tem autorização para assinar relatórios.');
  if(v.equipmentId&&!equipment(ctx,dados).some(e=>e.id===v.equipmentId))errors.push('O equipamento já não pertence a esta instalação. Reabre o relatório.');
  if(s.requiredEquipmentId&&v.equipmentId!==s.requiredEquipmentId)errors.push('Mantém o equipamento associado a este relatório da OS.');
  if(errors.length){message(s,errors.join(' '));return;}
  s.busy=true;s.form.querySelectorAll('button').forEach(b=>b.disabled=true);message(s,'A guardar no servidor…');
  try{
   const now=Date.now(),id=s.draftId||gerarId();let number='RASCUNHO-'+TYPE+'-'+id;
   if(!draft){const n=await proximoNumeroRelatorio(ctx.customer.id,TYPE,1);if(!same(s))throw Error('A conta ou o acesso mudou. Reabre o relatório.');if(n==null)throw Error('Não foi possível reservar o número do relatório.');number=TYPE+'-'+(ctx.customer.numeroCliente||ctx.customer.id.slice(0,6))+'-'+String(n).padStart(3,'0');}
   const record={id,adminId:ctx.tenant,servicoId:ctx.os.id,clienteId:ctx.customer.id,localId:ctx.os.localId||null,tipo:TYPE,numeroDocumento:number,data:v.date||getDataHoje(),local:v.site,rascunho:draft,campos:{[config.area]:v,versaoEspecialidade:1,equipamentoId:v.equipmentId||null,equipamentoNome:[v.brand,v.model,v.serial].filter(Boolean).join(' · ')},assinaturaTecnico:draft?null:v.techSignature,assinaturaTecnicoNome:v.techName,assinaturaCliente:draft||v.clientStatus!=='Assinado'?null:v.clientSignature,assinaturaClienteNome:v.clientName,tecnicoId:actor().id,criadoEm:s.createdAt||now};
   record.campos.htmlSnapshot=html(record,ctx.admin);
   if(!same(s))throw Error('A conta ou o acesso mudou. Reabre o relatório.');
   let query=supa.from('relatorios_especialidade');
   query=s.draftId?query.update(M.relatoriosEspecialidade.to(record)).eq('id',id).eq('admin_id',ctx.tenant).eq('rascunho',true):query.insert(M.relatoriosEspecialidade.to(record));
   const {data,error}=await query.select('id').single();
   if(error||data?.id!==id)throw Error(error?.message||'O servidor não confirmou a gravação.');
   if(!same(s))return;
   dados.relatoriosEspecialidade=(dados.relatoriosEspecialidade||[]).filter(r=>r.id!==id);dados.relatoriosEspecialidade.push(record);
   if(typeof _snap!=='undefined')_snap.relatoriosEspecialidade?.set(record.id,JSON.stringify(M.relatoriosEspecialidade.to(record)));
   if(typeof _guardarCacheLocal==='function')_guardarCacheLocal();
   const callback=s.onSaved;s.busy=false;close();renderizarTudo();if(typeof callback==='function')callback();
  }catch(e){if(same(s))message(s,'Não foi possível guardar: '+e.message);}finally{if(current===s){s.busy=false;s.form.querySelectorAll('button').forEach(b=>b.disabled=false);if(!same(s))close();}}
 }
 async function open(osId,onSaved,equipmentId=null){
  const ctx=live(osId);if(!ctx){alert('Este relatório exige a área '+config.area+' ativa, licença válida e acesso a esta OS.');return;}
  if(!config.matches(ctx.os)&&!equipmentId){alert('Seleciona um trabalho desta especialidade na OS.');return;}
  if(!equipmentId)equipmentId=window.TGEquipmentReports?.requirements(ctx.os).find(r=>r.tipo===TYPE&&r.equipamentoId)?.equipamentoId||null;
  if(Object.values(modules).some(m=>m.busy()))return;for(const m of Object.values(modules))m.close();close();
  const eqs=equipment(ctx,dados);if(equipmentId&&!eqs.some(e=>e.id===equipmentId)){alert('O equipamento não pertence a esta instalação.');return;}
  const draft=(dados.relatoriosEspecialidade||[]).find(r=>r.adminId===ctx.tenant&&r.servicoId===osId&&r.tipo===TYPE&&r.rascunho&&(!equipmentId||r.campos?.equipamentoId===equipmentId));
  const address=ctx.local||ctx.customer;
  const initial={date:getDataHoje(),operation:config.operationFor(ctx.os),equipmentId:equipmentId||'',customerName:ctx.customer.nome||'',customerNif:ctx.customer.nif||'',site:[ctx.local?.nome||'Sede',address.morada||address.endereco,address.codigoPostal,address.cidade||address.localidade].filter(Boolean).join(' · '),osNumber:ctx.os.numeroRegisto||ctx.os.id,techName:actor().nome||'',clientStatus:'',fgas:false,plan:false,periodicCheck:'Por confirmar',checks:checkNames.map(()=>'Não verificado'),...draft?.campos?.[config.area]};
  if(config.area==='avac'&&initial.operation==='Recarga de gás refrigerante')initial.fgas=true;
  const ov=document.createElement('div');ov.className='modal-overlay open avac-overlay';ov.innerHTML=`<section class="modal avac-modal" role="dialog" aria-modal="true" aria-labelledby="avac-title"><header><div><h2 id="avac-title">${esc(TITLE)}</h2><p>OS ${esc(initial.osNumber)} · ${esc(initial.customerName)}</p></div><button type="button" data-avac-close aria-label="Fechar relatório">×</button></header><form class="avac-form"><div class="avac-scroll"><p class="avac-note">${esc(config.note)} Preenche apenas o que foi verificado; os dados desconhecidos ficam por confirmar.</p><fieldset><legend>Intervenção</legend><div class="avac-grid">${input('date','Data da intervenção','date')}${select('operation','Tipo de intervenção',operations)}${config.area!=='avac'?'</div></fieldset>'+config.sections.map(sec=>'<fieldset><legend>'+esc(sec.title)+'</legend><div class="avac-grid">'+sec.fields.map(k=>(config.numeric||[]).includes(k)?input(k,labels[k],'number'):area(k)).join('')+'</div></fieldset>') .join('')+'<fieldset hidden><legend>Equipamento AVAC</legend><div class="avac-grid">':''}<label class="avac-wide">Equipamento da instalação<select data-avac="equipmentId">${option('','Identificação manual / sem cadastro')}${eqs.map(e=>option(e.id,[e.fichaTecnica?.nome,e.marca,e.numeroSerie].filter(Boolean).join(' · ')||e.id)).join('')}</select></label>${input('equipmentType')}${input('brand')}${input('model')}${input('serial')}${input('location')}${input('power',labels.power,'number')}</div></fieldset><fieldset><legend>Verificações</legend><div class="avac-grid">${checkNames.map((n,i)=>`<label>${esc(n)}<select data-avac-check="${i}">${states.map(x=>option(x)).join('')}</select></label>`).join('')}</div></fieldset><fieldset><legend>Medições efetuadas</legend><div class="avac-grid">${['tReturn','tSupply','pressureLow','pressureHigh','current','voltage'].map(k=>input(k,labels[k],'number')).join('')}</div></fieldset><fieldset data-avac-section="commissioning" hidden><legend>Colocação em serviço</legend><div class="avac-grid">${input('vacuum',labels.vacuum,'number')}${area('commissioning','Ensaios de estanquidade, vácuo, proteções e arranque: métodos e resultados')}</div></fieldset><fieldset data-specialty-cleaning hidden><legend>Limpeza de filtros / condutas</legend><div class="avac-grid">${['cleanZones','cleanMethod','cleanBefore','cleanAfter'].map(k=>area(k)).join('')}</div></fieldset><fieldset data-specialty-diagnosis hidden><legend>Diagnóstico de avaria</legend><div class="avac-grid">${['symptoms','diagnosis','repairTests'].map(k=>area(k)).join('')}</div></fieldset><label class="avac-switch"><input type="checkbox" data-avac="fgas"> Intervenção / verificação em circuito com gases fluorados</label><fieldset data-avac-section="fgas" hidden><legend>Ficha de gases fluorados</legend><p class="avac-note">O técnico habilitado confirma o enquadramento, as certificações e os prazos aplicáveis. Não são atribuídos prazos automáticos sem essa avaliação.</p><div class="avac-grid">${['refrigerant','companyCert','techCert','gwpSource'].map(k=>input(k)).join('')}${['charge','gwp','added','recovered'].map(k=>input(k,k==='gwp'?'GWP declarado (valor numérico)':labels[k],'number')).join('')}${select('gasOrigin','Origem do gás adicionado',['Virgem','Reciclado','Valorizado','Sem adição'])}${area('gasFacility')}${select('leakCheck','Deteção de fugas',['Realizado','Não realizado','Não aplicável'])}${input('leakMethod')}${select('leakResult','Resultado da deteção',['Sem fuga detetada','Fuga detetada'])}${area('leakAction')}${area('recheck')}${select('periodicCheck',labels.periodicCheck,['Sim','Não','Por confirmar'])}${input('nextLeak','Próxima verificação (data / por confirmar)')}${area('fgasNotes')}</div><p data-avac-co2 class="avac-note"></p></fieldset><label class="avac-switch"><input type="checkbox" data-avac="plan"> Esta intervenção executa tarefas de um plano de manutenção</label><fieldset data-avac-section="plan" hidden><legend>Plano de manutenção</legend><div class="avac-grid">${input('planRef')}${input('period')}${area('planTasks')}</div></fieldset><fieldset><legend>Trabalhos e resultado</legend><div class="avac-grid">${['work','materials','anomalies','recommendations'].map(k=>area(k)).join('')}${select('result',labels.result,results)}${input('nextDate',labels.nextDate,'date')}</div></fieldset><fieldset><legend>Fotografias</legend><label>Até quatro imagens (JPG, PNG ou WebP)<input type="file" accept="image/jpeg,image/png,image/webp" data-avac-photo multiple></label><div data-avac-photos class="avac-photos"></div></fieldset><fieldset><legend>Assinaturas</legend><div class="avac-grid">${input('techName','Nome do técnico')}${input('clientName','Nome do cliente / representante')}${select('clientStatus','Receção pelo cliente',['Assinado','Cliente ausente','Cliente não assinou'])}<div></div>${['tech','client'].map((k,i)=>`<div><label>${i?'Assinatura do cliente':'Assinatura do técnico'}</label><canvas data-avac-sign="${k}" width="600" height="150" aria-label="${i?'Assinatura do cliente':'Assinatura do técnico'}"></canvas><button type="button" data-avac-clear="${k}">Limpar assinatura</button></div>`).join('')}</div></fieldset></div><footer><p data-avac-status role="status" aria-live="polite"></p><div><button type="button" data-avac-preview>Pré-visualizar / PDF</button><button type="button" data-avac-draft>Guardar rascunho</button><button type="submit" class="avac-primary">Concluir e guardar</button></div></footer></form></section>`;document.body.append(ov);
  if(config.area!=='avac'){for(const el of ov.querySelectorAll('.avac-switch'))el.hidden=true;const measures=[...ov.querySelectorAll('fieldset')].find(el=>el.querySelector('[data-avac="tReturn"]'));if(measures){measures.hidden=true;measures.querySelectorAll('[data-avac]').forEach(el=>el.dataset.avacIgnore='');}}
  const s={overlay:ov,form:ov.querySelector('form'),osId,onSaved,draftId:draft?.id,createdAt:draft?.criadoEm,identity:JSON.stringify([actor().id,actor().adminId,actor().role]),value:initial,photos:JSON.parse(JSON.stringify(initial.photos||[])),signatures:{tech:initial.techSignature||'',client:initial.clientSignature||''},busy:false};current=s;
  s.form.querySelectorAll('[data-avac]').forEach(el=>{const value=initial[el.dataset.avac];if(el.type==='checkbox')el.checked=!!value;else el.value=value??'';});s.form.querySelectorAll('[data-avac-check]').forEach(el=>el.value=initial.checks[Number(el.dataset.avacCheck)]||'Não verificado');
  function loadEquipment(id){const eq=eqs.find(e=>e.id===id);if(!eq)return;const fields={brand:eq.marca,serial:eq.numeroSerie,model:eq.fichaTecnica?.modelo,equipmentType:eq.tipo,location:eq.fichaTecnica?.localizacao};Object.entries(fields).forEach(([k,v])=>{if(v)s.form.querySelector('[data-avac="'+k+'"]').value=v;});}
  s.requiredEquipmentId=equipmentId;
  if(equipmentId)s.form.querySelector('[data-avac="equipmentId"]').disabled=true;
  if(!draft&&equipmentId)loadEquipment(equipmentId);
  s.form.onchange=e=>{if(e.target.dataset.avac==='operation'&&e.target.value==='Recarga de gás refrigerante')s.form.querySelector('[data-avac="fgas"]').checked=true;if(e.target.dataset.avac==='equipmentId')loadEquipment(e.target.value);syncSections(s);};s.form.oninput=()=>syncSections(s);
  ov.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();close();}if(e.key==='Tab'){const els=[...ov.querySelectorAll('button,input,select,textarea')].filter(x=>!x.disabled&&!x.closest('[hidden]')&&x.getClientRects().length);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus();}}};ov.querySelector('[data-avac-close]').onclick=close;s.form.onsubmit=e=>{e.preventDefault();save(s,false);};s.form.querySelector('[data-avac-draft]').onclick=()=>save(s,true);
  s.form.querySelector('[data-avac-preview]').onclick=()=>{if(!same(s))return;const v=collect(s),doc={numeroDocumento:'RASCUNHO — PRÉ-VISUALIZAÇÃO',rascunho:true,campos:{[config.area]:v}};const reader=_abrirLeitorRelatorioGuardado();reader.mostrar(html(doc,ctx.admin));};
  s.form.querySelector('[data-avac-photo]').onchange=async e=>{try{for(const file of e.target.files)await photo(s,file);}catch(err){message(s,err.message);}finally{e.target.value='';}};
  ['tech','client'].forEach(k=>sign(s,k));renderPhotos(s);syncSections(s);ov.querySelector('[data-avac-close]').focus();
 }
 function choose(){
  if(picker)picker.overlay.remove();
  const os=(dados.servicos||[]).filter(o=>live(o.id)&&config.matches(o)).sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
  const ov=document.createElement('div');ov.className='modal-overlay open avac-overlay';ov.innerHTML=`<section class="modal avac-picker" role="dialog" aria-modal="true" aria-label="Escolher OS para relatório"><h2>${esc(TITLE)}</h2><label>Ordem de serviço<select>${option('','Escolher OS…')}${os.map(o=>option(o.id,(o.numeroRegisto||o.id)+' · '+(live(o.id).customer.nome||'')+' · '+(o.data||'')+' · '+(o.descricao||'').slice(0,65))).join('')}</select></label>${os.length?'':'<p>Não há OS disponíveis para este acesso. Cria ou atribui uma OS para registar a intervenção.</p>'}<div><button type="button" data-cancel>Cancelar</button><button type="button" data-open>Abrir relatório</button></div></section>`;document.body.append(ov);picker={overlay:ov,identity:JSON.stringify([actor()?.id,actor()?.adminId,actor()?.role])};ov.querySelector('[data-cancel]').onclick=()=>ov.remove();ov.querySelector('[data-open]').onclick=()=>{const id=ov.querySelector('select').value;if(!id||!live(id))return;ov.remove();open(id,()=>{});};
 }
 function refresh(){
  if(picker&&(picker.identity!==JSON.stringify([actor()?.id,actor()?.adminId,actor()?.role])||!enabled()||!_licencaValidaTenant())){picker.overlay.remove();picker=null;}
  if(current&&!same(current)){current.overlay.hidden=true;if(!current.busy)close();}
  const host=document.getElementById('tgReportMenu');if(!host)return;
  host.querySelector('[data-specialty-launcher="'+TYPE+'"]')?.remove();
  if(!enabled()||!actor()||!['admin','subadmin','encarregado','funcionario'].includes(actor().role)||!_licencaValidaTenant())return;
  const button=document.createElement('button');button.type='button';button.className='tgr-option';button.dataset.specialtyLauncher=TYPE;button.innerHTML='<i class="fas '+esc(config.icon)+'" aria-hidden="true"></i><span><strong>'+esc(TITLE)+'</strong><small>Preencher na OS · fotografias · assinaturas · PDF</small></span><span aria-hidden="true">›</span>';button.onclick=choose;(host.querySelector('.tgr-menu')||host).append(button);
 }
 if(typeof window.prepararRelatoriosGestao==='function'){const original=window.prepararRelatoriosGestao;window.prepararRelatoriosGestao=function(...args){const r=original.apply(this,args);refresh();return r;};}
 document.addEventListener('tg:interface-updated',refresh);
 const api={close,busy:()=>!!current?.busy,enabled,scope,equipment,validate,co2,sections,html,open,choose,refresh,TYPE};
 modules[TYPE]=api;
 if(config.area==='avac')window.TGAVAC=api;
 }
 for(const config of window.TGSpecialtyCatalog.list)create(config);
 window.TGSpecialtyReports={modules,open:(osId,type,callback,equipmentId)=>modules[type==='AVAC'?'RAVAC':type]?.open(osId,callback,equipmentId)};
 window.TGAVACReport={openForOS:(id,callback)=>modules.RAVAC.open(id,callback),isAVAC:()=>modules.RAVAC.enabled()};
})();
