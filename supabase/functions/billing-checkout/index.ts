import {quote,sandbox,checkoutParams,METHODS} from '../_shared/billing.mjs';
import {actor,rpc,stripe} from '../_shared/billing-runtime.mjs';

const env=(key:string)=>Deno.env.get(key);
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('Origin')||'';
  const allowed=(env('TG_BILLING_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
  const cors={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'};
  const json=(value:unknown,status=200)=>Response.json(value,{status,headers:cors});
  if(origin&&!allowed.includes(origin))return json({error:'Origem não autorizada.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'Método inválido.'},405);
  try {
    const returnUrl=sandbox(env);
    const userId=await actor(env,req);
    const body=await req.json();
    if(body.action==='list')return json(await rpc(env,'tg_billing_list',{p_actor:userId}));
    if(body.action!=='checkout'||!METHODS.includes(body.method))return json({error:'Pedido inválido.'},400);
    const q=quote(body);
    // SQL validates the authenticated actor again and computes its own trusted price.
    const order=await rpc(env,'tg_billing_reserve',{p_actor:userId,p_pack:q.pack,p_tier:q.tier,p_period:q.period,p_method:body.method});
    let customer=order.customer_id;
    if(!customer) {
      const created=await stripe(env,'customers',new URLSearchParams({'metadata[tg_admin_id]':order.admin_id}),`tg-test-customer:${order.id}`);
      customer=created.id;
    }
    const session=await stripe(env,'checkout/sessions',checkoutParams(order,customer,returnUrl),`tg-test-checkout:${order.id}`);
    if(session.livemode!==false||!session.url?.startsWith('https://checkout.stripe.com/'))throw new Error('Checkout inválido.');
    // Bind before handing the URL to the browser; webhook can retry if it raced this write.
    await rpc(env,'tg_billing_bind',{p_order:order.id,p_session:session.id,p_customer:customer});
    return json({order_id:order.id,url:session.url,test_mode:true});
  } catch(error) {
    // No keys, IBANs, raw provider bodies or customer details in logs/responses.
    console.error('billing-checkout: operação recusada ou indisponível');
    return json({error:error instanceof Error?error.message:'Não foi possível iniciar o pagamento.'},400);
  }
});
