-- Temporary fixtures only. No customer or service records are modified.
begin;
create temporary table tg_assist_conclusion_check (like public.assistencias including defaults including constraints) on commit drop;
create trigger tg_assist_conclusion_check before insert or update of teste_tg_visita_concluida_em,os_gerada_id on tg_assist_conclusion_check
 for each row execute function public.teste_tg_assist_conclusao_contexto();
do $$
declare s public.servicos%rowtype; stamp timestamptz; yr integer:=extract(year from now() at time zone 'Europe/Lisbon')::integer;
begin
 insert into tg_assist_conclusion_check(id,admin_id,assunto,teste_tg_contrato_id,teste_tg_visita_ano,os_gerada_id,teste_tg_visita_concluida_em)
 values('synthetic-pending','synthetic-tenant','Verification','synthetic-contract',yr,'synthetic-pending-os','2000-01-01');
 if (select teste_tg_visita_concluida_em from tg_assist_conclusion_check where id='synthetic-pending') is not null then raise exception 'Pending OS consumed a visit';end if;
 select o.* into s from public.servicos o join public.contratos c on c.id=o.contrato_id and c.admin_id=o.admin_id and c.cliente_id=o.cliente_id
 where o.status in ('concluído','concluido') limit 1;
 if not found then raise exception 'No concluded read-only OS fixture';end if;
 insert into tg_assist_conclusion_check(id,admin_id,assunto,cliente_id,local_id,teste_tg_contrato_id,teste_tg_visita_ano,os_gerada_id,teste_tg_visita_concluida_em)
 values('synthetic-completed',s.admin_id,'Verification',s.cliente_id,s.local_id,s.contrato_id,yr,s.id,'2000-01-01');
 select teste_tg_visita_concluida_em into stamp from tg_assist_conclusion_check where id='synthetic-completed';
 if stamp is null or stamp<'2020-01-01' then raise exception 'Missing server completion timestamp';end if;
 update tg_assist_conclusion_check set teste_tg_visita_concluida_em=null where id='synthetic-completed';
 if (select teste_tg_visita_concluida_em from tg_assist_conclusion_check where id='synthetic-completed') is distinct from stamp then raise exception 'Retry changed completion timestamp';end if;
 update tg_assist_conclusion_check set teste_tg_visita_concluida_em='2000-01-01',assunto='Edit' where id='synthetic-completed';
 if (select teste_tg_visita_concluida_em from tg_assist_conclusion_check where id='synthetic-completed') is distinct from stamp then raise exception 'Edit changed completion year';end if;
 update tg_assist_conclusion_check set local_id='synthetic-wrong-site',teste_tg_visita_concluida_em='2000-01-01' where id='synthetic-completed';
 if (select teste_tg_visita_concluida_em from tg_assist_conclusion_check where id='synthetic-completed') is not null then raise exception 'Foreign site consumed a visit';end if;
end $$;
select 'PASS: pending/no OS does not debit; concluded matching OS gets one server timestamp; edits and retries preserve it; mismatched site cannot debit' as verification;
rollback;
