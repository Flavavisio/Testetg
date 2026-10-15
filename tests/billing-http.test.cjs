const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const env={TG_BILLING_SANDBOX_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_example',STRIPE_WEBHOOK_SECRET:'whsec_example',
 TG_BILLING_RETURN_URL:'https://www.totalgest.pt/login.html',TG_BILLING_ALLOWED_ORIGINS:'https://www.totalgest.pt',
 SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only'};
const nativeFetch=global.fetch;let checkout,webhook,requests=[];
const order={id:'11111111-1111-4111-8111-111111111111',admin_id:'a',pack:'expert',tier:10,period:'mensal',amount:5749,currency:'eur',method:'card',session_id:'cs_test_1',customer_id:'cus_test_1'};
const session={id:order.session_id,livemode:false,mode:'payment',status:'complete',payment_status:'paid',amount_total:5749,currency:'eur',customer:order.customer_id,client_reference_id:order.id,metadata:{tg_order_id:order.id},url:'https://checkout.stripe.com/c/pay/cs_test_1'};
before(async()=>{
 global.Deno={env:{get:key=>env[key]},serve:fn=>checkout=fn};
 await import('../supabase/functions/billing-checkout/index.ts');
 global.Deno.serve=fn=>webhook=fn;await import('../supabase/functions/billing-webhook/index.ts');
});
beforeEach(()=>{
 env.TG_BILLING_SANDBOX_ENABLED='true';env.STRIPE_SECRET_KEY='sk_test_example';requests=[];
 global.fetch=async(url,opts={})=>{
  requests.push({url:String(url),opts});
  if(String(url).endsWith('/auth/v1/user')){
   if(opts.headers.Authorization!=='Bearer user-token')return Response.json({error:'bad token'},{status:401});
   return Response.json({id:'22222222-2222-4222-8222-222222222222'});
  }
  if(String(url).endsWith('/rpc/tg_billing_reserve'))return Response.json(order);
  if(String(url).endsWith('/rpc/tg_billing_bind'))return Response.json(null);
  if(String(url).endsWith('/rpc/tg_billing_list'))return Response.json([order]);
  if(String(url).includes('/rest/v1/tg_billing_orders?'))return Response.json([order]);
  if(String(url).endsWith('/rpc/tg_billing_event'))return Response.json({state:'paid'});
  if(String(url).includes('api.stripe.com/v1/checkout/sessions'))return Response.json(session);
  throw new Error('Unexpected request: '+url);
 };
});
after(()=>{global.fetch=nativeFetch;delete global.Deno;});
function req(body,headers={}){return new Request('https://example.supabase.co/functions/v1/billing-checkout',{method:'POST',headers:{Origin:'https://www.totalgest.pt',Authorization:'Bearer user-token','Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
async function signed(event){
 const body=JSON.stringify(event),ts=Math.floor(Date.now()/1000);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${body}`))).toString('hex');
 return new Request('https://example.supabase.co/functions/v1/billing-webhook',{method:'POST',headers:{'Stripe-Signature':`t=${ts},v1=${sig}`},body});
}
test('disabled and live-key configuration cannot reach Stripe or database',async()=>{
 env.TG_BILLING_SANDBOX_ENABLED='false';assert.equal((await checkout(req({action:'list'}))).status,400);assert.equal(requests.length,0);
 env.TG_BILLING_SANDBOX_ENABLED='true';env.STRIPE_SECRET_KEY='sk_live_forbidden';
 assert.equal((await checkout(req({action:'list'}))).status,400);assert.equal(requests.length,0);
});
test('CORS and missing/invalid auth are denied before any charge',async()=>{
 assert.equal((await checkout(req({action:'list'},{Origin:'https://evil.example'}))).status,403);assert.equal(requests.length,0);
 assert.equal((await checkout(req({action:'list'},{Authorization:''}))).status,400);
 assert.equal((await checkout(req({action:'list'},{Authorization:'Bearer forged'}))).status,400);
 assert.equal(requests.filter(r=>r.url.includes('stripe.com')).length,0);
});
test('server ignores browser amount, admin_id and paid status; checkout uses authenticated actor',async()=>{
 const response=await checkout(req({action:'checkout',pack:'expert',tier:10,period:'mensal',method:'card',amount:1,admin_id:'victim',paid:true}));
 assert.equal(response.status,200);assert.equal((await response.json()).test_mode,true);
 const reserve=JSON.parse(requests.find(r=>r.url.endsWith('tg_billing_reserve')).opts.body);
 assert.equal(reserve.p_actor,'22222222-2222-4222-8222-222222222222');assert.equal(reserve.p_amount,undefined);assert.equal(reserve.admin_id,undefined);
 const pay=requests.find(r=>r.url.includes('api.stripe.com')).opts;
 assert.equal(pay.body.get('line_items[0][price_data][unit_amount]'),'5749');
 assert.match(pay.headers['Idempotency-Key'],/^tg-test-checkout:/);
 assert.equal(requests.at(-1).url.endsWith('tg_billing_bind'),true);
});
test('add-on requests are rejected before reserve and Stripe',async()=>{
 const r=await checkout(req({action:'checkout',pack:'crm',tier:10,period:'mensal',method:'card'}));
 assert.equal(r.status,400);assert.equal(requests.some(r=>r.url.endsWith('tg_billing_reserve')),false);
});
test('unverified webhook cannot call the database',async()=>{
 const r=await webhook(new Request('https://example.supabase.co',{method:'POST',body:'{"livemode":false}'}));
 assert.equal(r.status,400);assert.equal(requests.length,0);
});
test('signed live event is refused; signed paid event uses canonical Stripe state',async()=>{
 let event={id:'evt_example',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_test_1'}}};
 assert.equal((await webhook(await signed(event))).status,400);assert.equal(requests.length,0);
 event.livemode=false;assert.equal((await webhook(await signed(event))).status,200);
 const applied=JSON.parse(requests.find(r=>r.url.endsWith('tg_billing_event')).opts.body);
 assert.equal(applied.p_state,'paid');assert.equal(applied.p_amount,5749);assert.equal(applied.p_order,order.id);
});
test('webhook arriving before checkout binding is retryable, never acknowledged as fulfilled',async()=>{
 const stub=global.fetch;global.fetch=async(url,opts)=>String(url).includes('/rest/v1/tg_billing_orders?')?Response.json([{...order,session_id:null}]):stub(url,opts);
 const event={id:'evt_race',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_1'}}};
 assert.equal((await webhook(await signed(event))).status,503);
 assert.equal(requests.some(r=>r.url.endsWith('tg_billing_event')),false);
});
