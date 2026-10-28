-- Verification uses temporary rows only; no customer records are written.
begin;
create temporary table tg_assist_booking_check (like public.assistencias including defaults including constraints) on commit drop;
create trigger tg_assist_booking_check before insert or update of teste_tg_contrato_id,teste_tg_visita_ano on tg_assist_booking_check for each row execute function public.teste_tg_validar_assist_visita();
do $$
declare c record; rejected boolean; yr integer:=extract(year from now() at time zone 'Europe/Lisbon')::integer;
begin
 insert into tg_assist_booking_check(id,admin_id,assunto,estado) values('synthetic-ordinary','synthetic-tenant','Verification','aberta');
 select x.*,case when cardinality(x.locais_ids)>0 then x.locais_ids[1] else coalesce(x.local_id,'') end as lid,p.id as uid into c
 from public.contratos x join public.perfis p on p.papel='admin' and p.registo_id=x.admin_id
 where (x.data_inicio is null or x.data_inicio<=current_date) and (x.validade_contrato is null or x.validade_contrato>=current_date)
 and (coalesce(case when cardinality(x.locais_ids)>0 then x.locais_ids[1] else x.local_id end,'')='' or exists(select 1 from public.locais l where l.id=case when cardinality(x.locais_ids)>0 then x.locais_ids[1] else x.local_id end and l.admin_id=x.admin_id and l.cliente_id=x.cliente_id)) limit 1;
 if not found then raise exception 'No active read-only contract fixture';end if;
 perform set_config('request.jwt.claim.sub',c.uid::text,true);
 insert into tg_assist_booking_check(id,admin_id,cliente_id,local_id,assunto,estado,teste_tg_contrato_id,teste_tg_visita_ano)
 values('synthetic-booking',c.admin_id,c.cliente_id,nullif(c.lid,''),'Verification','aberta',c.id,yr);
 update tg_assist_booking_check set teste_tg_contrato_id=null,teste_tg_visita_ano=null,os_gerada_id='synthetic-os' where id='synthetic-booking';
 if (select count(*) from tg_assist_booking_check where teste_tg_contrato_id=c.id and teste_tg_visita_ano=yr)<>1 then raise exception 'Reservation lost or duplicated';end if;
 update tg_assist_booking_check set teste_tg_visita_ano=2020 where id='synthetic-booking';
 if (select teste_tg_visita_ano from tg_assist_booking_check where id='synthetic-booking')<>yr then raise exception 'Allocation year overwritten';end if;
 rejected:=false;
 begin insert into tg_assist_booking_check(id,admin_id,cliente_id,local_id,teste_tg_contrato_id,teste_tg_visita_ano) values('synthetic-invalid',c.admin_id,c.cliente_id,nullif(c.lid,''),'invalid-contract',yr);
 exception when check_violation then rejected:=true;end;
 if not rejected then raise exception 'Invalid contract accepted';end if;
 rejected:=false;
 begin update tg_assist_booking_check set teste_tg_contrato_id=c.id,local_id='synthetic-wrong-site' where id='synthetic-booking';exception when check_violation then rejected:=true;end;
 if not rejected then raise exception 'Invalid installation accepted';end if;
 perform set_config('request.jwt.claim.sub','',true);rejected:=false;
 begin update tg_assist_booking_check set teste_tg_contrato_id=null where id='synthetic-booking';exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Anonymous change accepted';end if;
end $$;
select 'PASS: isolated fields, one visit, stale-save and year preservation, invalid contract/site and anonymous changes rejected' as verification;
rollback;
