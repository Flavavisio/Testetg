/* Preparação PHC. Modelo interno e simulação; não é um cliente de API PHC. */
(function(host){
'use strict';
const editions=['go','cs'];
function text(v,max=160){return typeof v==='string'?v.trim().slice(0,max):'';}
function draft(input={}){
 const edition=editions.includes(input.edition)?input.edition:'go';
 const url=text(input.baseUrl,500);
 if(url){let u;try{u=new URL(url);}catch{throw Error('Indica um URL válido.');}if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Usa um URL HTTPS sem credenciais, parâmetros ou fragmentos.');}
 const mappings=Array.isArray(input.warehouses)?input.warehouses.slice(0,40).map(x=>({localId:text(x.localId),externalId:text(x.externalId)})).filter(x=>x.localId||x.externalId):[];
 if(mappings.some(x=>!x.localId||!x.externalId))throw Error('Preenche os dois lados de cada associação de armazém.');
 if(new Set(mappings.map(x=>x.localId)).size!==mappings.length||new Set(mappings.map(x=>x.externalId)).size!==mappings.length)throw Error('Cada armazém só pode aparecer uma vez nas associações.');
 return {schemaVersion:1,edition,status:'draft',baseUrl:url,company:text(input.company),appId:edition==='go'?text(input.appId):'',version:edition==='cs'?text(input.version):'',scriptCode:edition==='cs'?text(input.scriptCode):'',invoiceSeries:text(input.invoiceSeries),stockPolicy:input.stockPolicy==='consumption'?'consumption':'invoice',warehouses:mappings,updatedAt:new Date().toISOString()};
}
function demo(tenant,edition,policy){
 if(!tenant||!editions.includes(edition)||!['invoice','consumption'].includes(policy))throw Error('Contexto de simulação inválido.');
 let quantity=5,consumed=false;const issued=new Map();
 return {run(){
   const key=JSON.stringify([tenant,edition,'OS-DEMO-001']);
   if(issued.has(key))return {...issued.get(key),duplicate:true};
   // O mesmo consumo só é contabilizado numa fase do ciclo.
   if(policy==='consumption'&&!consumed){quantity-=2;consumed=true;}
   const beforeInvoice=quantity;
   if(policy==='invoice')quantity-=2;
   const result=Object.freeze({simulation:true,documentId:'SIM-'+edition.toUpperCase()+'-001',source:'OS-DEMO-001',netCents:13000,taxCents:2990,totalCents:15990,quantityBeforeInvoice:beforeInvoice,quantityAfter:quantity,stockStage:policy,duplicate:false});
   issued.set(key,result);return {...result};
 }};
}
const api={draft,demo};if(typeof module==='object'&&module.exports)module.exports=api;else host.TGPHCCore=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
