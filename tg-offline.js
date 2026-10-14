/* Total Gest — offline draft storage: account-scoped, consent-based and never auto-syncs.
   The server remains authoritative. No service role keys or authentication tokens are stored. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TGOffline=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const NAME='tg-offline-v1',STORE='drafts';
let dbPromise=null;
function open(){
 if(typeof indexedDB==='undefined')return Promise.reject(Error('IndexedDB indisponível'));
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{const q=indexedDB.open(NAME,1);
 q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE,{keyPath:'key'});};
 q.onsuccess=()=>resolve(q.result);q.onerror=()=>{dbPromise=null;reject(q.error);};
 });return dbPromise;
}
function scope(tenantId,userId){if(!tenantId||!userId)throw Error('Sessão autenticada obrigatória');return String(tenantId)+':'+String(userId)+':';}
async function transaction(mode,fn){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),s=tx.objectStore(STORE);let value;try{value=fn(s);}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(value?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Transação cancelada'));});}
function clean(value){const str=JSON.stringify(value);if(!str||str.length>500000)throw Error('Rascunho demasiado grande');return JSON.parse(str);}
async function save({tenantId,userId,id,type,data}){
 if(!id||!['report','service-note','checklist'].includes(type))throw Error('Tipo ou identificação inválidos');
 const key=scope(tenantId,userId)+type+':'+String(id);
 // Never keep auth secrets or unnecessary customer data offline.
 const value=clean(data);if(value===null||typeof value!=='object')throw Error('Dados inválidos');
 const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key,tenantId:String(tenantId),userId:String(userId),type,id:String(id),data:value,updatedAt:new Date().toISOString(),state:'local'});tx.oncomplete=()=>resolve(key);tx.onerror=()=>reject(tx.error);});
}
async function list({tenantId,userId}){const prefix=scope(tenantId,userId),db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),q=tx.objectStore(STORE).getAll();q.onsuccess=()=>resolve(q.result.filter(v=>v.key.startsWith(prefix)));q.onerror=()=>reject(q.error);});}
async function remove({tenantId,userId,id,type}){const key=scope(tenantId,userId)+type+':'+String(id);const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function clearAccount({tenantId,userId}){const items=await list({tenantId,userId});const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');items.forEach(i=>tx.objectStore(STORE).delete(i.key));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
return Object.freeze({save,list,remove,clearAccount});
});
