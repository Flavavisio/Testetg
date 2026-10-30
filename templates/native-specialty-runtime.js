/* Runs inside the native specialty-report iframe. */
(function(){
 'use strict';
 const config=__CONFIG_JSON__,byId=id=>document.getElementById(id);
 let permitted=false,busy=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeImage=v=>typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v)&&v.length<1500000;
 function status(text){byId('native-status').textContent=text;}
 function set(id,value){const el=byId(id);if(el&&value!=null)el.value=String(value);}
 function prefill(msg){
  const fields={contrato:msg.contratoNumero,numero:msg.numero,data:msg.data,nCliente:msg.nCliente,cliente:msg.cliente,morada:msg.morada,porta:msg.numeroPorta,localidade:msg.localidade,codigoPostal:msg.codigoPostal,os:msg.osNumero,instalacao:msg.instalacaoNome,tecnico:msg.tecnicoNome};
  Object.entries(fields).forEach(([key,value])=>set('native-'+key,value));
  set('sign_tecnico_nome',msg.tecnicoNome);
  byId('native-os-description').textContent=msg.osDescricao||'';byId('native-briefing').hidden=!msg.osDescricao;
  for(const key of ['contrato','numero','nCliente','cliente','os'])byId('native-'+key)?.setAttribute('readonly','readonly');
  if(msg.souAdmin===false)byId('native-data').setAttribute('readonly','readonly');
  byId('native-company').textContent=msg.empresaNome||'';
  byId('native-fiscal').textContent=msg.empresaFiscal||'';
  byId('native-company-nif').textContent=msg.empresaNif?'NIF: '+msg.empresaNif:'';
  if(msg.logoBase64&&(/^(data:image\/(png|jpeg|webp);base64,|https:\/\/)/i.test(msg.logoBase64))){byId('native-logo').src=msg.logoBase64;byId('native-logo').hidden=false;}
  if(/^#[0-9a-f]{6}$/i.test(msg.corCorporativa||''))document.documentElement.style.setProperty('--accent',msg.corCorporativa);
  const eq=msg.equipamento||{};
  const known={'Marca':eq.marca,'Modelo':eq.fichaTecnica?.modelo,'Número de série':eq.numeroSerie,'Tipo de equipamento':eq.tipo,'Localização':eq.fichaTecnica?.localizacao};
  const legacy=msg.legacyValues||{};Object.assign(known,{'Marca':eq.marca||legacy.brand||legacy.marca,'Modelo':eq.fichaTecnica?.modelo||legacy.model||legacy.modelo,'Número de série':eq.numeroSerie||legacy.serial||legacy.serie});
  document.querySelectorAll('[data-native-label]').forEach(el=>{const v=known[el.dataset.nativeLabel];if(v&&!el.value)el.value=v;});
  if(legacy.work||legacy.trabalhos)set('native-work',legacy.work||legacy.trabalhos);
  const restore=msg.nativeRestoreState;
  if(restore?.type===config.type){Object.entries(restore.values||{}).forEach(([id,value])=>set(id,value));Object.entries(restore.answers||{}).forEach(([name,value])=>{const el=[...document.querySelectorAll('input[type=radio]')].find(x=>x.name===name&&x.value===value);if(el)el.checked=true;});
   for(const photo of restore.photos||[]){if(!safeImage(photo.src))continue;const figure=document.createElement('figure');figure.dataset.nativePhoto='';figure.innerHTML='<img src="'+photo.src+'" alt="Fotografia da intervenção"><input type="text" aria-label="Legenda da fotografia" value="'+esc(photo.caption||'')+'"><button class="native-screen" type="button" data-photo-remove>Retirar fotografia</button>';byId('native-photos').append(figure);}
  }
 }
 window._relPrefill=prefill;
 function state(){
  const values={};document.querySelectorAll('input[id],textarea[id],select[id]').forEach(el=>{if(el.type!=='radio'&&el.type!=='file')values[el.id]=el.value;});
  const answers={};document.querySelectorAll('input[type=radio]:checked').forEach(el=>answers[el.name]=el.value);
  return {version:2,type:config.type,modelKeys:config.keys,values,answers,photos:[...document.querySelectorAll('[data-native-photo]')].map(el=>({src:el.querySelector('img').src,caption:el.querySelector('input').value})),techSignature:byId('native-sign-tecnico').value,clientSignature:byId('native-sign-cliente').value};
 }
 function validate(final){
  if(!final)return [];
  const s=state(),errors=[];
  document.querySelectorAll('[data-invalid]').forEach(el=>el.removeAttribute('data-invalid'));
  const missing=(config.requiredFields||[]).filter(f=>!String(s.values[f.id]||'').trim());if(missing.length)errors.push('Preenche: '+missing.slice(0,3).map(f=>f.label).join('; ')+(missing.length>3?' e os restantes campos de registo obrigatórios.':'.'));
  for(const name of config.checkIds)if(!['OK','NOK','N/A'].includes(s.answers[name])){document.querySelector('input[name="'+name+'"]')?.closest('tr').setAttribute('data-invalid','');errors.push('Responde às verificações por preencher (OK, NÃO OK ou N/A).');break;}
  if(!s.values['native-work']?.trim())errors.push('Regista os trabalhos efetivamente realizados.');
  if(!s.values['native-result'])errors.push('Seleciona o resultado da intervenção.');
  if(!permitted)errors.push('O teu perfil não tem autorização para assinar. Podes guardar rascunho.');
  if(!s.values.sign_tecnico_nome?.trim()||!safeImage(s.techSignature))errors.push('Falta o nome ou a assinatura do técnico.');
  const receipt=s.values['native-client-status'];
  if(!receipt)errors.push('Regista a receção pelo cliente, ausência ou recusa de assinatura.');
  if(receipt==='Assinado'&&(!s.values.sign_cliente_nome?.trim()||!safeImage(s.clientSignature)))errors.push('Recolhe o nome e a assinatura do cliente.');
  if(Object.values(s.answers).includes('NOK')&&!s.values['native-observations']?.trim())errors.push('Descreve as anomalias e medidas adotadas nas observações.');
  return errors;
 }
 function serialize(final){
  const s=state();document.querySelectorAll('input,select,textarea').forEach(el=>{
   if(el.type==='file')return;
   if(el.type==='radio'||el.type==='checkbox')el.toggleAttribute('checked',el.checked);
   else if(el.tagName==='SELECT')[...el.options].forEach(o=>o.toggleAttribute('selected',o.selected));
   else if(el.tagName==='TEXTAREA')el.textContent=el.value;
   else el.setAttribute('value',el.value);
  });
  const clone=document.documentElement.cloneNode(true);
  clone.querySelector('#native-status').textContent='';
  if(final){
   clone.querySelectorAll('script,.native-screen,[data-photo-remove]').forEach(el=>el.remove());
   clone.querySelectorAll('.seg').forEach(seg=>{const result=seg.querySelector('input[checked]');seg.textContent=result?.value||'Por verificar';});
   for(const key of ['tecnico','cliente']){
    const c=clone.querySelector('#sign_'+key),src=key==='tecnico'?s.techSignature:s.clientSignature;
    if(safeImage(src)){const img=document.createElement('img');img.src=src;img.alt='Assinatura '+key;img.style='display:block;width:100%;height:75px;object-fit:contain';c.replaceWith(img);}else c.remove();
   }
   clone.querySelectorAll('input,select,textarea').forEach(el=>{if(el.type==='hidden'){el.remove();return;}const span=document.createElement('span');span.id=el.id;span.className='native-print-value';span.style='display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-weight:500';span.textContent=el.value||'—';el.replaceWith(span);});
   clone.querySelectorAll('[hidden]').forEach(el=>el.remove());
   const toolbar=document.createElement('div');toolbar.className='native-screen';toolbar.innerHTML='<button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>';clone.querySelector('body').prepend(toolbar);
  }
  return {html:'<!doctype html>'+clone.outerHTML,estadoNativo:s};
 }
 async function send(final){
  if(busy)return;const errors=validate(final);if(errors.length){status(errors.join(' '));document.querySelector('[data-invalid]')?.scrollIntoView?.({block:'center',behavior:'smooth'});return;}
  busy=true;document.querySelectorAll('.native-footer button').forEach(b=>b.disabled=true);status('A guardar no sistema…');
  const snapshot=serialize(final),s=snapshot.estadoNativo;
  window.parent.postMessage({type:final?'relatorioEspecialidadeConcluido':'relatorioEspecialidadeRascunho',...snapshot,assinaturaTecnico:s.techSignature,assinaturaTecnicoNome:s.values.sign_tecnico_nome,assinaturaCliente:s.clientSignature,assinaturaClienteNome:s.values.sign_cliente_nome},'*');
 }
 function bindSignature(key){
  const canvas=byId('sign_'+key),ctx=canvas.getContext('2d');if(!ctx)return;let down=false;
  const hidden=byId('native-sign-'+key),pos=e=>{const r=canvas.getBoundingClientRect();return[(e.clientX-r.left)*canvas.width/(r.width||600),(e.clientY-r.top)*canvas.height/(r.height||150)];};
  canvas.onpointerdown=e=>{if(busy)return;e.preventDefault();canvas.setPointerCapture?.(e.pointerId);down=true;const [x,y]=pos(e);ctx.beginPath();ctx.moveTo(x,y);};
  canvas.onpointermove=e=>{if(!down)return;e.preventDefault();const [x,y]=pos(e);ctx.lineWidth=2.5;ctx.lineCap='round';ctx.strokeStyle='#182629';ctx.lineTo(x,y);ctx.stroke();hidden.value=canvas.toDataURL('image/png');};
  canvas.onpointerup=canvas.onpointercancel=()=>{down=false;};
  if(safeImage(hidden.value)){const image=new Image();image.onload=()=>ctx.drawImage(image,0,0,600,150);image.src=hidden.value;}
  document.querySelector('[data-clear-sign="'+key+'"]').onclick=()=>{ctx.clearRect(0,0,600,150);hidden.value='';};
 }
 async function photo(file){
  const host=byId('native-photos');if(host.children.length>=4)throw Error('Podes juntar até quatro fotografias.');
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>8*1024*1024)throw Error('Escolhe JPG, PNG ou WebP até 8 MB.');
  const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});const c=document.createElement('canvas'),scale=Math.min(1,1000/Math.max(img.width,img.height));c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);const src=c.toDataURL('image/jpeg',.72);if(!safeImage(src))throw Error('A imagem é demasiado grande.');const figure=document.createElement('figure');figure.dataset.nativePhoto='';figure.innerHTML='<img src="'+src+'" alt="Fotografia da intervenção"><input type="text" aria-label="Legenda da fotografia" value="'+esc(file.name)+'"><button class="native-screen" type="button" data-photo-remove>Retirar fotografia</button>';host.append(figure);}finally{URL.revokeObjectURL(url);}
 }
 byId('native-photo-file').onchange=async e=>{try{for(const file of e.target.files)await photo(file);}catch(err){status(err.message||'Não foi possível ler a fotografia.');}finally{e.target.value='';}};
 byId('native-photos').onclick=e=>{const button=e.target.closest('[data-photo-remove]');if(button&&!busy)button.closest('figure').remove();};
 byId('_relBtnRascunho').onclick=()=>send(false);byId('_relBtnConcluir').onclick=()=>send(true);byId('native-print').onclick=()=>window.print();
 window.addEventListener('message',event=>{if(event.source!==window.parent)return;const msg=event.data||{};if(msg.type==='init'){permitted=msg.podeAssinar===true;prefill(msg);}if(msg.type==='permissao')permitted=msg.podeAssinar===true;if(msg.type==='nativeSaveError'){busy=false;document.querySelectorAll('.native-footer button').forEach(b=>b.disabled=false);status(msg.message||'Não foi possível guardar.');}});
 ['tecnico','cliente'].forEach(bindSignature);
 window.TGNativeSheet={state,serialize,validate};
})();
