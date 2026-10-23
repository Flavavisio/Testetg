-- Exclusivo Teste TG: conflitos de estado devolvem HTTP 409 sem repetição automática.
-- Preserva permissões, auditoria e regras de validação/faturação.
CREATE OR REPLACE FUNCTION public.tg_teste_guardar_faturacao_folha()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    papel text := public.tg_papel();
    anterior public.tg_teste_folhas_faturacao%rowtype;
    folha public.folhas_obra%rowtype;
    os public.servicos%rowtype;
    obra public.obras%rowtype;
begin
    if auth.uid() is null or coalesce(papel, '') not in ('admin', 'subadmin')
       or NEW.admin_id is distinct from public.tg_admin_id() then
        raise exception 'Sem permissão para alterar a faturação desta folha.' using errcode = '42501';
    end if;
    select * into folha from public.folhas_obra
        where id = NEW.folha_id and admin_id = NEW.admin_id for share;
    if not found then
        raise exception 'Folha de obra não acessível.' using errcode = '42501';
    end if;

    -- Serialize transitions and reject stale state from another tab/device.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'teste_tg_faturacao:' || NEW.admin_id || ':' || NEW.folha_id, 0));
    select * into anterior from public.tg_teste_folhas_faturacao
        where admin_id = NEW.admin_id and folha_id = NEW.folha_id
        order by versao desc limit 1;
    if NEW.versao is distinct from coalesce(anterior.versao, 0) + 1 then
        raise exception 'A faturação foi alterada noutro dispositivo. Atualiza a lista.' using errcode = 'PT409';
    end if;
    if NEW.faturada is not distinct from coalesce(anterior.faturada, false) then
        raise exception 'A folha já se encontra neste estado.' using errcode = '22023';
    end if;
    if not NEW.faturada then
        if papel <> 'admin' then
            raise exception 'Só o administrador pode voltar a colocar uma folha em Por faturar.' using errcode = '42501';
        end if;
        NEW.motivo := nullif(pg_catalog.btrim(NEW.motivo), '');
        if NEW.motivo is null then
            raise exception 'É obrigatório indicar o motivo da alteração.' using errcode = '22023';
        end if;
    else
        if folha.validada is not true then
            raise exception 'Valida a folha antes de a marcar como faturada.' using errcode = '22023';
        end if;
        select * into os from public.servicos
            where id = folha.servico_id and admin_id = NEW.admin_id for share;
        select * into obra from public.obras
            where id = coalesce(folha.obra_id, os.obra_id) and admin_id = NEW.admin_id for share;
        -- A linked work must be finished even when its OS is already finished.
        -- Every explicit link must resolve; a missing parent never permits billing.
        if (folha.servico_id is not null and (os.id is null or
               translate(lower(btrim(coalesce(os.status, ''))), 'í', 'i') not in ('concluido','concluida','terminado','terminada')))
           or (coalesce(folha.obra_id, os.obra_id) is not null and (obra.id is null or
               translate(lower(btrim(coalesce(obra.estado, ''))), 'í', 'i') not in ('concluido','concluida','terminado','terminada')))
           or (folha.servico_id is null and folha.obra_id is null) then
            raise exception 'Termina a OS e a obra associada antes de marcar a folha como faturada.' using errcode = '22023';
        end if;
        NEW.motivo := null;
    end if;
    NEW.alterado_por := auth.uid();
    NEW.autor_papel := papel;
    NEW.alterado_em := clock_timestamp();
    return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tg_teste_validar_folha(p_folha_id text, p_validada boolean, p_antes boolean)
 RETURNS TABLE(id text, validada boolean, validada_por uuid, validada_em timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        raise exception 'A validação mudou noutro dispositivo. Atualiza a lista.' using errcode = 'PT409';
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
$function$;
