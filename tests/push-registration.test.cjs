const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../tg-push.js'),'utf8');
function setup({permission='granted',sub=true,upsertError=null,slow=false}={}) {
 const calls={get:0,subscribe:0,upserts:[],prompt:0,unsubscribe:0,alerts:[],sino:0},events={};
 let currentSub=sub===true?subscription():sub;
 let finish;
 const reg={pushManager:{async getSubscription(){calls.get++;if(slow)await new Promise(r=>finish=r);return currentSub},async subscribe(opts){calls.subscribe++;assert.equal(opts.userVisibleOnly,true);return currentSub=subscription()}}};
 function subscription(){return {expirationTime:null,async unsubscribe(){calls.unsubscribe++;currentSub=null;return true},toJSON(){return {endpoint:'https://push.example/device',keys:{p256dh:'device-key',auth:'device-auth'}}}};}
 const supa={from(table){
  assert.equal(table,'push_subscriptions');
  return {upsert(rows,opts){
   calls.upserts.push({rows,opts});
   return {select(fields){
    assert.equal(fields,'utilizador_id');
    return {async single(){return {error:upsertError,data:upsertError?null:{utilizador_id:rows[0].utilizador_id}}}};
   }};
  }};
 }};
 const c=vm.createContext({
  console:{warn(){}},Date,setTimeout,clearTimeout,Uint8Array,Promise,
  usuarioLogado:{id:'admin-1',role:'admin'},
  navigator:{serviceWorker:{async getRegistration(){return reg},ready:Promise.resolve(reg),async register(){throw Error('must reuse registration')},addEventListener(t,f){events['sw:'+t]=f}}},
  Notification:{permission,async requestPermission(){calls.prompt++;return c.Notification.permission='granted'}},PushManager:function(){},
  document:{getElementById(){return null},addEventListener(t,f){events[t]=f},visibilityState:'visible'},
  addEventListener(t,f){events[t]=f},alert:t=>calls.alerts.push(t),
  moduloNotificacoesAtivo:()=>true,adminDoUtilizador:()=>({id:'admin-1'}),_ativarNotificacoesPush(){},atualizarSino(){calls.sino++},
  _urlBase64ToUint8Array:()=>new Uint8Array([1]),VAPID_PUBLIC_KEY:'public',supa
 });
 c.window=c;vm.runInContext(source,c);
 return {c,calls,events,reg,finish:()=>finish(),tick:()=>new Promise(r=>setImmediate(r))};
}
test('already permitted device restores a missing server registration without another permission prompt',async()=>{
 const {c,calls}=setup();assert.equal(await c.TGPush.sync(),true);assert.equal(calls.prompt,0);assert.equal(calls.subscribe,0);assert.equal(calls.upserts.length,1);assert.equal(calls.upserts[0].rows[0].utilizador_id,'admin-1');assert.equal(calls.upserts[0].rows[0].admin_id,'admin-1');assert.equal(calls.upserts[0].opts.onConflict,'endpoint');assert(c.TGPush.getState().registered);
 await c.TGPush.sync();assert.equal(calls.upserts.length,1,'frequent renders do not write repeatedly');
});
test('granted permission without a local subscription creates one and saves it',async()=>{
 const {c,calls}=setup({sub:null});await c.TGPush.sync();assert.equal(calls.subscribe,1);assert.equal(calls.upserts.length,1);
});
test('expired subscriptions are renewed',async()=>{
 const s=setup({sub:null});await s.c.TGPush.sync();
 const expired={expirationTime:Date.now()-1000,async unsubscribe(){s.calls.unsubscribe++;return true},toJSON(){throw Error('expired subscription cannot be used')}};
 s.reg.pushManager.getSubscription=async()=>expired;
 await s.c.TGPush.sync(true);assert.equal(s.calls.unsubscribe,1);assert.equal(s.calls.subscribe,2);
});
test('permission is requested only after clicking Activate',async()=>{
 const {c,calls}=setup({permission:'default'});await c.TGPush.sync();assert.equal(calls.prompt,0);assert.equal(calls.upserts.length,0);await c._ativarNotificacoesPush();assert.equal(calls.prompt,1);assert.equal(calls.upserts.length,1);
});
test('denied permission is respected and reports the block',async()=>{
 const {c,calls}=setup({permission:'denied'});await c._ativarNotificacoesPush();assert.equal(calls.prompt,0);assert.equal(calls.subscribe,0);assert.equal(calls.upserts.length,0);assert.match(calls.alerts[0],/bloqueadas/);
});
test('a failed save is never reported as active and manual verification retries',async()=>{
 const {c,calls}=setup({upsertError:{message:'RLS error'}});await c.TGPush.sync();assert.equal(c.TGPush.getState().registered,false);assert.equal(c.TGPush.getState().status,'error');await c.TGPush.sync();assert.equal(calls.upserts.length,1);await c.TGPush.sync(true);assert.equal(calls.upserts.length,2);
});
test('duplicate sync calls share one in-flight registration',async()=>{
 const s=setup({slow:true});await s.tick();const p=s.c.TGPush.sync(true);assert.equal(s.calls.get,1);s.finish();assert.equal(await p,true);assert.equal(s.calls.upserts.length,1);
});
test('switching accounts during registration does not save for the wrong user',async()=>{
 const s=setup({slow:true});await s.tick();const p=s.c.TGPush.sync();s.c.usuarioLogado={id:'other',role:'subadmin',adminId:'admin-1'};s.finish();await p;assert.equal(s.calls.upserts.length,0);const second=s.c.TGPush.sync(true);await s.tick();s.finish();await second;assert.equal(s.calls.upserts[0].rows[0].utilizador_id,'other');assert.equal(s.calls.upserts[0].rows[0].admin_id,'admin-1');
});
test('online and resume reconnect; wrapper retains normal notification menu',async()=>{
 const {c,calls,events}=setup();await c.TGPush.sync();await events.online();await c.TGPush.sync();assert.equal(calls.upserts.length,2);c.atualizarSino();assert.equal(calls.sino,1);await events.visibilitychange();await c.TGPush.sync();assert.equal(calls.upserts.length,2);
});
