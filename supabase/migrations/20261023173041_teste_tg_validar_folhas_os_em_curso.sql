-- Exclusivo Teste TG: nenhuma alteração aos triggers/policies usados pela TG.
-- Validação independente da conclusão; faturação e auditoria mantêm as regras existentes.
create or replace function public.tg_teste_validar_folha(p_folha_id text, p_validada boolean, p_antes boolean)
returns table(id text, validada boolean, validada_por uuid, validada_em timestamptz)
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
    tenant text := public.tg_admin_id();
    folha public.folhas_obra%rowtype;
    os public.servicos%rowtype;
begin
    if auth.uid() is null or coalesce(public.tg_papel(), '') not in ('admin', 'subadmin') then
        raise exception 'Sem permissão para validar esta folha.' using errcode = '42501';
    end if;
    if p_validada is null or p_antes is null or p_validada = p_antes then
        raise exception 'Transição de validação inválida.' using errcode = '22023';
    end if;
    select f.* into folha from public.folhas_obra f
        where f.id = p_folha_id and f.admin_id = tenant for update;
    if not found then
        raise exception 'Folha de obra não acessível.' using errcode = '42501';
    end if;
    if folha.validada is distinct from p_antes then
        raise exception 'A validação mudou noutro dispositivo. Atualiza a lista.' using errcode = '40001';
    end if;
    -- Reversão continua disponível, incluindo folhas validadas antes desta regra.
    if p_validada and folha.servico_id is not null then
        select s.* into os from public.servicos s
            where s.id = folha.servico_id and s.admin_id = tenant for share;
        if not found then
            raise exception 'Ligação à Obra/OS por confirmar.' using errcode = '22023';
        end if;
        if lower(btrim(coalesce(os.status, ''))) like '%cancelad%' then
            raise exception 'A OS está cancelada.' using errcode = '22023';
        end if;
    end if;
    return query update public.folhas_obra f set validada = p_validada
        where f.id = p_folha_id and f.admin_id = tenant
        returning f.id, f.validada, f.validada_por, f.validada_em;
end;
$$;
revoke all on function public.tg_teste_validar_folha(text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.tg_teste_validar_folha(text, boolean, boolean) to authenticated;
comment on function public.tg_teste_validar_folha(text, boolean, boolean) is 'EXCLUSIVO TESTE TG: validação explícita com obra/OS em curso; preserva RLS e auditoria existentes.';
