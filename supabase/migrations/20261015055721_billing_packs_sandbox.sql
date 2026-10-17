-- Sandbox only. Additive schema: does NOT change existing licences, packs or add-ons.
-- Apply first to a disposable/local database. Production adapter is deliberately absent.
begin;
create table public.tg_billing_orders (
 id uuid primary key default gen_random_uuid(),
 admin_id text not null references public.administradores(id),
 actor_id uuid not null,
 pack text not null check(pack in ('express','expert','pro','supreme')),
 tier integer not null check(tier in (5,10,25,50)),
 period text not null check(period in ('mensal','anual')),
 amount integer not null check(amount>0),
 currency text not null default 'eur' check(currency='eur'),
 method text not null check(method in ('card','sepa_debit','multibanco','bank_transfer')),
 state text not null default 'pending' check(state in ('pending','processing','paid','failed','expired')),
 test_mode boolean not null default true check(test_mode),
 session_id text unique, customer_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), paid_at timestamptz
);
create index on public.tg_billing_orders(admin_id,created_at desc);
create unique index tg_billing_one_open on public.tg_billing_orders(admin_id)
 where state in ('pending','processing');

create table public.tg_billing_events (
 event_id text primary key,
 order_id uuid not null references public.tg_billing_orders(id),
 state text not null,
 created_at timestamptz not null default now()
);
create index on public.tg_billing_events(order_id);
create table public.tg_billing_activation_queue (
 order_id uuid primary key references public.tg_billing_orders(id),
 admin_id text not null,
 kind text not null default 'simulate_pack_activation' check(kind='simulate_pack_activation'),
 pack text not null check(pack in ('express','expert','pro','supreme')),
 tier integer not null, period text not null,
 state text not null default 'awaiting_sandbox_review',
 created_at timestamptz not null default now()
);
create table public.tg_billing_outbox (
 order_id uuid primary key references public.tg_billing_orders(id),
 kind text not null default 'sandbox_payment_confirmed',
 state text not null default 'pending',
 created_at timestamptz not null default now()
);

-- No direct browser access, including existing broadly permissive legacy policies.
alter table public.tg_billing_orders enable row level security;
alter table public.tg_billing_events enable row level security;
alter table public.tg_billing_activation_queue enable row level security;
alter table public.tg_billing_outbox enable row level security;
revoke all on public.tg_billing_orders,public.tg_billing_events,public.tg_billing_activation_queue,public.tg_billing_outbox from public,anon,authenticated;
grant select,insert,update on public.tg_billing_orders,public.tg_billing_events,public.tg_billing_activation_queue,public.tg_billing_outbox to service_role;

-- Service-only RPCs are SECURITY INVOKER. Identity is validated by Auth in the Edge
-- Function, then cross-checked against the authoritative perfis table here.
create function public.tg_billing_list(p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.perfis%rowtype; result jsonb;
begin
 select * into p from public.perfis where id=p_actor;
 if not found or p.papel not in ('admin','superadmin') then raise exception 'Apenas administradores podem gerir pagamentos'; end if;
 select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc),'[]'::jsonb) into result
 from (select * from public.tg_billing_orders
 where p.papel='superadmin' or admin_id=p.registo_id order by created_at desc limit 100) o;
 return result;
end $$;

