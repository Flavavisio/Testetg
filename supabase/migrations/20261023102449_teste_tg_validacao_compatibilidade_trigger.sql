-- Only the Teste TG RPC changes. Existing version triggers resolve their unqualified tables in public.
-- SECURITY INVOKER and fully qualified references preserve existing RLS and validation auditing.
alter function public.tg_teste_validar_folha(text, boolean, boolean) set search_path = public, pg_temp;
notify pgrst, 'reload schema';
