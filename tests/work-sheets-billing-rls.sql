-- Exercises only the isolated Teste TG log. All changes roll back.
-- Reads existing parents/profiles; never updates production records.
begin;
create temporary table teste_tg_billing_case on commit drop as
select f.admin_id, f.id as folha_id,
    (select p.id from public.perfis p where p.papel='admin' and p.registo_id=f.admin_id limit 1) as admin_actor,
    (select p.id from public.perfis p where p.papel='subadmin' and p.admin_id=f.admin_id limit 1) as sub_actor,
    (select p.id from public.perfis p where p.papel='funcionario' and p.admin_id=f.admin_id limit 1) as staff_actor,
    (select p.id from public.perfis p where p.papel='cliente' and p.admin_id=f.admin_id limit 1) as client_actor,
    (select f2.id from public.folhas_obra f2
     left join public.servicos s2 on s2.id=f2.servico_id and s2.admin_id=f2.admin_id
     left join public.obras o2 on o2.id=coalesce(f2.obra_id,s2.obra_id) and o2.admin_id=f2.admin_id
     where f2.admin_id=f.admin_id and f2.validada is true and f2.id<>f.id and (f2.servico_id is null or s2.status='concluído')
       and (coalesce(f2.obra_id,s2.obra_id) is null or o2.estado='concluida')
       and (f2.servico_id is not null or f2.obra_id is not null)
       and coalesce(s2.status,'') not like 'cancelad%' and coalesce(o2.estado,'') not like 'cancelad%'
       and not exists (select 1 from public.tg_teste_folhas_faturacao t where t.folha_id=f2.id and t.admin_id=f2.admin_id)
     limit 1) as segunda_folha,
    (select f3.id from public.folhas_obra f3
     left join public.servicos s3 on s3.id=f3.servico_id and s3.admin_id=f3.admin_id
     left join public.obras o3 on o3.id=coalesce(f3.obra_id,s3.obra_id) and o3.admin_id=f3.admin_id
     where f3.admin_id=f.admin_id and coalesce(s3.status,'')<>'concluído' and coalesce(o3.estado,'')<>'concluida'
     limit 1) as folha_aberta
from public.folhas_obra f
left join public.servicos s on s.id=f.servico_id and s.admin_id=f.admin_id
left join public.obras o on o.id=coalesce(f.obra_id,s.obra_id) and o.admin_id=f.admin_id
where f.validada is true and (f.servico_id is null or s.status='concluído')
  and (coalesce(f.obra_id,s.obra_id) is null or o.estado='concluida')
  and (f.servico_id is not null or f.obra_id is not null)
  and coalesce(s.status,'') not like 'cancelad%' and coalesce(o.estado,'') not like 'cancelad%'
  and not exists (select 1 from public.tg_teste_folhas_faturacao t where t.folha_id=f.id and t.admin_id=f.admin_id)
  and exists (select 1 from public.perfis p where p.papel='admin' and p.registo_id=f.admin_id)
  and exists (select 1 from public.perfis p where p.papel='subadmin' and p.admin_id=f.admin_id)
limit 1;
grant select on teste_tg_billing_case to authenticated;
set local role authenticated;
do $test$
declare
    c record; linha record; visivel boolean;
