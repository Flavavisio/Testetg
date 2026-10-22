-- Campos aditivos: folhas existentes e novas começam sem validação.
alter table public.folhas_obra
  add column if not exists cliente_id text,
  add column if not exists validada boolean not null default false,
  add column if not exists validada_por uuid,
  add column if not exists validada_em timestamptz;

-- A sincronização normal não escreve estes três campos: só a ação explícita altera o estado.
create or replace function public.tg_guardar_validacao_folha()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    NEW.validada := false;
    NEW.validada_por := null;
    NEW.validada_em := null;
    return NEW;
  end if;
  if NEW.validada is distinct from OLD.validada then
    if auth.uid() is null
      or coalesce(public.tg_papel(), '') not in ('admin', 'subadmin')
      or NEW.admin_id is distinct from public.tg_admin_id()
      or OLD.admin_id is distinct from public.tg_admin_id() then
      raise exception 'Apenas o admin ou subadmin da empresa pode validar folhas de obra.'
        using errcode = '42501';
    end if;
    NEW.validada_por := case when NEW.validada then auth.uid() else null end;
    NEW.validada_em := case when NEW.validada then statement_timestamp() else null end;
  else
    NEW.validada_por := OLD.validada_por;
    NEW.validada_em := OLD.validada_em;
  end if;
  return NEW;
end;
$$;
revoke all on function public.tg_guardar_validacao_folha() from public, anon, authenticated;
create trigger tg_folhas_guardar_validacao
before insert or update on public.folhas_obra
for each row execute function public.tg_guardar_validacao_folha();

alter table public.folhas_obra add constraint folhas_validacao_coerente
check ((validada and validada_por is not null and validada_em is not null)
    or (not validada and validada_por is null and validada_em is null));

comment on column public.folhas_obra.validada is 'Validação administrativa explícita, independente da assinatura do cliente.';
notify pgrst, 'reload schema';

