begin;
create temporary table tg_sheet_read_cases on commit drop as
select p.id as actor, p.papel,
    array(
        select f.id from public.folhas_obra f
        where (
            p.papel = 'superadmin'
            or (
                f.admin_id = case when p.papel = 'admin' then p.registo_id else p.admin_id end
                and case
                    when p.papel = 'funcionario' then f.funcionario_id = p.registo_id
                    when p.papel = 'encarregado' then f.funcionario_id = p.registo_id or exists (
                        select 1 from public.encarregado_funcionarios ef
                        join public.encarregados e on e.id = ef.encarregado_id
                        join public.funcionarios fu on fu.id = ef.funcionario_id
                        where ef.encarregado_id = p.registo_id and ef.funcionario_id = f.funcionario_id
                          and e.admin_id = f.admin_id and fu.admin_id = f.admin_id
                    )
                    when p.papel = 'cliente' then exists (
                        select 1 from public.servicos s where s.id = f.servico_id and s.cliente_id = p.registo_id
                    )
                    else true
                end
            )
        ) order by f.id
    ) as expected
from public.perfis p;
grant select on tg_sheet_read_cases to authenticated;
set local role authenticated;
do $test$
declare c record; actual text[];
begin
    for c in select * from tg_sheet_read_cases loop
        perform set_config('request.jwt.claim.sub', c.actor::text, true);
        perform set_config('request.jwt.claims', json_build_object('sub',c.actor::text,'role','authenticated')::text, true);
        select coalesce(array_agg(f.id order by f.id),array[]::text[]) into actual from public.folhas_obra f;
        if actual is distinct from c.expected then
            raise exception 'Sheet visibility mismatch for role %: actual %, expected %', c.papel, cardinality(actual), cardinality(c.expected);
        end if;
    end loop;
end;
$test$;
reset role;
select papel,count(*) as accounts_verified,count(*) filter(where cardinality(expected)>0) as accounts_with_visible_sheets from tg_sheet_read_cases group by papel order by papel;
rollback;
