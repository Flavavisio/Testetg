export async function db(env,path,{method='GET',body,token}={}) {
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  const response=await fetch(`${env('SUPABASE_URL')}${path}`,{method,headers:{
    apikey:key,Authorization:`Bearer ${token||key}`,'Content-Type':'application/json',Prefer:'return=representation',
  },body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const value=await response.json().catch(()=>null);
  if(!response.ok)throw new Error('Não foi possível concluir a operação na base de dados.');
  return value;
}
export const rpc=(env,name,body)=>db(env,`/rest/v1/rpc/${name}`,{method:'POST',body});
export async function actor(env,req) {
  const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)throw new Error('Sessão inválida.');
  const user=await db(env,'/auth/v1/user',{token});
  if(!user?.id)throw new Error('Sessão inválida.');
  return user.id;
}
export async function stripe(env,path,params,idempotencyKey) {
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{
    method:params?'POST':'GET',headers:{Authorization:`Bearer ${env('STRIPE_SECRET_KEY')}`,
      'Stripe-Version':'2025-02-24.acacia',...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{}),
      ...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},
    body:params,signal:AbortSignal.timeout(20000),
  });
  const value=await response.json();
  if(!response.ok)throw new Error('O prestador de pagamentos não concluiu o pedido. Tente novamente.');
  return value;
}
