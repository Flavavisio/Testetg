const {JSDOM, VirtualConsole}=require('jsdom');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
for(const folder of [path.join(__dirname, '..')]){
const src=fs.readFileSync(path.join(folder,'app-principal.js'),'utf8');
const helpers=src.slice(src.indexOf('        function _tgAtualizarNomeFiscalDocumento'),src.indexOf('        // RCCTV / Intrusão'));
const prepare=new Function(helpers+';return _tgPrepararNomeFiscalEspecialidade;')();
for(const [_,tipo,b64] of src.matchAll(/(\w+):\s*"([A-Za-z0-9+/=]{10000,})"/g)){
const dom=new JSDOM('<iframe></iframe>',{runScripts:'dangerously',virtualConsole:new VirtualConsole()});
const w=dom.window.document.querySelector('iframe').contentWindow;
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:(_,k)=>k==='canvas'?{}:()=>{}});
const h=prepare(Buffer.from(b64,'base64').toString('utf8'),tipo);w.document.open();w.document.write(h);w.document.close();
const msg={type:'init',empresaNome:'VR Alarmes',empresaFiscal:'Flávio Rosa & Filhos, Lda.',anepcNumero:'10200',registoPrevioNumero:'10223',numero:'TEST-001'};
const check=()=>{
 const brands=[...w.document.querySelectorAll('.brand')];assert.ok(brands.length,tipo+' header');
 for(const b of brands){const f=b.querySelectorAll('.empresa-fiscal');assert.equal(f.length,tipo==='RDI'?0:1,tipo+' count');if(tipo!=='RDI'){assert.equal(f[0].textContent,msg.empresaFiscal,tipo);assert.equal(b.querySelector('.empresa-nome').nextElementSibling,f[0],tipo+' position');}}
};
w.dispatchEvent(new w.MessageEvent('message',{data:msg}));check();
w.dispatchEvent(new w.MessageEvent('message',{data:msg}));check();
if(typeof w.render==='function'){w.render();check();}
if(tipo!=='RDI'){
 w.eval(helpers);w.document.querySelectorAll('.empresa-fiscal').forEach(e=>e.remove());w._tgAtualizarNomeFiscalDocumento(w.document,msg.empresaFiscal,msg.empresaNome);check();
 const snapshot=new JSDOM(w.document.documentElement.outerHTML);assert.equal(snapshot.window.document.querySelector('.empresa-fiscal').textContent,msg.empresaFiscal);snapshot.window.close();
 w._tgAtualizarNomeFiscalDocumento(w.document,'',msg.empresaNome);assert.equal(w.document.querySelectorAll('.empresa-fiscal').length,0);
}
console.log(folder,tipo,'PASS');dom.window.close();
}
}
