import {sandbox,verifySignature,sessionTransition} from '../_shared/billing.mjs';
import {db,rpc,stripe} from '../_shared/billing-runtime.mjs';
const env=(key:string)=>Deno.env.get(key);
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  try {
    sandbox(env);
    const raw=await req.text();
    if(raw.length>1048576)return new Response('Payload too large',{status:413});
    await verifySignature(raw,req.headers.get('stripe-signature'),env('STRIPE_WEBHOOK_SECRET'));
    const event=JSON.parse(raw);
    if(event.livemode!==false||!/^evt_/.test(event.id))return new Response('Test events only',{status:400});
    const known=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'];
    if(!known.includes(event.type))return Response.json({ignored:true});
    // Re-fetch Stripe's current state: events may arrive duplicated or out of order.
    const session=await stripe(env,`checkout/sessions/${encodeURIComponent(event.data.object.id)}`);
    const id=session.metadata?.tg_order_id;
    if(!id)return Response.json({ignored:true});
    const rows=await db(env,`/rest/v1/tg_billing_orders?id=eq.${encodeURIComponent(id)}&select=*`);
    const order=rows?.[0];
    if(!order||!order.session_id)return new Response('Order not bound yet',{status:503});
    const state=sessionTransition(event,session,order);
    await rpc(env,'tg_billing_event',{p_event:event.id,p_order:order.id,p_state:state,
      p_session:session.id,p_amount:session.amount_total,p_currency:session.currency});
    return Response.json({received:true});
  } catch {
    // A non-2xx response allows Stripe to retry; SQL records event + outcome atomically.
    console.error('billing-webhook: confirmação recusada ou indisponível');
    return new Response('Confirmation could not be verified',{status:400});
  }
});
