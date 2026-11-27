-- Export the snapshot column as one JSON object for test-tenant-isolation.cjs.
-- This query reads catalog metadata only. Keep the result out of the repository.
with tables as (
    select oid, relname::text as name
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('administradores', 'clientes', 'config_superadmin', 'servicos',
                      'folhas_obra', 'licencas', 'obras', 'perfis',
                      'ponto', 'pedidos', 'requisicoes', 'veiculo_documentos', 'funcionarios',
                      'relatorios_especialidade', 'encomendas', 'contratos', 'obra_documentos', 'locais')
), fields as (
    select t.oid, t.name as table_name, a.attnum, a.attname as field,
           format_type(a.atttypid, a.atttypmod) as data_type
    from tables t
    join pg_attribute a on a.attrelid = t.oid
    where a.attnum > 0 and not a.attisdropped
), role_operations(role_name, operation) as (
    select *
    from (values ('anon'), ('authenticated')) roles(role_name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) operations(operation)
), table_grants as (
    select t.name as table_name, r.role_name, r.operation,
           has_table_privilege(r.role_name, t.oid, r.operation) as allowed
    from tables t
    cross join role_operations r
)
select jsonb_build_object(
    'columns', (select jsonb_agg(jsonb_build_object('table_name', table_name, 'field', field, 'data_type', data_type)
                                 order by table_name, attnum) from fields),
    'policies', (select jsonb_agg(jsonb_build_object(
                        'tablename', p.tablename, 'policyname', p.policyname, 'permissive', p.permissive,
                        'roles', p.roles::text, 'cmd', p.cmd, 'qual', p.qual, 'with_check', p.with_check)
                        order by p.tablename, p.policyname)
                 from pg_policies p join tables t on p.tablename = t.name where p.schemaname = 'public'),
    'functions', (select jsonb_agg(pg_get_functiondef(p.oid) order by p.proname)
                  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.pronargs = 0
                  and p.proname in ('auth_is_superadmin', 'auth_tenant_id', 'tg_admin_id',
                                    'tg_cliente_registo_id', 'tg_e_cliente', 'tg_portal_ativo', 'tg_superadmin',
                                    'empresa_do_utilizador_atual', 'utilizador_atual_e_superadmin')),
    'triggers', (select jsonb_agg(jsonb_build_object(
                        'definition', pg_get_functiondef(g.tgfoid), 'installation', pg_get_triggerdef(g.oid))
                        order by t.name, g.tgname)
                 from pg_trigger g join tables t on t.oid = g.tgrelid
                 where not g.tgisinternal and g.tgenabled <> 'D'
                   and g.tgname in ('descartar_senha_legada_tg', 'portal_proteger_assinatura_folha', 'proteger_licenca_tg')),
    'grants', (select jsonb_agg(to_jsonb(g) order by table_name, role_name, operation) from table_grants g),
    'columnGrants', (select coalesce(jsonb_agg(jsonb_build_object(
                             'table_name', f.table_name, 'field', f.field, 'role_name', g.role_name, 'operation', g.operation)),
                             '[]'::jsonb)
                     from fields f join table_grants g using (table_name)
                     where not g.allowed and g.operation in ('SELECT', 'INSERT', 'UPDATE')
                       and has_column_privilege(g.role_name, f.oid, f.attnum, g.operation))
) as snapshot;
