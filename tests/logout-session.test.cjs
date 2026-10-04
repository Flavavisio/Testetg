const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app-principal.js','utf8');
const fn=name=>source.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0];
function setup(){
 const overlay={style:{display:'none'}},body={classList:{remove(){}}};let authCallback;
 const c={URL,console,clearInterval,setTimeout,usuarioLogado:{id:'a',nome:'Admin'},dados:{},_avisoSessaoMostrado:false,_logoutEmCurso:false,_trocandoConta:false,_dadosPollTimer:123,_heartbeatOn:true,_avisoRenovChecked:true,document:{getElementById:()=>overlay,body},window:{location:{href:'https://example.test/Testetg/login.html?x=1',replace:url=>c.destination=url}},_contarAlteracoesPendentes:()=>0,registarAuditoria:()=>{},renderizarTudo:()=>{c.rendered=true;},confirm:()=>false,alert:()=>{throw Error('Logout must not display alerts');},SUPABASE_URL:'https://project.supabase.co'};
 for(const name of ['pararHeartbeat','pararPollOnline','pararPollEquipa','pararPollMapa','pararPollDadosGerais'])c[name]=()=>{};
 c.supa={auth:{onAuthStateChange:fn=>authCallback=fn,signOut:async()=>{authCallback('SIGNED_OUT',null);}}};
 c.window.fetch=(...args)=>c.network?c.network(...args):Promise.resolve({status:200});vm.createContext(c);
 const start=source.indexOf('        supa.auth.onAuthStateChange('),end=source.indexOf('\n\n        // =============================================================',start);
 vm.runInContext(fn('_mostrarAvisoSessaoExpirada')+'\n'+source.slice(start,end)+'\n'+fn('logout'),c);
 return {c,overlay,event:(...args)=>authCallback(...args)};
}
test('intentional logout suppresses expiry and confirmation, cleans account and returns to login',async()=>{
 const {c,overlay}=setup();overlay.style.display='flex';await vm.runInContext('logout()',c);assert.equal(overlay.style.display,'none');assert.equal(c.usuarioLogado,null);assert(c.rendered);assert.equal(c.destination,'https://example.test/Testetg/login.html');assert.equal(c._avisoSessaoMostrado,false);
});
test('genuine expiration still shows once; anonymous and intentional account changes do not',()=>{
 const {c,overlay,event}=setup();c.usuarioLogado=null;event('SIGNED_OUT',null);assert.equal(overlay.style.display,'none');c.usuarioLogado={id:'a'};c._trocandoConta=true;event('SIGNED_OUT',null);assert.equal(overlay.style.display,'none');c._trocandoConta=false;event('SIGNED_OUT',null);assert.equal(overlay.style.display,'flex');assert.equal(c._dadosPollTimer,null);event('SIGNED_OUT',null);assert.equal(c._avisoSessaoMostrado,true);
});
test('401 from an old account does not expire a new account or logged-out screen',async()=>{
 const {c,overlay}=setup();let resolve;c.network=()=>new Promise(r=>resolve=r);
 const pending=vm.runInContext("window.fetch(SUPABASE_URL+'/rest/v1/clientes')",c);c.usuarioLogado={id:'b'};resolve({status:401});await pending;assert.equal(overlay.style.display,'none');
 const active=vm.runInContext("window.fetch(SUPABASE_URL+'/rest/v1/clientes')",c);resolve({status:401});await active;assert.equal(overlay.style.display,'flex');
});
test('cancelled unsaved-data logout preserves the signed-in account',async()=>{
 const {c}=setup();c._contarAlteracoesPendentes=()=>1;let times=0;c.confirm=()=>++times===1;c.guardarDados=async()=>{};await vm.runInContext('logout()',c);assert.equal(c.usuarioLogado.id,'a');assert.equal(c.destination,undefined);assert.equal(c._logoutEmCurso,false);
});
