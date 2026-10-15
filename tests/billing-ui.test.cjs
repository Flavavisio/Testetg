const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const fs=require('node:fs');const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../app-principal.js'),'utf8');
function fn(name){const match=src.match(new RegExp('        function '+name+'\\([^]*?\\n        \\}'));assert.ok(match,name);return match[0];}
test('old add-on entry points redirect to four packs without creating requests',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;
 w.eval("var PACKS_APENAS=true;var usuarioLogado={role:'admin'};var calls=0;function _abrirCompraPack(){calls++}");
 for(const name of ['solicitarContratos','solicitarFrota','solicitarArmazem','solicitarCrm','solicitarRondas','_ativAddonsAbrir','_ativAddonsSubmeter','salvarRenovacao']){
  w.eval(fn(name));w[name]({preventDefault(){}});
 }
 assert.equal(w.eval('calls'),8);d.window.close();
});
test('legacy company renewal is routed to pack selector; no licence mutation',()=>{
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window;
 w.eval("var PACKS_APENAS=true;var usuarioLogado={role:'admin'};var calls=0;function _abrirCompraPack(){calls++}");
 w.eval(fn('abrirModalRenovacao'));w.abrirModalRenovacao('renovacao');assert.equal(w.eval('calls'),1);d.window.close();
});
test('disabled sandbox makes no requests; enabled panel offers exactly four packs and methods',async()=>{
 const d=new JSDOM('<div id="content"></div>',{runScripts:'outside-only',url:'https://www.totalgest.pt/login.html?billing_order=test'}),w=d.window;
 w.eval("var usuarioLogado={id:'a',role:'admin'};var calls=[];var supa={functions:{invoke:async(name,args)=>{calls.push(args.body);return {data:[],error:null}}}};");
 w.eval(fs.readFileSync(path.join(__dirname,'../tg-billing.js'),'utf8'));
 w.TGBilling.mount(w.document.getElementById('content'));assert.equal(w.eval('calls.length'),0);
 w.TG_BILLING_SANDBOX_ENABLED=true;w.TGBilling.mount(w.document.getElementById('content'));
 await new Promise(r=>setImmediate(r));
 const selects=w.document.querySelectorAll('select');assert.equal(selects.length,4);
 assert.deepEqual([...selects[0].options].map(o=>o.value),['express','expert','pro','supreme']);
 assert.equal(selects[3].options.length,4);assert.match(w.document.body.textContent,/não cobra dinheiro nem altera a licença/);
 const count=w.eval('calls.length');w.TGBilling.mount(w.document.getElementById('content'));assert.equal(w.eval('calls.length'),count);
 d.window.close();
});
