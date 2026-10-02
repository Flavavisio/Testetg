-- Total Gest: pedidos do portal em Assistências. Executar no SQL Editor.
-- Não converte nem elimina pedidos antigos guardados como OS.
begin;
create schema if not exists tg_private;
revoke all on schema tg_private from public, anon;
grant usage on schema tg_private to authenticated;
alter table public.assistencias add column if not exists local_id text;
alter table public.assistencias add column if not exists origem text;
alter table public.assistencias enable row level security;

-- Restritivas: protegem esta tabela mesmo se existir uma política antiga permissiva.
drop policy if exists tg_assist_read_guard on public.assistencias;
create policy tg_assist_read_guard on public.assistencias as restrictive for select to public
using (exists(select 1 from public.perfis p where p.id=auth.uid() and
 (p.papel='superadmin' or (assistencias.admin_id=case when p.papel='admin' then p.registo_id else p.admin_id end
 and (p.papel<>'cliente' or assistencias.cliente_id=p.registo_id)))));
drop policy if exists tg_assist_insert_guard on public.assistencias;
create policy tg_assist_insert_guard on public.assistencias as restrictive for insert to public
with check (exists(select 1 from public.perfis p where p.id=auth.uid() and p.papel<>'cliente' and
 (p.papel='superadmin' or assistencias.admin_id=case when p.papel='admin' then p.registo_id else p.admin_id end)));
drop policy if exists tg_assist_update_guard on public.assistencias;
create policy tg_assist_update_guard on public.assistencias as restrictive for update to public
using (exists(select 1 from public.perfis p where p.id=auth.uid() and p.papel<>'cliente' and
 (p.papel='superadmin' or assistencias.admin_id=case when p.papel='admin' then p.registo_id else p.admin_id end)))
with check (exists(select 1 from public.perfis p where p.id=auth.uid() and p.papel<>'cliente' and
 (p.papel='superadmin' or assistencias.admin_id=case when p.papel='admin' then p.registo_id else p.admin_id end)));
drop policy if exists tg_assist_delete_guard on public.assistencias;
create policy tg_assist_delete_guard on public.assistencias as restrictive for delete to public
using (exists(select 1 from public.perfis p where p.id=auth.uid() and p.papel<>'cliente' and
 (p.papel='superadmin' or assistencias.admin_id=case when p.papel='admin' then p.registo_id else p.admin_id end)));

-- Serializa a atribuição de números por empresa, incluindo entradas pelos admins.
create or replace function tg_private.assistencia_numero() returns trigger
language plpgsql security definer set search_path='' as $$
declare nome text; letras text; base text; seguinte bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('tg-assist:'||new.admin_id,0));
 if new.numero is null or btrim(new.numero)='' or exists(select 1 from public.assistencias a where a.admin_id=new.admin_id and a.numero=new.numero and a.id<>new.id) then
  select coalesce(nullif(a.empresa,''),a.nome,'') into nome from public.administradores a where a.id=new.admin_id;
  letras:=regexp_replace(translate(coalesce(nome,''),'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),'[^A-Za-z]','','g');
  base:='AST-'||case when letras='' then 'XX' else upper(left(letras,1)||right(letras,1)) end||to_char(now() at time zone 'Europe/Lisbon','MMYY');
  select coalesce(max(substring(a.numero from length(base)+2)::bigint),0)+1 into seguinte from public.assistencias a
   where a.admin_id=new.admin_id and left(a.numero,length(base)+1)=base||'-' and substring(a.numero from length(base)+2)~'^[0-9]+$';
  new.numero:=base||'-'||seguinte;
 end if;
 return new;
end $$;
revoke all on function tg_private.assistencia_numero() from public,anon,authenticated;
drop trigger if exists tg_assistencia_numero on public.assistencias;
create trigger tg_assistencia_numero before insert on public.assistencias for each row execute function tg_private.assistencia_numero();

create or replace function tg_private.portal_criar_assistencia(p_id text,p_local_id text,p_prioridade text,p_problema text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil public.perfis%rowtype; cli public.clientes%rowtype; adm public.administradores%rowtype;
 loc public.locais%rowtype; pedido public.assistencias%rowtype; local_nome text; morada text;
begin
 if auth.uid() is null then raise exception 'Sessão inválida'; end if;
 select * into perfil from public.perfis where id=auth.uid();
 if perfil.papel is distinct from 'cliente' then raise exception 'Acesso reservado ao portal do cliente'; end if;
 select * into cli from public.clientes where id=perfil.registo_id and admin_id=perfil.admin_id;
 if not found or cli.portal_ativo is not true then raise exception 'Portal inativo'; end if;
 select * into adm from public.administradores where id=cli.admin_id;
 if not coalesce((nullif(adm.assist_plano,'') is not null and adm.assist_expiracao>now()) or
 (nullif(adm.crm_plano,'') is not null and adm.crm_expiracao>now()),false) then raise exception 'Módulo de Assistências inativo'; end if;
 if p_id is null or p_id!~'^[a-zA-Z0-9_-]{8,100}$' then raise exception 'Identificador inválido'; end if;
 if p_prioridade is null or p_prioridade not in ('baixa','normal','alta','urgente') then raise exception 'Urgência inválida'; end if;
 if p_problema is null or length(btrim(p_problema)) not between 1 and 4000 then raise exception 'Descreva o problema (até 4000 caracteres)'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tg-assist:'||cli.admin_id,0));
 select * into pedido from public.assistencias where id=p_id;
 if found then
  if pedido.cliente_id<>cli.id or pedido.admin_id<>cli.admin_id or pedido.origem is distinct from 'portal' then raise exception 'Identificador indisponível'; end if;
  return to_jsonb(pedido)-'notas';
 end if;
 if nullif(p_local_id,'') is null then local_nome:='Sede'; morada:=concat_ws(', ',cli.morada,cli.numero_porta,cli.codigo_postal,cli.cidade);
 else
  select * into loc from public.locais where id=p_local_id and cliente_id=cli.id and admin_id=cli.admin_id;
  if not found then raise exception 'Local inválido'; end if;
  local_nome:=loc.nome; morada:=concat_ws(', ',loc.morada,loc.numero_porta,loc.codigo_postal,loc.cidade);
 end if;
 insert into public.assistencias(id,admin_id,cliente_id,local_id,origem,assunto,descricao,prioridade,estado,criado_por,data_criacao,data_modificacao)
 values(p_id,cli.admin_id,cli.id,nullif(p_local_id,''),'portal',left(btrim(p_problema),160),
 'Local: '||local_nome||E'\nMorada: '||coalesce(morada,'')||E'\nProblema: '||btrim(p_problema),p_prioridade,'aberta',cli.id,now(),now()) returning * into pedido;
 return to_jsonb(pedido)-'notas';
end $$;
revoke all on function tg_private.portal_criar_assistencia(text,text,text,text) from public,anon;
grant execute on function tg_private.portal_criar_assistencia(text,text,text,text) to authenticated;
create or replace function public.portal_criar_assistencia(p_id text,p_local_id text,p_prioridade text,p_problema text)
returns jsonb language sql security invoker set search_path='' as $$
 select tg_private.portal_criar_assistencia(p_id,p_local_id,p_prioridade,p_problema);
$$;
revoke all on function public.portal_criar_assistencia(text,text,text,text) from public,anon;
grant execute on function public.portal_criar_assistencia(text,text,text,text) to authenticated;
commit;
