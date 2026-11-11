/* TG-04 — photographs belong to the OS, not to a specialty report.
   Uses existing servicos.fotos JSONB and private tenant-scoped Storage bucket. */
(function(root){
 'use strict';
 if(root.TGOSPhotos)return;
 const BUCKET='relatorios-especialidade';
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let modal=null,context=null,busy=false;
 function identity(){
  const user=typeof usuarioLogado==='undefined'?null:usuarioLogado;
  if(!user)return null;
  return {id:user.id,tenant:user.role==='admin'?user.id:user.adminId,role:user.role};
 }
 function osFor(id){
  const me=identity(),os=(typeof dados==='undefined'?[]:dados.servicos||[]).find(o=>o.id===id&&o.adminId===me?.tenant);
  if(!os||!me||!['admin','subadmin','encarregado','funcionario'].includes(me.role))return null;
  if(['admin','subadmin'].includes(me.role))return os;
  const ids=Array.isArray(os.funcionariosIds)&&os.funcionariosIds.length?os.funcionariosIds:[os.funcionarioId].filter(Boolean);
  if(ids.includes(me.id)||ids.includes('todos')||ids.includes('Todos'))return os;
  if(me.role==='encarregado'&&(dados.encarregados||[]).some(e=>e.id===me.id&&e.adminId===me.tenant&&
    (e.funcionariosIds||[]).some(id=>ids.includes(id))))return os;
  return null;
 }
 function valid(){const me=identity();return !!(context&&me&&me.id===context.userId&&me.tenant===context.tenant&&osFor(context.id));}
 function status(message,error=false){const el=$('tg-os-photo-status');if(el){el.textContent=message;el.style.color=error?'#b42318':'#475569';}}
 function fileName(file){return String(file?.name||'foto').slice(0,90);}
 function isPhoto(file){return file&&['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=8*1024*1024;}
 function compress(file){
  return new Promise((resolve,reject)=>{
   const url=URL.createObjectURL(file),img=new Image();
   img.onload=()=>{
    try{
     const max=1600,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
     const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
     canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
     canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Não foi possível preparar a imagem.')),'image/jpeg',.78);
    }catch(e){reject(e)}finally{URL.revokeObjectURL(url)}
   };
   img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Fotografia inválida.'))};
   img.src=url;
  });
 }
 async function display(){
  if(!valid()||!modal)return;
  const container=$('tg-os-photo-gallery');container.replaceChildren();
  const list=osFor(context.id)?.fotos||[];
  for(const photo of list){
   if(!valid()||!modal)return;
   const div=document.createElement('figure');div.style.cssText='margin:0;border:1px solid #e2e8f0;border-radius:9px;padding:6px';
   let src='';
   if(photo.storagePath&&photo.bucket===BUCKET&&photo.storagePath.startsWith(context.tenant+'/os/'+context.id+'/')){
    const signed=await supa.storage.from(BUCKET).createSignedUrl(photo.storagePath,60*30);
    if(!signed.error)src=signed.data?.signedUrl||'';
   }else if(typeof photo.url==='string'&&/^https:\/\//i.test(photo.url)){
    // Display existing OS photographs; do not copy them into a new public location.
    const storageHost=new URL(supa.storage.from(BUCKET).getPublicUrl('dummy').data.publicUrl).host;
    try{if(new URL(photo.url).host===storageHost)src=photo.url}catch(_){}
   }
   if(src){const img=document.createElement('img');img.src=src;img.alt='Fotografia da OS';img.loading='lazy';img.style.cssText='display:block;width:100%;max-height:180px;object-fit:contain';div.append(img);}
   const caption=document.createElement('figcaption');caption.style.cssText='font-size:12px;word-break:break-word';caption.textContent=photo.nome||'Fotografia da OS';div.append(caption);container.append(div);
  }
  $('tg-os-photo-count').textContent=String(list.length);
 }
 function close(){if(busy)return;modal?.remove();modal=null;context=null;}
 function open(osId){
  const os=osFor(osId),me=identity();if(!os||!me)return false;
  if(modal)modal.remove();
  context={id:osId,tenant:me.tenant,userId:me.id};busy=false;
  const wrapper=document.createElement('div');wrapper.id='tg-os-photo-modal';
  wrapper.innerHTML='<section class="tg-os-photo-dialog" role="dialog" aria-modal="true" aria-labelledby="tg-os-photo-title">'
   +'<div class="tg-os-photo-header"><h2 id="tg-os-photo-title">Fotografias da OS</h2><button type="button" class="tg-os-photo-dismiss" data-photo-close aria-label="Fechar fotografias">×</button></div>'
   +'<p class="tg-os-photo-description">Fotografias associadas à ordem de serviço, sem necessidade de criar relatórios.</p>'
   +'<div class="tg-os-photo-actions"><button type="button" data-photo-source="camera"><i class="fas fa-camera" aria-hidden="true"></i> Tirar fotografia</button><button type="button" data-photo-source="gallery"><i class="fas fa-images" aria-hidden="true"></i> Escolher da galeria</button></div>'
   +'<input id="tg-os-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>'
   +'<p id="tg-os-photo-status" class="tg-os-photo-status" role="status" aria-live="polite"></p>'
   +'<p class="tg-os-photo-count">Fotografias guardadas: <strong id="tg-os-photo-count">0</strong></p>'
   +'<div id="tg-os-photo-gallery" class="tg-os-photo-gallery"></div></section>';
  wrapper.addEventListener('click',event=>{
   if(event.target===wrapper||event.target.closest('[data-photo-close]'))return close();
   const option=event.target.closest('[data-photo-source]');if(!option||busy)return;
   const input=$('tg-os-photo-input');if(option.dataset.photoSource==='camera'){input.capture='environment';input.multiple=false;}else{input.removeAttribute('capture');input.multiple=true;}
   input.click();
  });
  wrapper.querySelector('#tg-os-photo-input').addEventListener('change',async e=>{
   const files=[...e.target.files];e.target.value='';
   await add(files);
  });
  document.body.append(wrapper);modal=wrapper;
  display().catch(e=>status(e.message,true));
  wrapper.querySelector('[data-photo-source="camera"]').focus({preventScroll:true});
  return true;
 }
 async function add(files){
  if(busy||!valid()||!files.length)return;busy=true;
  const buttons=modal?.querySelectorAll('button');buttons?.forEach(b=>b.disabled=true);
  let completed=0;
  try{
   if(typeof supa==='undefined')throw Error('Não há ligação ao servidor.');
   for(const file of files){
    if(!valid())throw Error('A sessão mudou. Volta a abrir as fotografias.');
    if(!isPhoto(file))throw Error('Escolhe JPG, PNG ou WebP até 8 MB.');
    status('A enviar '+fileName(file)+'…');
    const blob=await compress(file);
    const path=context.tenant+'/os/'+context.id+'/'+(crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2))+'.jpg';
    const storage=supa.storage.from(BUCKET);
    const upload=await storage.upload(path,blob,{contentType:'image/jpeg',upsert:false});
    if(upload.error)throw Error('Não foi possível guardar a fotografia no armazenamento: '+upload.error.message);
    let stored=false;
    try{
     const next={bucket:BUCKET,storagePath:path,nome:fileName(file),funcionarioId:context.userId,dataCriacao:Date.now()};
     // Fetch only this OS; do not rewrite other service fields.
     const read=await supa.from('servicos').select('id,fotos').eq('id',context.id).eq('admin_id',context.tenant).single();
     if(read.error||!read.data)throw Error('Não foi possível confirmar a OS no servidor.');
     const old=Array.isArray(read.data.fotos)?read.data.fotos:[];
     if(!valid())throw Error('A sessão mudou durante o envio.');
     const updated=[...old,next];
     const save=await supa.from('servicos').update({fotos:updated}).eq('id',context.id).eq('admin_id',context.tenant).select('id,fotos').single();
     if(save.error||!save.data)throw Error('Não foi possível associar a fotografia à OS.');
     stored=true;
     const os=osFor(context.id);if(os)os.fotos=save.data.fotos;
     // Align the native snapshot so a later bulk refresh cannot roll back the photo.
     try{
      if(os&&typeof _snap!=='undefined'&&typeof M!=='undefined'&&M.servicos?.to){
       _snap.servicos?.set(context.id,JSON.stringify(M.servicos.to(os)));
      }
     }catch(_){}
     completed++;status(completed+' fotografia(s) guardada(s).');
    }finally{
     // Avoid orphaned files if the database rejected the association.
     if(!stored)try{await storage.remove([path]);}catch(_){}
    }
   }
   await display();
  }catch(e){status(e.message||'Não foi possível guardar fotografias.',true);}
  finally{busy=false;buttons?.forEach(b=>b.disabled=false);}
 }
 document.addEventListener('tg:interface-updated',()=>{if(modal&&!valid())close();});

 // Existing OS details have a separate Add Photo action which may force the camera.
 // Route that action into this same camera/gallery dialog, using the OS number
 // shown in the active OS dialog. Fail open to the legacy action if not certain.
 function osFromNativePhotoButton(button){
  const root=button.closest('.modal-overlay.open,.modal.open,[role="dialog"]');
  if(!root||root.id==='tg-os-photo-modal'||root.closest('#tg-os-photo-modal'))return null;
  const heading=root.querySelector('h1,h2,h3,.modal-title,.modal-header')?.textContent||'';
  const number=String(heading).match(/\bOS[-\s]*([A-Z0-9-]{4,})/i)?.[0]?.replace(/^OS\s+/i,'').trim();
  if(!number)return null;
  const me=identity();if(!me)return null;
  const matches=(typeof dados==='undefined'?[]:dados.servicos||[])
   .filter(os=>os.adminId===me.tenant&&os.numeroRegisto===number&&osFor(os.id));
  return matches.length===1?matches[0]:null;
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||!/\badicionar\s+foto(?:grafia)?\b/i.test(button.textContent||''))return;
  const os=osFromNativePhotoButton(button);
  if(!os)return;
  event.preventDefault();event.stopImmediatePropagation();
  open(os.id);
 },true);

 root.TGOSPhotos={open,close};
})(window);
