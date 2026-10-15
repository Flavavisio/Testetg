// Phase 1: sandbox only. No live keys, real licence mutations or recurring debits.
export const PACKS = Object.freeze({
  express: {5:4249,10:4749,25:6249,50:10249},
  expert: {5:5249,10:5749,25:7249,50:11249},
  pro: {5:7249,10:7749,25:9249,50:13249},
  supreme: {5:10249,10:10749,25:12249,50:16249},
});
export const METHODS = ['card','sepa_debit','multibanco','bank_transfer'];
export function quote(input) {
  const {pack,tier,period} = input;
  if (!Object.hasOwn(PACKS,pack) || !Number.isInteger(tier) || !Object.hasOwn(PACKS[pack],tier)
      || !['mensal','anual'].includes(period)) throw new Error('Pack, escalão ou período inválido.');
  const monthly=PACKS[pack][tier];
  return {pack,tier,period,amount:period==='anual'?Math.round(monthly*12*0.9):monthly,currency:'eur'};
}
export function sandbox(env) {
  if (env('TG_BILLING_SANDBOX_ENABLED')!=='true') throw new Error('Pagamentos de teste desativados.');
  if (!env('STRIPE_SECRET_KEY')?.startsWith('sk_test_')) throw new Error('Esta versão aceita apenas chaves Stripe de teste.');
  const base=new URL(env('TG_BILLING_RETURN_URL')||'');
  if (base.protocol!=='https:' || base.username || base.password || base.search || base.hash) throw new Error('URL de retorno inválido.');
  return base.href;
}
export function checkoutParams(order,customer,returnUrl) {
  if (!METHODS.includes(order.method)) throw new Error('Método inválido.');
  const q=quote(order);
  if(q.amount!==order.amount || order.currency!=='eur') throw new Error('Preço não corresponde ao catálogo.');
  const ok=new URL(returnUrl), cancel=new URL(returnUrl);
  ok.searchParams.set('billing_order',order.id);cancel.searchParams.set('billing_order',order.id);
  cancel.searchParams.set('billing_return','cancel');
  const p=new URLSearchParams({mode:'payment',customer,
    success_url:ok.href,cancel_url:cancel.href,
    client_reference_id:order.id,'metadata[tg_order_id]':order.id,
    'payment_intent_data[metadata][tg_order_id]':order.id,
    'line_items[0][price_data][currency]':'eur',
    'line_items[0][price_data][unit_amount]':String(order.amount),
    'line_items[0][price_data][product_data][name]':`TESTE TotalGest ${q.pack} · ${q.tier} funcionários · ${q.period}`,
    'line_items[0][quantity]':'1',
    'payment_method_types[0]':order.method==='bank_transfer'?'customer_balance':order.method,
  });
  if(order.method==='bank_transfer') {
    p.set('payment_method_options[customer_balance][funding_type]','bank_transfer');
    p.set('payment_method_options[customer_balance][bank_transfer][type]','eu_bank_transfer');
    p.set('payment_method_options[customer_balance][bank_transfer][eu_bank_transfer][country]','FR');
  }
  return p;
}
// Verify the exact raw payload, including timestamp tolerance and rotating signatures.
export async function verifySignature(raw,header,secret,now=Math.floor(Date.now()/1000)) {
  if(!secret?.startsWith('whsec_') || !header) throw new Error('Assinatura em falta.');
  const fields=header.split(',').map(s=>s.trim().split('='));
  const ts=fields.filter(([k])=>k==='t');
  if(ts.length!==1 || !/^\d+$/.test(ts[0][1]) || Math.abs(now-Number(ts[0][1]))>300) throw new Error('Assinatura expirada.');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const msg=new TextEncoder().encode(`${ts[0][1]}.${raw}`);
  for(const [name,hex] of fields) {
    if(name!=='v1'||!/^[a-f0-9]{64}$/i.test(hex))continue;
    const bytes=Uint8Array.from(hex.match(/../g),h=>parseInt(h,16));
    if(await crypto.subtle.verify('HMAC',key,bytes,msg))return;
  }
  throw new Error('Assinatura inválida.');
}
export function sessionTransition(event,session,order) {
  if(event.livemode!==false || session.livemode!==false)throw new Error('Evento real recusado.');
  if(session.id!==order.session_id || session.metadata?.tg_order_id!==order.id || session.client_reference_id!==order.id
    || session.amount_total!==order.amount || session.currency!==order.currency || session.customer!==order.customer_id
    || session.mode!=='payment')throw new Error('Pagamento não corresponde ao pedido.');
  // A return redirect, completed checkout or SEPA mandate is never proof of payment.
  if(session.payment_status==='paid')return 'paid';
  if(event.type==='checkout.session.async_payment_failed')return 'failed';
  if(session.status==='expired')return 'expired';
  return session.status==='complete'?'processing':'pending';
}
