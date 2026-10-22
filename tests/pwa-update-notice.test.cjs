const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../pwa-service-worker.js'),'utf8');
function setup({waiting=null,controlled=true}={}){
 const events={},swEvents={},regEvents={},workerEvents={},calls={banners:[],reloads:0,register:[]};
 const reg={waiting,installing:null,addEventListener(t,f){regEvents[t]=f},update:async()=>{}};
 const ctx=vm.createContext({console,URLSearchParams,URL,setTimeout,clearTimeout,setInterval(){},navigator:{serviceWorker:{controller:controlled?{}:null,async register(url){calls.register.push(url);return reg},getRegistration:async()=>reg,addEventListener(t,f){swEvents[t]=f}}},document:{createElement(){return {style:{}}},body:{appendChild(el){calls.banners.push(el)}}},location:{search:'',reload(){calls.reloads++}},addEventListener(t,f){events[t]=f}});ctx.window=ctx;vm.runInContext(source,ctx);
 return {ctx,calls,reg,events,swEvents,regEvents,workerEvents,tick:()=>new Promise(r=>setImmediate(r))};
}
test('an activation message is not a new version and never reloads the app',async()=>{
 const s=setup();s.events.load();await s.tick();for(let i=0;i<3;i++)s.swEvents.message({data:{type:'SW_UPDATED'}});await s.tick();assert.equal(s.calls.banners.length,0);assert.equal(s.calls.reloads,0);assert.deepEqual(s.calls.register,['sw.js']);
});
test('first installation does not ask for another update',async()=>{
 const s=setup({controlled:false});s.events.load();await s.tick();s.swEvents.message({data:{type:'SW_UPDATED'}});await s.tick();assert.equal(s.calls.banners.length,0);
});
test('a genuine waiting version gets one update notice',async()=>{
 const s=setup({waiting:{}});s.events.load();await s.tick();s.swEvents.message({data:{type:'SW_UPDATED'}});await s.tick();assert.equal(s.calls.banners.length,1);assert.equal(s.calls.reloads,0);
});
test('installed worker events only display a notice if a version remains waiting',async()=>{
 const s=setup();s.events.load();await s.tick();const installing={state:'installed',addEventListener(t,f){s.workerEvents[t]=f}};s.reg.installing=installing;s.regEvents.updatefound();s.workerEvents.statechange();await s.tick();assert.equal(s.calls.banners.length,0);s.reg.waiting=installing;s.workerEvents.statechange();await s.tick();assert.equal(s.calls.banners.length,1);assert.equal(s.calls.reloads,0);
});
