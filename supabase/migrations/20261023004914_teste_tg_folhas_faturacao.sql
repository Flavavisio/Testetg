-- Exclusivo do Teste TG. Não altera folhas_obra, obras, servicos, os seus
-- triggers/policies nem qualquer processo de faturação usado pela TG.
-- Sem FK para as tabelas de produção: não muda sequer a sua eliminação.
-- Cada transição é um evento imutável, que serve também de auditoria.
create table public.tg_teste_folhas_faturacao (
    admin_id text not null,
    folha_id text not null,
    versao integer not null check (versao > 0),
    faturada boolean not null,
    motivo text check (motivo is null or char_length(motivo) between 1 and 1000),
    alterado_por uuid not null,
    autor_papel text not null check (autor_papel in ('admin', 'subadmin')),
    alterado_em timestamptz not null,
    primary key (admin_id, folha_id, versao)
);
alter table public.tg_teste_folhas_faturacao enable row level security;
revoke all on public.tg_teste_folhas_faturacao from public, anon, authenticated;
grant select, insert on public.tg_teste_folhas_faturacao to authenticated;

create policy teste_tg_faturacao_ler
on public.tg_teste_folhas_faturacao for select to authenticated
using (
    admin_id = (select public.tg_admin_id())
    and (select public.tg_papel()) not in ('cliente', 'superadmin')
    and exists (
        select 1 from public.folhas_obra f
        where f.id = folha_id and f.admin_id = tg_teste_folhas_faturacao.admin_id
    )
);
create policy teste_tg_faturacao_registar
on public.tg_teste_folhas_faturacao for insert to authenticated
with check (
    admin_id = (select public.tg_admin_id())
    and (select public.tg_papel()) in ('admin', 'subadmin')
    and alterado_por = (select auth.uid())
    and exists (
        select 1 from public.folhas_obra f
        where f.id = folha_id and f.admin_id = tg_teste_folhas_faturacao.admin_id
    )
);

create function public.tg_teste_guardar_faturacao_folha()
returns trigger language plpgsql security invoker set search_path = ''
as $$
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
        where id = NEW.folha_id and admin_id = NEW.admin_id;
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
        raise exception 'A faturação foi alterada noutro dispositivo. Atualiza a lista.' using errcode = '40001';
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
        select * into os from public.servicos
            where id = folha.servico_id and admin_id = NEW.admin_id;
        select * into obra from public.obras
            where id = coalesce(folha.obra_id, os.obra_id) and admin_id = NEW.admin_id;
        if coalesce(os.status, '') like 'cancelad%' or coalesce(obra.estado, '') like 'cancelad%'
           or not (
               translate(lower(coalesce(os.status, '')), 'í', 'i') in ('concluido', 'concluida', 'terminado', 'terminada')
               or translate(lower(coalesce(obra.estado, '')), 'í', 'i') in ('concluido', 'concluida', 'terminado', 'terminada')
           ) then
            raise exception 'A Obra/OS tem de estar concluída antes de marcar a folha como faturada.' using errcode = '22023';
        end if;
        NEW.motivo := null;
    end if;
    NEW.alterado_por := auth.uid();
    NEW.autor_papel := papel;
    NEW.alterado_em := clock_timestamp();
    return NEW;
end;
$$;
revoke all on function public.tg_teste_guardar_faturacao_folha() from public, anon, authenticated;
create trigger tg_teste_faturacao_guardar
before insert on public.tg_teste_folhas_faturacao
for each row execute function public.tg_teste_guardar_faturacao_folha();

create view public.tg_teste_folhas_faturacao_atual
with (security_invoker = true)
as select distinct on (admin_id, folha_id)
    admin_id, folha_id, versao, faturada, motivo, alterado_por, autor_papel, alterado_em
from public.tg_teste_folhas_faturacao
order by admin_id, folha_id, versao desc;
revoke all on public.tg_teste_folhas_faturacao_atual from public, anon, authenticated;
grant select on public.tg_teste_folhas_faturacao_atual to authenticated;

comment on table public.tg_teste_folhas_faturacao is 'EXCLUSIVO TESTE TG: histórico imutável de faturação manual por folha, isolado da TG de produção.';
notify pgrst, 'reload schema';
