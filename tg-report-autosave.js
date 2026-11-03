/* Local report checkpoints. No credentials; separate namespace per company and user. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TGReportAutosave=api;})(globalThis,function(){
 'use strict';
 let dbPromise;
 function open(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
   const r=indexedDB.open('tg-report-checkpoints',1);
   r.onupgradeneeded=()=>r.result.createObjectStore('reports');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>{dbPromise=null;reject(r.error);};
  });return dbPromise;
 }
 function key(scope){if(!scope.tenant||!scope.user||!scope.os||!scope.type)throw Error('Sessão e relatório obrigatórios');return JSON.stringify([scope.tenant,scope.user,scope.os,scope.type,scope.equipment||null,...(scope.model?[scope.model]:[])]);}
 async function access(mode,fn){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('reports',mode);let req;try{req=fn(tx.objectStore('reports'));}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(req?.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Não foi possível guardar no dispositivo'));});}
 const read=scope=>access('readonly',s=>s.get(key(scope)));
 const write=(scope,value)=>access('readwrite',s=>s.put(value,key(scope)));
 const remove=scope=>access('readwrite',s=>s.delete(key(scope)));
 const list=(tenant,user)=>access('readonly',s=>s.getAll()).then(rows=>rows.filter(r=>r.scope.tenant===tenant&&r.scope.user===user));
 function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
 // Reuse each legacy template's draft serializer (including dynamic REX tables).
 function prepare(html){return html.replace(/type: 'relatorioEspecialidadeRascunho',(?! _tgAutomatic)/g, "type: 'relatorioEspecialidadeRascunho', _tgAutomatic: !!window.__tgAutomatic, _tgRevision: window.__tgRevision,");}
 function attach({iframe,save,isCurrent,status}){
  const win=iframe.contentWindow,doc=iframe.contentDocument;
  let dirty=false,stopped=false,timer,revision=0,pending=Promise.resolve(),waiting;
  function queue(msg){const version=msg._tgRevision??revision;pending=pending.catch(()=>{}).then(async()=>{
   if(stopped||!isCurrent())return;
   try{status('A guardar…');const remote=await save(msg);if(version===revision){dirty=false;status(remote?'Sincronizado':'Guardado no dispositivo · por sincronizar');}return remote;}
   catch(e){dirty=true;status('Não foi possível guardar: '+e.message);throw e;}
  });pending.catch(()=>{});if(waiting){const done=waiting;waiting=null;done(pending);}return pending;}
  function flush(){
   clearTimeout(timer);if(stopped||!isCurrent()||!dirty)return pending;
   if(win.TGNativeSheet){const snapshot=win.TGNativeSheet.serialize(false),s=snapshot.estadoNativo;return queue({type:'relatorioEspecialidadeRascunho',_tgAutomatic:true,...snapshot,assinaturaTecnico:s.techSignature,assinaturaCliente:s.clientSignature,assinaturaTecnicoNome:s.values.sign_tecnico_nome,assinaturaClienteNome:s.values.sign_cliente_nome});}
   const captured=new Promise((resolve,reject)=>{waiting=resolve;setTimeout(()=>{if(waiting===resolve){waiting=null;reject(Error('O relatório não respondeu à gravação'));}},2000);});
   win.__tgAutomatic=true;win.__tgRevision=revision;try{doc.getElementById('_relBtnRascunho')?.click();}finally{win.__tgAutomatic=false;}
   captured.catch(()=>{});return captured;
  }
  function changed(e){if(e?.target?.closest?.('#_relBtnConcluir,#_relBtnRascunho,#native-print,[data-relbar]'))return;dirty=true;revision++;status('Alterações por guardar…');clearTimeout(timer);timer=setTimeout(flush,700);}
  function hidden(){if(document.visibilityState==='hidden')flush();}
  function retry(){if(!stopped&&isCurrent()){dirty=true;flush();}}
  ['input','change','pointerup','click'].forEach(t=>doc.addEventListener(t,changed));
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',flush);window.addEventListener('online',retry);
  const interval=setInterval(()=>{if(dirty)flush();},5000);
  const photos=doc.getElementById('native-photos'),observer=photos&&new win.MutationObserver(()=>changed());
  observer?.observe(photos,{childList:true,subtree:true});
  return {accept:queue,flush,stop(){stopped=true;observer?.disconnect();clearTimeout(timer);clearInterval(interval);['input','change','pointerup','click'].forEach(t=>doc.removeEventListener(t,changed));document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',flush);window.removeEventListener('online',retry);}};
 }
 return {read,write,remove,list,stable,prepare,attach};
});

