const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../tg-push.js'),'utf8');
function setup({permission='granted',sub=true,upsertError=null,slow=false,getError=null,subscribeError=null,configError=null,workerState='activated'}={}) {
 const calls={get:0,subscribe:0,upserts:[],prompt:0,unsubscribe:0,alerts:[],sino:0,functions:[],registrations:[]},events={};
 let currentSub=sub===true?subscription():sub;
 let finish;
 const workerEvents={};const reg={active:{state:workerState,addEventListener(t,f){workerEvents[t]=f},removeEventListener(){}},addEventListener(){},removeEventListener(){},pushManager:{async getSubscription(){calls.get++;if(getError)throw getError;if(slow)await new Promise(r=>finish=r);return currentSub},async subscribe(opts){calls.subscribe++;if(subscribeError)throw subscribeError;c.Notification.permission='granted';assert.equal(opts.userVisibleOnly,true);return currentSub=subscription()}}};
 function subscription(){return {expirationTime:null,async unsubscribe(){calls.unsubscribe++;currentSub=null;return true},toJSON(){return {endpoint:'https://push.example/device',keys:{p256dh:'device-key',auth:'device-auth'}}}};}
 const supa={functions:{async invoke(name,options){calls.functions.push({name,body:options.body});return options.body.acao==='config'?{data:{chave_publica:'public'},error:configError}:{data:{agendado:true}}}},from(table){
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
  navigator:{serviceWorker:{async getRegistration(){return reg},ready:Promise.resolve(reg),async register(url){calls.registrations.push(url);return reg},addEventListener(t,f){events['sw:'+t]=f}}},
  Notification:{permission,async requestPermission(){calls.prompt++;return c.Notification.permission='granted'}},PushManager:function(){},
  document:{getElementById(){return null},addEventListener(t,f){events[t]=f},visibilityState:'visible'},
  addEventListener(t,f){events[t]=f},alert:t=>calls.alerts.push(t),
  moduloNotificacoesAtivo:()=>true,adminDoUtilizador:()=>({id:'admin-1'}),_ativarNotificacoesPush(){},atualizarSino(){calls.sino++},
  _urlBase64ToUint8Array:()=>new Uint8Array([1]),VAPID_PUBLIC_KEY:'public',supa
 });
 c.window=c;vm.runInContext(source,c);
 return {c,calls,events,reg,workerEvents,finish:()=>finish(),tick:()=>new Promise(r=>setImmediate(r))};
}
test('already permitted device restores a missing server registration without another permission prompt',async()=>{
 const {c,calls}=setup();assert.equal(await c.TGPush.sync(),true);assert.equal(calls.prompt,0);assert.equal(calls.subscribe,0);assert.equal(calls.upserts.length,1);assert.equal(calls.upserts[0].rows[0].utilizador_id,'admin-1');assert.equal(calls.upserts[0].rows[0].admin_id,'admin-1');assert.equal(calls.upserts[0].opts.onConflict,'endpoint');assert(c.TGPush.getState().registered);
 await c.TGPush.sync();assert.equal(calls.upserts.length,1,'frequent renders do not write repeatedly');
});
test('background sync never subscribes; a tap subscribes synchronously before any await',async()=>{
 const {c,calls}=setup({sub:null});await c.TGPush.sync();assert.equal(calls.subscribe,0);assert.equal(calls.upserts.length,0);assert.equal(c.TGPush.getState().status,'needs_activation');const activated=c.TGPush.activate();assert.equal(calls.subscribe,1,'subscribe occurs before the click handler returns');await activated;assert.equal(calls.upserts.length,1);
});
test('expired subscriptions are renewed',async()=>{
 const s=setup({sub:null});await s.c.TGPush.sync();
 const expired={expirationTime:Date.now()-1000,async unsubscribe(){s.calls.unsubscribe++;return true},toJSON(){throw Error('expired subscription cannot be used')}};
 s.reg.pushManager.getSubscription=async()=>expired;
 await s.c.TGPush.sync(true);assert.equal(s.calls.unsubscribe,1);assert.equal(s.calls.subscribe,0);assert.equal(s.c.TGPush.getState().status,'needs_activation');await s.c.TGPush.activate();assert.equal(s.calls.subscribe,1);
});
test('permission is requested only after clicking Activate',async()=>{
 const {c,calls}=setup({permission:'default'});await c.TGPush.sync();assert.equal(calls.prompt,0);assert.equal(calls.upserts.length,0);const activated=c._ativarNotificacoesPush();assert.equal(calls.subscribe,1);await activated;assert.equal(calls.prompt,0);assert.equal(calls.upserts.length,1);
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

test('configuration errors identify the stage even before permission is granted',async()=>{
 const {c}=setup({permission:'default',configError:{name:'FunctionsFetchError'}});await c.TGPush.sync();assert.equal(c.TGPush.getState().failure,'config/FunctionsFetchError');assert.match(c.TGPush.getState().message,/config\/FunctionsFetchError/);
});
test('subscription errors are visible and a manual tap can recover without reading the subscription again',async()=>{
 const {c,calls}=setup({getError:{name:'AbortError'}});await c.TGPush.sync();assert.equal(c.TGPush.getState().failure,'subscription/AbortError');await c.TGPush.activate();assert(c.TGPush.getState().registered);assert.equal(calls.get,1);
});
test('a rejected permission request never claims registration',async()=>{
 const {c}=setup({permission:'default',subscribeError:{name:'NotAllowedError'}});await c.TGPush.sync();await c.TGPush.activate();assert.equal(c.TGPush.getState().registered,false);assert.match(c.TGPush.getState().message,/subscribe\/NotAllowedError/);
});
test('locked-screen test is scheduled by the server for the registered device only',async()=>{
 const {c,calls}=setup();await c.TGPush.sync();assert.equal(calls.functions.filter(x=>x.body.acao==='teste').length,0);await c.TGPush.test();const request=calls.functions.at(-1);assert.equal(request.name,'testar-push');assert.deepEqual(Object.keys(request.body).sort(),['acao','endpoint']);assert.equal(request.body.endpoint,'https://push.example/device');assert.match(calls.alerts.at(-1),/10 segundos/);
});

test('numeric DOMException 11 repairs a missing registration once and requires a fresh tap',async()=>{
 const s=setup({sub:null,subscribeError:{code:11,message:'Subscribing for push requires an active service worker'}});await s.c.TGPush.sync();await s.c.TGPush.activate();assert.deepEqual(s.calls.registrations,['sw.js?push-repair=v82']);assert.equal(s.c.TGPush.getState().status,'needs_activation');assert.match(s.calls.alerts.at(-1),/Toque em Ativar/);assert.equal(s.calls.subscribe,1,'repair must not subscribe outside the tap');await s.c.TGPush.activate();assert.equal(s.calls.registrations.length,1,'persistent errors do not loop through worker resets');assert.match(s.c.TGPush.getState().message,/InvalidStateError/);assert.match(s.c.TGPush.getState().message,/active service worker/);
});
test('old subscription is cleared on InvalidStateError without reinstalling the app worker',async()=>{
 const s=setup({subscribeError:{name:'InvalidStateError',code:11}});await s.c.TGPush.sync();await s.c.TGPush.activate();assert.equal(s.calls.unsubscribe,1);assert.equal(s.calls.registrations.length,0);assert.equal(s.c.TGPush.getState().registered,false);assert.equal(s.c.TGPush.getState().status,'needs_activation');
});
test('activation waits until the worker is fully activated',async()=>{
 const s=setup({workerState:'activating'});await s.tick();assert.equal(s.calls.functions.length,0);assert.equal(s.c.TGPush.getState().status,'preparing');s.reg.active.state='activated';s.workerEvents.statechange();await s.c.TGPush.sync();assert(s.c.TGPush.getState().registered);
});
test('repair waits for the replacement worker rather than accepting the previous active worker',async()=>{
 const s=setup({sub:null,subscribeError:{code:11}});await s.c.TGPush.sync();const listeners=new Set();const old=s.reg.active;const replacement={state:'installing',addEventListener(t,f){listeners.add(f)},removeEventListener(t,f){listeners.delete(f)}};
 s.reg.installing=replacement;s.c.navigator.serviceWorker.register=async()=>s.reg;
 const activation=s.c.TGPush.activate();await s.tick();assert.equal(s.c.TGPush.getState().status,'preparing');assert.equal(s.reg.active,old);
 replacement.state='activated';s.reg.active=replacement;s.reg.installing=null;for(const fn of [...listeners])fn();await activation;assert.equal(s.c.TGPush.getState().status,'needs_activation');assert.equal(s.calls.subscribe,1);
});
test('failed removal of an old subscription never reports the repair as complete',async()=>{
 const s=setup({subscribeError:{name:'InvalidStateError',code:11}});await s.c.TGPush.sync();s.reg.pushManager.getSubscription=async()=>({unsubscribe:async()=>false});await s.c.TGPush.activate();assert.equal(s.c.TGPush.getState().status,'error');assert.equal(s.c.TGPush.getState().registered,false);assert.match(s.c.TGPush.getState().message,/PreviousSubscriptionStillPresent/);
});
