-- Add both SCIE types without changing the types already accepted by this database.
DO $$
DECLARE
    table_name text;
    constraint_name text;
    previous_check text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['relatorios_especialidade', 'config_series_relatorio']
    LOOP
        constraint_name := table_name || '_tipo_check';
        SELECT pg_get_expr(c.conbin, c.conrelid)
          INTO previous_check
          FROM pg_constraint AS c
         WHERE c.conrelid = to_regclass(format('public.%I', table_name))
           AND c.conname = constraint_name
           AND c.contype = 'c';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Missing check constraint public.%.%', table_name, constraint_name;
        END IF;

        EXECUTE format(
            'ALTER TABLE public.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I CHECK ((%s) OR tipo IN (%L, %L))',
            table_name, constraint_name, constraint_name, previous_check, 'TRSI', 'TRSM'
        );
    END LOOP;
END $$;