create function public.tg_billing_reserve(p_actor uuid,p_pack text,p_tier integer,p_period text,p_method text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.perfis%rowtype; o public.tg_billing_orders%rowtype;
 prices jsonb := '{"express":{"5":4249,"10":4749,"25":6249,"50":10249},"expert":{"5":5249,"10":5749,"25":7249,"50":11249},"pro":{"5":7249,"10":7749,"25":9249,"50":13249},"supreme":{"5":10249,"10":10749,"25":12249,"50":16249}}';
 total integer;
begin
 select * into p from public.perfis where id=p_actor;
 if not found or p.papel is distinct from 'admin' then raise exception 'Apenas o administrador da empresa pode pagar'; end if;
 if p_pack is null or p_tier is null or p_period is null or p_method is null
 or p_period not in ('mensal','anual') or p_method not in ('card','sepa_debit','multibanco','bank_transfer') then raise exception 'Pedido inválido'; end if;
 total := (prices->p_pack->>p_tier::text)::integer;
 if total is null then raise exception 'Pack ou escalão inválido'; end if;
 if p_period='anual' then total:=round(total*12*0.9); end if;
 perform pg_advisory_xact_lock(hashtextextended('tg-billing:'||p.registo_id,0));
 select * into o from public.tg_billing_orders where admin_id=p.registo_id and state in ('pending','processing') for update;
 if found then
  if o.pack<>p_pack or o.tier<>p_tier or o.period<>p_period or o.method<>p_method then
   raise exception 'Existe um pagamento pendente. Conclua-o ou aguarde a expiração antes de criar outro';
  end if;
  return to_jsonb(o);
 end if;
 if (select count(*) from public.tg_billing_orders where admin_id=p.registo_id and created_at>now()-interval '1 hour')>=5 then raise exception 'Demasiadas tentativas. Tente mais tarde'; end if;
 insert into public.tg_billing_orders(admin_id,actor_id,pack,tier,period,method,amount)
 values(p.registo_id,p_actor,p_pack,p_tier,p_period,p_method,total) returning * into o;
 return to_jsonb(o);
end $$;

create function public.tg_billing_bind(p_order uuid,p_session text,p_customer text) returns void
language plpgsql security invoker set search_path='' as $$
declare o public.tg_billing_orders%rowtype;
begin
 select * into o from public.tg_billing_orders where id=p_order for update;
 if not found or p_session is null or p_customer is null
 or p_session !~ '^cs_test_[A-Za-z0-9_-]+$' or p_customer !~ '^cus_[A-Za-z0-9_-]+$' then raise exception 'Checkout inválido'; end if;
 if (o.session_id is not null and o.session_id<>p_session) or (o.customer_id is not null and o.customer_id<>p_customer) then raise exception 'Checkout já atribuído'; end if;
 update public.tg_billing_orders set session_id=p_session,customer_id=p_customer,updated_at=now() where id=p_order;
end $$;

create function public.tg_billing_event(p_event text,p_order uuid,p_state text,p_session text,p_amount integer,p_currency text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.tg_billing_orders%rowtype;
begin
 if p_event is null or p_event not like 'evt_%' or p_state is null or p_state not in ('pending','processing','paid','failed','expired') then raise exception 'Evento inválido'; end if;
 select * into o from public.tg_billing_orders where id=p_order for update;
 if not found or o.session_id is null or o.session_id is distinct from p_session
 or o.amount is distinct from p_amount or o.currency is distinct from p_currency then raise exception 'Pagamento não corresponde ao pedido'; end if;
 if exists(select 1 from public.tg_billing_events where event_id=p_event) then
  if not exists(select 1 from public.tg_billing_events where event_id=p_event and order_id=p_order) then raise exception 'Evento atribuído a outro pedido'; end if;
  return jsonb_build_object('duplicate',true,'state',o.state);
 end if;
 insert into public.tg_billing_events(event_id,order_id,state) values(p_event,p_order,p_state);
 -- Never regress a confirmed payment or processing payment due to a delayed pending event.
 if o.state='paid' or (o.state='processing' and p_state='pending')
 or (o.state in ('failed','expired') and p_state in ('pending','processing')) then
  return jsonb_build_object('state',o.state);
 end if;
 update public.tg_billing_orders set state=p_state,updated_at=now(),
 paid_at=case when p_state='paid' then coalesce(paid_at,now()) else paid_at end where id=p_order;
 if p_state='paid' then
  insert into public.tg_billing_activation_queue(order_id,admin_id,pack,tier,period)
   values(o.id,o.admin_id,o.pack,o.tier,o.period) on conflict do nothing;
  insert into public.tg_billing_outbox(order_id) values(o.id) on conflict do nothing;
 end if;
 return jsonb_build_object('state',p_state);
end $$;

revoke all on function public.tg_billing_list(uuid),public.tg_billing_reserve(uuid,text,integer,text,text),public.tg_billing_bind(uuid,text,text),public.tg_billing_event(text,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.tg_billing_list(uuid),public.tg_billing_reserve(uuid,text,integer,text,text),public.tg_billing_bind(uuid,text,text),public.tg_billing_event(text,uuid,text,text,integer,text) to service_role;
commit;
