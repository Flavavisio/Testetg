-- Teste TG only: preserve an existing reservation on ordinary same-site edits.
create or replace function public.teste_tg_validar_assist_visita()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare c public.contratos%rowtype; today date := (now() at time zone 'Europe/Lisbon')::date;
begin
 if tg_op='UPDATE' then
  -- Preserve the first reservation for this customer/site, including stale cached clients.
  -- Editing, saving or creating an OS is never a second annual debit.
  if old.teste_tg_contrato_id is not null and row(new.admin_id,new.cliente_id,new.local_id)
   is not distinct from row(old.admin_id,old.cliente_id,old.local_id) then
   if auth.uid() is null or not exists(select 1 from public.perfis p where p.id=auth.uid()
    and p.papel in ('admin','subadmin') and new.admin_id=case when p.papel='admin' then p.registo_id else p.admin_id end)
   then raise exception 'Sem acesso à reserva de visitas desta empresa.' using errcode='42501';end if;
   new.teste_tg_contrato_id:=old.teste_tg_contrato_id;
   new.teste_tg_visita_ano:=old.teste_tg_visita_ano;
   return new;
  end if;
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
