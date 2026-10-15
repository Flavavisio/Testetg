const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,readdirSync}=require('node:fs');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
let db,billing,licenceBefore;
const uid='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const employee='33333333-3333-4333-8333-333333333333';
const superadmin='44444444-4444-4444-8444-444444444444';
before(async()=>{
 billing=await import('../supabase/functions/_shared/billing.mjs');
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table administradores(id text primary key);
 create table perfis(id uuid primary key,papel text,registo_id text,admin_id text);
 create table licencas(admin_id text,ativa boolean,data_expiracao timestamptz);
 insert into administradores values('empresa-a'),('empresa-b');
 insert into perfis values('${uid}','admin','empresa-a',null),('${other}','admin','empresa-b',null),('${employee}','funcionario','tecnico-a','empresa-a'),('${superadmin}','superadmin','superadmin',null);
 insert into licencas values('empresa-a',true,'2027-01-01');
 grant select on perfis,administradores to service_role;`);
 licenceBefore=(await db.query('select * from licencas')).rows[0];
 const folder=path.join(__dirname,'../supabase/migrations');
 const file=readdirSync(folder).find(f=>f.endsWith('_billing_packs_sandbox.sql'));
 await db.exec(readFileSync(path.join(folder,file),'utf8'));
});
beforeEach(async()=>{await db.exec('reset role;truncate tg_billing_orders cascade;');});
after(async()=>{await db?.close();});
async function reserve(user=uid,pack='expert',tier=10,period='mensal',method='card'){
 const r=await db.query('select tg_billing_reserve($1,$2,$3,$4,$5) as o',[user,pack,tier,period,method]);return r.rows[0].o;
}
async function bind(o){await db.query('select tg_billing_bind($1,$2,$3)',[o.id,'cs_test_'+o.id,'cus_test_a']);}
async function event(o,id='evt_1',state='paid',amount=o.amount,currency='eur'){
 return db.query('select tg_billing_event($1,$2,$3,$4,$5,$6) as result',[id,o.id,state,'cs_test_'+o.id,amount,currency]);
}
async function count(table){return (await db.query('select count(*)::integer as n from '+table)).rows[0].n;}
test('all 32 pack prices agree between JS and PostgreSQL; no add-ons',async()=>{
 for(const pack of Object.keys(billing.PACKS))for(const tier of [5,10,25,50])for(const period of ['mensal','anual']){
  await db.exec('truncate tg_billing_orders cascade');
  const o=await reserve(uid,pack,tier,period);
  assert.equal(o.amount,billing.quote({pack,tier,period}).amount);
 }
 for(const pack of ['frota','crm','toString','__proto__']){
  assert.throws(()=>billing.quote({pack,tier:5,period:'mensal'}));
  await assert.rejects(()=>reserve(uid,pack));
 }
});
test('invalid periods, tiers and payment methods are rejected',async()=>{
 await assert.rejects(()=>reserve(uid,'expert',100));
 await assert.rejects(()=>reserve(uid,'expert',10,'gratuito'));
 await assert.rejects(()=>reserve(uid,'expert',10,'mensal','cash'));
 assert.throws(()=>billing.quote({pack:'expert',tier:'10',period:'mensal'}));
});
test('employee, unknown identity and superadmin cannot buy as company admin',async()=>{
 for(const id of [employee,superadmin,'55555555-5555-4555-8555-555555555555'])await assert.rejects(()=>reserve(id));
 assert.equal(await count('tg_billing_orders'),0);
});
test('repeated checkout reserves same order; another choice is blocked while pending',async()=>{
 const a=await reserve(),b=await reserve();assert.equal(a.id,b.id);
 await assert.rejects(()=>reserve(uid,'pro'));
 await assert.rejects(()=>reserve(uid,'expert',10,'mensal','sepa_debit'));
 assert.equal(await count('tg_billing_orders'),1);
});
test('different tenants are isolated; superadmin can inspect both',async()=>{
 await reserve();await reserve(other);
 const list=async id=>(await db.query('select tg_billing_list($1) as list',[id])).rows[0].list;
 assert.equal((await list(uid)).length,1);assert.equal((await list(uid))[0].admin_id,'empresa-a');
 assert.equal((await list(other)).length,1);assert.equal((await list(superadmin)).length,2);
 await assert.rejects(()=>list(employee));
});
test('anon and authenticated cannot access billing tables or service RPCs',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(()=>db.query('select * from tg_billing_orders'));
  await assert.rejects(()=>reserve());
  await assert.rejects(()=>db.query('select tg_billing_bind(null,null,null)'));
  await db.exec('reset role');
 }
 await db.exec('set role service_role');const o=await reserve();await bind(o);await event(o);
 await db.exec('reset role');
});
test('checkout binding cannot be reassigned; live session is refused',async()=>{
 const o=await reserve();await bind(o);await bind(o);
 await assert.rejects(()=>db.query('select tg_billing_bind($1,$2,$3)',[o.id,'cs_test_other','cus_other']));
 const b=await reserve(other);
 await assert.rejects(()=>db.query('select tg_billing_bind($1,$2,$3)',[b.id,'cs_live_wrong','cus_other']));
});
test('processing does not activate; paid inserts one simulated activation and outbox',async()=>{
 const o=await reserve();await bind(o);await event(o,'evt_processing','processing');
 assert.equal(await count('tg_billing_activation_queue'),0);
 await event(o);await event(o);await event(o,'evt_another_paid');
 assert.equal(await count('tg_billing_activation_queue'),1);assert.equal(await count('tg_billing_outbox'),1);
 const licence=(await db.query('select * from licencas')).rows[0];
 assert.deepEqual(licence,licenceBefore);
});
test('wrong amount/currency/session fails without marking event as consumed',async()=>{
 const o=await reserve();await bind(o);
 await assert.rejects(()=>event(o,'evt_bad','paid',o.amount-1));
 await assert.rejects(()=>event(o,'evt_bad','paid',o.amount,'usd'));
 await assert.rejects(()=>db.query('select tg_billing_event($1,$2,$3,$4,$5,$6)',['evt_bad',o.id,'paid','cs_test_wrong',o.amount,'eur']));
 assert.equal(await count('tg_billing_events'),0);assert.equal(await count('tg_billing_outbox'),0);
});
test('late pending/failed events never revoke confirmed payment',async()=>{
 const o=await reserve();await bind(o);await event(o);
 await event(o,'evt_late_failed','failed');await event(o,'evt_late_pending','pending');
 assert.equal((await db.query('select state from tg_billing_orders')).rows[0].state,'paid');
 assert.equal(await count('tg_billing_activation_queue'),1);
});
test('failure during outbox transaction rolls back state and event; retry recovers',async()=>{
 const o=await reserve();await bind(o);
 await db.exec('alter table tg_billing_outbox rename to temporarily_unavailable');
 try{
  await assert.rejects(()=>event(o));
  assert.equal(await count('tg_billing_events'),0);assert.equal(await count('tg_billing_activation_queue'),0);
  assert.equal((await db.query('select state from tg_billing_orders')).rows[0].state,'pending');
 }finally{await db.exec('alter table temporarily_unavailable rename to tg_billing_outbox');}
 await event(o);assert.equal(await count('tg_billing_outbox'),1);
});
test('expired checkout can be replaced and cross-order event reuse is rejected',async()=>{
 const a=await reserve();await bind(a);await event(a,'evt_expire','expired');
 const b=await reserve();assert.notEqual(a.id,b.id);await bind(b);
 await assert.rejects(()=>event(b,'evt_expire'));
});
test('only test keys and explicit enablement are accepted',()=>{
 for(const key of ['sk_live_123','rk_live_123','',undefined])assert.throws(()=>billing.sandbox(k=>({TG_BILLING_SANDBOX_ENABLED:'true',STRIPE_SECRET_KEY:key,TG_BILLING_RETURN_URL:'https://www.totalgest.pt/login.html'})[k]));
 assert.throws(()=>billing.sandbox(()=>undefined));
 assert.equal(billing.sandbox(k=>({TG_BILLING_SANDBOX_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_123',TG_BILLING_RETURN_URL:'https://www.totalgest.pt/login.html'})[k]),'https://www.totalgest.pt/login.html');
});
test('all four checkout methods have server prices; no automatic recurring mandate',()=>{
 for(const method of billing.METHODS){
  const o={...billing.quote({pack:'supreme',tier:25,period:'anual'}),id:'order',method};
  const p=billing.checkoutParams(o,'cus_1','https://www.totalgest.pt/login.html');
  assert.equal(p.get('line_items[0][price_data][unit_amount]'),String(o.amount));
  assert.equal(p.get('mode'),'payment');assert.equal(p.get('payment_method_types[0]'),method==='bank_transfer'?'customer_balance':method);
  assert.throws(()=>billing.checkoutParams({...o,amount:1},'cus_1','https://www.totalgest.pt/login.html'));
 }
});
test('signed raw webhook: tampering, stale timestamp, missing signature rejected; rotation accepted',async()=>{
 const secret='whsec_test_secret',ts=1770000000,raw='{"id":"evt_valid"}';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${raw}`))).toString('hex');
 await billing.verifySignature(raw,`t=${ts},v1=${'0'.repeat(64)},v1=${sig}`,secret,ts);
 await assert.rejects(()=>billing.verifySignature(raw+' ',`t=${ts},v1=${sig}`,secret,ts));
 await assert.rejects(()=>billing.verifySignature(raw,`t=${ts},v1=${sig}`,secret,ts+301));
 await assert.rejects(()=>billing.verifySignature(raw,null,secret,ts));
});
test('checkout completion is insufficient; canonical paid state required and identity checked',()=>{
 const o={id:'order',session_id:'cs_test_1',customer_id:'cus_1',amount:5249,currency:'eur'};
 const session={id:o.session_id,customer:o.customer_id,client_reference_id:o.id,metadata:{tg_order_id:o.id},amount_total:o.amount,currency:'eur',mode:'payment',status:'complete',payment_status:'unpaid',livemode:false};
 const e={livemode:false,type:'checkout.session.completed'};
 assert.equal(billing.sessionTransition(e,session,o),'processing');
 assert.equal(billing.sessionTransition(e,{...session,payment_status:'paid'},o),'paid');
 for(const patch of [{livemode:true},{customer:'cus_other'},{amount_total:1},{currency:'usd'},{client_reference_id:'other'},{metadata:{tg_order_id:'other'}}])assert.throws(()=>billing.sessionTransition(e,{...session,...patch},o));
});
