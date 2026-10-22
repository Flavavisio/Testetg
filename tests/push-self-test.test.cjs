const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../supabase/functions/testar-push/index.ts'),'utf8').replace(/^import .*;\n/gm,''));
function setup({user=true,sub=true,endpoint='https://web.push.apple.com/device',sendError=null}={}){
 let handler,resolveDelay;const calls={queries:[],sent:[],background:[],deleted:[],delay:0};
 const admin={auth:{async getUser(token){assert.equal(token,'valid');return {data:{user:user?{id:'auth-me'}:null}}}},from(table){
  const filters=[];let deleting=false;
  const q={select(){return q},eq(k,v){filters.push([k,v]);return q},delete(){deleting=true;return q},async single(){calls.queries.push({table,filters});return {data:{registo_id:'me'}}},async maybeSingle(){calls.queries.push({table,filters});return {data:sub?{id:'device-me',endpoint,p256dh:'key',auth:'secret'}:null}},then(resolve){assert(deleting);calls.deleted.push({table,filters});resolve({error:null})}};return q;
 }};
 const c=vm.createContext({Request,Response,URL,JSON,Promise,Number,console:{info(){},warn(){}},createClient:()=>admin,
  Deno:{env:{get:k=>({VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private'})[k]||'server'},serve:f=>handler=f},
  EdgeRuntime:{waitUntil:p=>calls.background.push(p)},setTimeout(resolve,delay){calls.delay=delay;resolveDelay=resolve},
  webpush:{setVapidDetails(){},async sendNotification(target,payload){calls.sent.push({target,payload:JSON.parse(payload)});if(sendError)throw sendError}}
 });vm.runInContext(source,c);
 return {calls,request:(body,authenticated=true)=>handler(new Request('https://test',{method:'POST',headers:authenticated?{Authorization:'Bearer valid'}:{},body:JSON.stringify(body)})),async deliver(){resolveDelay();await Promise.all(calls.background)}};
}
test('public configuration returns only public values and never schedules a notification',async()=>{
 const s=setup();const response=await s.request({acao:'config'},false);assert.equal(response.status,200);assert.deepEqual(await response.json(),{chave_publica:'public',atraso_segundos:10});assert.equal(s.calls.background.length,0);
});
test('unauthenticated or expired sessions cannot send',async()=>{
 for(const valid of [true,false]){const s=setup({user:false});const response=await s.request({acao:'teste',endpoint:'x'},valid);assert.equal(response.status,401);assert.equal(s.calls.background.length,0)}
});
test('only an existing device belonging to the authenticated profile can be targeted',async()=>{
 const s=setup({sub:false});const response=await s.request({acao:'teste',endpoint:'someone-else',utilizador_id:'someone-else'});assert.equal(response.status,409);assert.equal(s.calls.background.length,0);assert.deepEqual(s.calls.queries[1].filters,[['utilizador_id','me'],['endpoint','someone-else']]);
});
test('the server delays delivery, targets the saved device and ignores supplied recipients and content',async()=>{
 const s=setup();const response=await s.request({acao:'teste',endpoint:'https://web.push.apple.com/device',utilizador_id:'other',titulo:'injected',corpo:'injected'});assert.equal(response.status,202);assert.equal(s.calls.delay,10000);assert.equal(s.calls.sent.length,0);await s.deliver();assert.equal(s.calls.sent.length,1);assert.equal(s.calls.sent[0].target.endpoint,'https://web.push.apple.com/device');assert.match(s.calls.sent[0].payload.titulo,/teste/);assert.doesNotMatch(JSON.stringify(s.calls.sent),/injected/);
});
test('expired endpoints are removed only for the authenticated user',async()=>{
 const s=setup({sendError:{statusCode:410}});await s.request({acao:'teste',endpoint:'https://web.push.apple.com/device'});await s.deliver();assert.deepEqual(s.calls.deleted,[{table:'push_subscriptions',filters:[['id','device-me'],['utilizador_id','me']]}]);
});
test('arbitrary and insecure stored endpoints cannot become server requests',async()=>{
 for(const endpoint of ['https://localhost/x','http://web.push.apple.com/x','https://web.push.apple.com.evil.example/x','https://user:secret@web.push.apple.com/x','https://web.push.apple.com:8443/x']){
  const s=setup({endpoint});const r=await s.request({acao:'teste',endpoint});assert.equal(r.status,400);assert.equal(s.calls.background.length,0);
 }
});
