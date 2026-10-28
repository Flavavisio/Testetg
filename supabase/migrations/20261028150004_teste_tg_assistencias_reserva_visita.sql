-- Teste TG only: one reservation is stored on the assistance row itself.
-- No historical rows, production visit records, policies or contract balances are rewritten.
alter table public.assistencias
 add column if not exists teste_tg_contrato_id text,
 add column if not exists teste_tg_visita_ano integer;
alter table public.assistencias add constraint teste_tg_assist_visita_par
 check ((teste_tg_contrato_id is null and teste_tg_visita_ano is null)
 or (teste_tg_contrato_id is not null and teste_tg_visita_ano is not null and teste_tg_visita_ano between 2000 and 2200));
comment on column public.assistencias.teste_tg_contrato_id is 'Teste TG only: contract holding one annual visit for this assistance.';
comment on column public.assistencias.teste_tg_visita_ano is 'Teste TG only: allocation year; a linked completed OS replaces this reservation.';
create or replace function public.teste_tg_validar_assist_visita()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare c public.contratos%rowtype; today date := (now() at time zone 'Europe/Lisbon')::date;
begin
 if tg_op='UPDATE' then
  if row(new.teste_tg_contrato_id,new.teste_tg_visita_ano,new.cliente_id,new.local_id)
    is not distinct from row(old.teste_tg_contrato_id,old.teste_tg_visita_ano,old.cliente_id,old.local_id) then return new; end if;
  if new.teste_tg_contrato_id is null and old.teste_tg_contrato_id is null then return new; end if;
 elsif new.teste_tg_contrato_id is null then return new;
 end if;
 if auth.uid() is null or not exists(select 1 from public.perfis p where p.id=auth.uid()
  and p.papel in ('admin','subadmin') and new.admin_id=case when p.papel='admin' then p.registo_id else p.admin_id end)
 then raise exception 'Sem acesso à reserva de visitas desta empresa.' using errcode='42501'; end if;
 if new.teste_tg_contrato_id is null then new.teste_tg_visita_ano:=null;return new;end if;
 select * into c from public.contratos where id=new.teste_tg_contrato_id and admin_id=new.admin_id and cliente_id=new.cliente_id;
 if not found or not (coalesce(new.local_id,'')=any(case when cardinality(c.locais_ids)>0 then c.locais_ids else array[coalesce(c.local_id,'')] end))
 then raise exception 'O contrato não pertence à instalação e ao cliente desta assistência.' using errcode='23514'; end if;
 if new.local_id is not null and not exists(select 1 from public.locais l where l.id=new.local_id and l.admin_id=new.admin_id and l.cliente_id=new.cliente_id)
 then raise exception 'Instalação inválida.' using errcode='23514'; end if;
 if (c.data_inicio is not null and c.data_inicio>today) or (c.validade_contrato is not null and c.validade_contrato<today)
 then raise exception 'Este contrato não está ativo. Revê o contrato antes de reservar uma visita.' using errcode='23514'; end if;
 if new.teste_tg_visita_ano is distinct from extract(year from today)::integer
 then raise exception 'A visita deve ser reservada no ano atual.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.teste_tg_validar_assist_visita() from public,anon,authenticated;
create trigger teste_tg_validar_assist_visita
 before insert or update of teste_tg_contrato_id,teste_tg_visita_ano on public.assistencias
 for each row execute function public.teste_tg_validar_assist_visita();
