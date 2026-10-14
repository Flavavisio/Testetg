const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('customer history and CRM scripts are actually included in index',()=>{
 const html=read('index.html');
 for(const name of ['tg-client-history.js','tg-client-history.css','tg-integrated-modules.js','tg-integrated-modules.css'])
   assert(html.includes(name),name+' missing in app');
 assert.match(html,/id="cardCRM"[^>]*TGModules\.open/);
});
test('kiosk overlay allows vertical touch scrolling',()=>{
 const css=read('styles.css');
 assert.match(css,/#tgQuiosqueOverlay\.aberto\s*\{/);
 assert.match(css,/touch-action:\s*pan-y/);
 assert.match(css,/overflow-y:\s*auto\s*!important/);
});
function exerciseCRM(granted){
 const source=read('tg-integrated-modules.js');
 const sections=new Map(),calls=[],messages=[];
 const el=()=>({classList:{contains:()=>false,toggle(){},remove(){}},append(){},appendChild(){},setAttribute(){},addEventListener(){},remove(){}});
 const document={body:{classList:{contains:()=>false},appendChild(n){sections.set(n.id,n);}},getElementById:id=>sections.get(id)||null,querySelector:q=>q.includes('#cardsGrid')?{hidden:false,classList:{contains:()=>!granted}}:null,createElement:el,addEventListener(){}};
 const window={addEventListener(){}};
 const load=new Function('window','document','MutationObserver','setInterval','usuarioLogado','_licencaValidaTenant','adminDoUtilizador','moduloCrmAtivo','moduloAssistAtivo','abrirSecao','irParaInicio','alert','URLSearchParams',source+';return window.TGModules;');
 const app=load(window,document,class{observe(){}},()=>{},{id:'u',role:'admin'},()=>true,()=>({}),()=>true,()=>true,x=>calls.push(x),()=>{},m=>messages.push(m),class{toString(){return 'embedded=1';}});
 app.open('crm');return {calls,messages,sections};
}
test('CRM navigation prepares module for permitted accounts',()=>{
 const x=exerciseCRM(true);assert.deepEqual(x.calls,['crm']);assert(x.sections.has('secao-crm'));
});
test('CRM navigation denies unavailable module',()=>{
 const x=exerciseCRM(false);assert.equal(x.calls.length,0);assert.equal(x.sections.size,0);assert.equal(x.messages.length,1);
});
test('all connected main app modules parse as JavaScript',()=>{
 for(const p of ['tg-client-history.js','tg-integrated-modules.js','tg-passport.js','tg-contract-maintenance.js','sw.js'])assert.doesNotThrow(()=>new Function(read(p)),p);
});
