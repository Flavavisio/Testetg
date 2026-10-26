-- Isolated preference: only the Testetg client reads this column.
alter table public.administradores
  add column if not exists teste_tg_ponto_assiduidade_ativo boolean not null default true;
comment on column public.administradores.teste_tg_ponto_assiduidade_ativo
  is 'Teste TG only. Production clients ignore this setting. Worksite/OS time remains enabled.';

create or replace function public.teste_tg_proteger_ponto_assiduidade()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  if new.teste_tg_ponto_assiduidade_ativo is distinct from old.teste_tg_ponto_assiduidade_ativo then
    if auth.uid() is null or not exists (
      select 1 from public.perfis p
      where p.id = auth.uid()
        and (p.papel = 'superadmin'
          or (p.papel in ('admin','subadmin') and public.tg_admin_id() = old.id))
    ) then
      raise exception 'Apenas o administrador da empresa pode alterar os registos de tempo.' using errcode = '42501';
    end if;
    if not new.teste_tg_ponto_assiduidade_ativo and exists (
      select 1 from public.ponto p where p.admin_id = old.id
        and p.servico_id is null
        and p.entrada is not null and p.saida is null
    ) then
      raise exception 'Fecha primeiro os pontos gerais em aberto da equipa.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists teste_tg_proteger_ponto_assiduidade on public.administradores;
create trigger teste_tg_proteger_ponto_assiduidade
before update of teste_tg_ponto_assiduidade_ativo on public.administradores
for each row execute function public.teste_tg_proteger_ponto_assiduidade();
