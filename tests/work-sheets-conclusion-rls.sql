-- Synthetic fixtures only. Every write, including version bumps, is rolled back.
begin;
create temporary table teste_tg_flow_actors on commit drop as
select p.registo_id as tenant, p.id as actor,
    (select s.id from public.perfis s where s.papel='subadmin' and s.admin_id=p.registo_id limit 1) as sub_actor,
    (select s.id from public.perfis s where s.papel='funcionario' and s.admin_id=p.registo_id limit 1) as staff_actor
from public.perfis p where p.papel='admin'
and exists (select 1 from public.perfis s where s.papel='subadmin' and s.admin_id=p.registo_id)
and exists (select 1 from public.perfis s where s.papel='funcionario' and s.admin_id=p.registo_id)
limit 1;
do $$ begin if not exists(select 1 from teste_tg_flow_actors) then raise exception 'Missing test actors'; end if; end $$;
insert into public.obras(id,admin_id,nome,observacoes,estado)
select '__teste_tg_flow_work_'||v.key,a.tenant,'Teste transacional','Teste transacional',v.state
from teste_tg_flow_actors a cross join (values ('open','ativa'),('closed','concluida')) v(key,state);
insert into public.servicos(id,admin_id,descricao,status,obra_id)
select '__teste_tg_flow_os_'||v.key,a.tenant,'Teste transacional',v.state,v.work
from teste_tg_flow_actors a cross join (values
    ('open','em andamento','__teste_tg_flow_work_open'),
    ('done','concluído','__teste_tg_flow_work_open'),
    ('independent','concluído',null),
    ('closed_open','pendente','__teste_tg_flow_work_closed'),
    ('closed_done','terminada','__teste_tg_flow_work_closed'),
    ('cancelled','cancelado',null)) v(key,state,work);
insert into public.folhas_obra(id,admin_id,obra_descricao,descricao,horas_trabalhadas,servico_id,obra_id)
select '__teste_tg_flow_sheet_'||v.key,a.tenant,'Teste transacional','Teste transacional',2,v.os,v.work
from teste_tg_flow_actors a cross join (values
    ('direct',null,'__teste_tg_flow_work_open'),
    ('open','__teste_tg_flow_os_open',null),
    ('done','__teste_tg_flow_os_done',null),
    ('done2','__teste_tg_flow_os_done',null),
    ('independent','__teste_tg_flow_os_independent',null),
    ('closed_open','__teste_tg_flow_os_closed_open',null),
    ('closed_done','__teste_tg_flow_os_closed_done',null),
    ('closed_unvalidated','__teste_tg_flow_os_closed_done',null),
    ('cancelled','__teste_tg_flow_os_cancelled',null)) v(key,os,work);
grant select on teste_tg_flow_actors to authenticated;
set local role authenticated;
do $test$
declare a record; r record; k text;
begin
    select * into a from teste_tg_flow_actors;
    perform set_config('request.jwt.claim.sub', a.actor::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub',a.actor::text,'role','authenticated')::text,true);
    foreach k in array array['cancelled'] loop
        begin
            perform * from public.tg_teste_validar_folha('__teste_tg_flow_sheet_'||k,true,false);
            raise exception 'Validation unexpectedly allowed: %',k;
        exception when invalid_parameter_value then null; end;
    end loop;
    foreach k in array array['open','closed_open','done','direct','independent','closed_done'] loop
        select * into r from public.tg_teste_validar_folha('__teste_tg_flow_sheet_'||k,true,false);
        if not r.validada or r.validada_por<>a.actor or r.validada_em is null then
            raise exception 'Validation/audit not confirmed: %',k;
        end if;
    end loop;
    begin
        perform * from public.tg_teste_validar_folha('__teste_tg_flow_sheet_done',true,false);
        raise exception 'Stale validation unexpectedly allowed';
    exception when sqlstate 'PT409' then null; end;
    begin
        perform * from public.tg_teste_validar_folha('__teste_tg_flow_missing',true,false);
        raise exception 'Missing or foreign sheet unexpectedly allowed';
    exception when insufficient_privilege then null; end;
    foreach k in array array['direct','open','done','closed_open','cancelled'] loop
        begin
            insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada)
            values(a.tenant,'__teste_tg_flow_sheet_'||k,1,true);
            raise exception 'Billing unexpectedly allowed: %',k;
        exception when invalid_parameter_value then null; end;
    end loop;
    begin
        insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada)
        values(a.tenant,'__teste_tg_flow_sheet_closed_unvalidated',1,true);
        raise exception 'Unvalidated sheet billing unexpectedly allowed';
    exception when invalid_parameter_value then
        if sqlerrm not like 'Valida a folha%' then raise; end if;
    end;
    foreach k in array array['independent','closed_done'] loop
        insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada)
        values(a.tenant,'__teste_tg_flow_sheet_'||k,1,true);
    end loop;
    -- A stale billing version returns an HTTP conflict, never a retryable 40001.
    begin
        insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada,motivo)
        values(a.tenant,'__teste_tg_flow_sheet_independent',1,false,'Versão desatualizada');
        raise exception 'Stale billing unexpectedly allowed';
    exception when sqlstate 'PT409' then null; end;
    perform set_config('request.jwt.claim.sub',a.sub_actor::text,true);
    perform set_config('request.jwt.claims',json_build_object('sub',a.sub_actor::text,'role','authenticated')::text,true);
    select * into r from public.tg_teste_validar_folha('__teste_tg_flow_sheet_done2',true,false);
    if not r.validada or r.validada_por<>a.sub_actor then raise exception 'Subadmin validation failed'; end if;
    begin
        insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada,motivo)
        values(a.tenant,'__teste_tg_flow_sheet_independent',2,false,'Teste de reversão');
        raise exception 'Subadmin reversal unexpectedly allowed';
    exception when insufficient_privilege then null; end;
    perform set_config('request.jwt.claim.sub',a.staff_actor::text,true);
    perform set_config('request.jwt.claims',json_build_object('sub',a.staff_actor::text,'role','authenticated')::text,true);
    begin
        perform * from public.tg_teste_validar_folha('__teste_tg_flow_sheet_done2',false,true);
        raise exception 'Employee validation unexpectedly allowed';
    exception when insufficient_privilege then null; end;
    perform set_config('request.jwt.claim.sub',a.actor::text,true);
    perform set_config('request.jwt.claims',json_build_object('sub',a.actor::text,'role','authenticated')::text,true);
    insert into public.tg_teste_folhas_faturacao(admin_id,folha_id,versao,faturada,motivo)
    values(a.tenant,'__teste_tg_flow_sheet_independent',2,false,'Teste de reversão');
    select * into r from public.tg_teste_validar_folha('__teste_tg_flow_sheet_done',false,true);
    if r.validada or r.validada_por is not null or r.validada_em is not null then raise exception 'Validation reversal failed'; end if;
    if (select sum(horas_trabalhadas) from public.folhas_obra where id like '__teste_tg_flow_sheet_%')<>18 then
        raise exception 'Hours changed during validation/billing';
    end if;
end;
$test$;
reset role;
select 'PASS: validação com OS em curso, faturação após conclusão, auditoria, concorrência e permissões; 9 folhas sintéticas, tudo revertido.' as resultado;
rollback;
