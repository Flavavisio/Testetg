-- Export the snapshot column as one JSON object. This reads no attachment data.
select jsonb_build_object(
    'viewSql', pg_get_viewdef('tg_internal.ficheiros_registos'::regclass, true),
    'functions', (select jsonb_agg(pg_get_functiondef(p.oid) order by p.proname desc)
                  from pg_proc p where p.pronamespace = 'tg_internal'::regnamespace
                    and p.proname in ('ficheiro_referenciado', 'ficheiro_novo_por_associar')),
    'policies', (select jsonb_agg(jsonb_build_object(
                        'name', p.policyname, 'mode', p.permissive, 'operation', p.cmd,
                        'using', p.qual, 'check', p.with_check) order by p.policyname)
                 from pg_policies p
                 where p.schemaname = 'storage' and p.tablename = 'objects'
                   and p.roles = '{authenticated}'::name[]
                   and (p.policyname in ('anexos_privados_ler', 'anexos_privados_inserir')
                        or p.policyname like 'portal_storage_%')),
    'bucketPublic', (select public from storage.buckets where id = 'anexos-privados'),
    'internalUsage', has_schema_privilege('authenticated', 'tg_internal', 'usage'),
    'viewSelect', has_table_privilege('authenticated', 'tg_internal.ficheiros_registos', 'select'),
    'referenceExecute', has_function_privilege('authenticated', 'tg_internal.ficheiro_referenciado(text,text,text)', 'execute'),
    'previewExecute', has_function_privilege('authenticated', 'tg_internal.ficheiro_novo_por_associar(text)', 'execute')
) as snapshot;
