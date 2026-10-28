-- Teste TG only: the association created with an assistance is not a debit.
-- A server timestamp records the first actual conclusion of its linked OS.
alter table public.assistencias add column if not exists teste_tg_visita_concluida_em timestamptz;
comment on column public.assistencias.teste_tg_contrato_id is 'Teste TG only: associated contract; consumes a visit only after the linked OS is concluded.';
comment on column public.assistencias.teste_tg_visita_ano is 'Teste TG legacy association year. Does not reserve or consume allowance.';
comment on column public.assistencias.teste_tg_visita_concluida_em is 'Teste TG only: first server-confirmed OS conclusion, preserved on retries and edits.';
create or replace function public.teste_tg_assist_conclusao_contexto()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.teste_tg_contrato_id is null then new.teste_tg_visita_concluida_em:=null;return new;end if;
 if tg_op='UPDATE' then
  if old.teste_tg_visita_concluida_em is not null and row(new.admin_id,new.cliente_id,new.local_id,new.teste_tg_contrato_id,new.os_gerada_id)
   is not distinct from row(old.admin_id,old.cliente_id,old.local_id,old.teste_tg_contrato_id,old.os_gerada_id)
  then new.teste_tg_visita_concluida_em:=old.teste_tg_visita_concluida_em;return new;end if;
 end if;
 if exists(select 1 from public.servicos s where s.id=new.os_gerada_id and s.admin_id=new.admin_id and s.cliente_id=new.cliente_id
  and coalesce(s.local_id,'')=coalesce(new.local_id,'') and s.contrato_id=new.teste_tg_contrato_id and s.status in ('concluído','concluido'))
 then new.teste_tg_visita_concluida_em:=now();
 else new.teste_tg_visita_concluida_em:=null;end if;
 return new;
end $$;
revoke all on function public.teste_tg_assist_conclusao_contexto() from public,anon,authenticated;
-- Runs after the existing association validation/preservation trigger.
create trigger zz_teste_tg_assist_conclusao_contexto
 before insert or update of teste_tg_visita_concluida_em,teste_tg_contrato_id,teste_tg_visita_ano,os_gerada_id on public.assistencias
 for each row execute function public.teste_tg_assist_conclusao_contexto();
create or replace function public.teste_tg_os_concluir_visita()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status in ('concluído','concluido') and old.status is distinct from new.status then
  update public.assistencias a set teste_tg_visita_concluida_em=now()
  where a.admin_id=new.admin_id and a.cliente_id=new.cliente_id and a.os_gerada_id=new.id
   and a.teste_tg_contrato_id=new.contrato_id and coalesce(a.local_id,'')=coalesce(new.local_id,'')
   and a.teste_tg_visita_concluida_em is null;
 end if;
 return new;
end $$;
revoke all on function public.teste_tg_os_concluir_visita() from public,anon,authenticated;
create trigger teste_tg_os_concluir_visita after update of status on public.servicos
 for each row when(new.status in ('concluído','concluido')) execute function public.teste_tg_os_concluir_visita();