begin
    select * into c from teste_tg_billing_case;
    if c.folha_id is null or c.segunda_folha is null then raise exception 'Missing existing test case'; end if;
    perform set_config('request.jwt.claim.sub', c.admin_actor::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub',c.admin_actor::text,'role','authenticated')::text, true);
    insert into public.tg_teste_folhas_faturacao
       (admin_id,folha_id,versao,faturada,alterado_por,autor_papel,alterado_em)
       values(c.admin_id,c.folha_id,1,true,'00000000-0000-0000-0000-000000000000','subadmin','2000-01-01');
    select * into linha from public.tg_teste_folhas_faturacao_atual where folha_id=c.folha_id and admin_id=c.admin_id;
    if linha.faturada is not true or linha.alterado_por<>c.admin_actor or linha.autor_papel<>'admin'
       or linha.alterado_em<statement_timestamp()-interval '5 minutes' then raise exception 'Author/timestamp/view mismatch'; end if;
    begin
        update public.tg_teste_folhas_faturacao set faturada=false where folha_id=c.folha_id;
        raise exception 'Audit UPDATE unexpectedly allowed';
    exception when insufficient_privilege then null; end;
    begin
        delete from public.tg_teste_folhas_faturacao where folha_id=c.folha_id;
        raise exception 'Audit DELETE unexpectedly allowed';
    exception when insufficient_privilege then null; end;
    begin
        insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada,motivo)
        values(c.admin_id,c.folha_id,2,false,'   ');
        raise exception 'Empty reason unexpectedly allowed';
    exception when invalid_parameter_value then null; end;
    begin
        insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada)
        values('foreign-tenant',c.folha_id,1,true);
        raise exception 'Cross-tenant insert unexpectedly allowed';
    exception when insufficient_privilege then null; end;
    if c.folha_aberta is not null then
        begin
            insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada)
            values(c.admin_id,c.folha_aberta,1,true);
            raise exception 'Open work invoice unexpectedly allowed';
        exception when invalid_parameter_value then null; end;
    end if;

    perform set_config('request.jwt.claim.sub', c.sub_actor::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub',c.sub_actor::text,'role','authenticated')::text, true);
    insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada)
        values(c.admin_id,c.segunda_folha,1,true);
    begin
        insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada,motivo)
        values(c.admin_id,c.folha_id,2,false,'Subadmin forbidden');
        raise exception 'Subadmin reversal unexpectedly allowed';
    exception when insufficient_privilege then null; end;

    if c.staff_actor is not null then
        perform set_config('request.jwt.claim.sub', c.staff_actor::text, true);
        perform set_config('request.jwt.claims', json_build_object('sub',c.staff_actor::text,'role','authenticated')::text, true);
        begin
            insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada,motivo)
            values(c.admin_id,c.folha_id,2,false,'Staff forbidden');
            raise exception 'Employee write unexpectedly allowed';
        exception when insufficient_privilege then null; end;
        select exists(select 1 from public.folhas_obra where id=c.folha_id and admin_id=c.admin_id) into visivel;
        if exists(select 1 from public.tg_teste_folhas_faturacao_atual where folha_id=c.folha_id and admin_id=c.admin_id) is distinct from visivel then
            raise exception 'Employee view escaped sheet visibility';
        end if;
    end if;
    if c.client_actor is not null then
        perform set_config('request.jwt.claim.sub', c.client_actor::text, true);
        perform set_config('request.jwt.claims', json_build_object('sub',c.client_actor::text,'role','authenticated')::text, true);
        if exists(select 1 from public.tg_teste_folhas_faturacao_atual) then raise exception 'Client financial access unexpectedly allowed'; end if;
    end if;

    perform set_config('request.jwt.claim.sub', c.admin_actor::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub',c.admin_actor::text,'role','authenticated')::text, true);
    insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada,motivo)
        values(c.admin_id,c.folha_id,2,false,'Correction test');
    select * into linha from public.tg_teste_folhas_faturacao_atual where folha_id=c.folha_id and admin_id=c.admin_id;
    if linha.faturada is not false or linha.versao<>2 or linha.motivo<>'Correction test' then raise exception 'Admin reversal mismatch'; end if;
    if (select count(*) from public.tg_teste_folhas_faturacao where folha_id=c.folha_id and admin_id=c.admin_id)<>2 then raise exception 'Missing audit history'; end if;
    begin
        insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada)
        values(c.admin_id,c.folha_id,2,true);
        raise exception 'Stale concurrent write unexpectedly allowed';
    exception when sqlstate 'PT409' then null; end;
end;
$test$;
reset role;
set local role anon;
do $test$
begin
    begin
        perform 1 from public.tg_teste_folhas_faturacao_atual;
        raise exception 'Anonymous access unexpectedly allowed';
    exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
select 'PASS: persistent state, admin/subadmin/staff/client/anon policies, author and timestamp stamping, reason, tenant isolation, immutable history, parent completion and stale version guard' as result;
rollback;
