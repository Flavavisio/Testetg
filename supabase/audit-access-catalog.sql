-- Inventário de metadados. Pode ser repetido em Produção e no TesteTG.
-- Uma permissão de tabela e uma política aplicável não provam acesso a uma linha.
with tables as (
    select n.nspname as schema_name, c.relname as table_name, c.oid,
           c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname in ('objects', 'buckets')))
), api_roles(role_name) as (
    values ('anon'), ('authenticated')
), operations(operation) as (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
), access_catalog as (
    select t.schema_name, t.table_name, t.rls_enabled, t.rls_forced, r.role_name, o.operation,
           has_schema_privilege(r.role_name, t.schema_name, 'USAGE') as schema_usage,
           has_table_privilege(r.role_name, t.oid, o.operation) as table_grant,
           case when o.operation <> 'DELETE'
                then has_any_column_privilege(r.role_name, t.oid, o.operation)
                else false
           end as any_column_grant,
           count(p.policyname) filter (where p.permissive = 'PERMISSIVE') as permissive_policies,
           count(p.policyname) filter (where p.permissive = 'RESTRICTIVE') as restrictive_policies
    from tables t
    cross join api_roles r
    cross join operations o
    left join pg_policies p on p.schemaname = t.schema_name
                           and p.tablename = t.table_name
                           and p.cmd in ('ALL', o.operation)
                           and exists (
                               select 1 from unnest(p.roles) as policy_role(name)
                               where case when policy_role.name = 'public' then true
                                          else pg_has_role(r.role_name, policy_role.name, 'MEMBER')
                                     end
                           )
    group by t.schema_name, t.table_name, t.oid, t.rls_enabled, t.rls_forced, r.role_name, o.operation
)
select *
from access_catalog
order by schema_name, table_name, role_name, operation;
