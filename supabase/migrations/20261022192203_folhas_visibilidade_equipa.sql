-- Apply in addition to the tenant and customer portal policies.
-- Restricts reading only; does not grant write, delete or validation privileges.
create policy folhas_obra_visibilidade_equipa
on public.folhas_obra
as restrictive
for select
to authenticated
using (
    exists (
        select 1
        from public.perfis p
        where p.id = (select auth.uid())
          and (
              p.papel not in ('funcionario', 'encarregado')
              or (
                  folhas_obra.admin_id = p.admin_id
                  and (
                      folhas_obra.funcionario_id = p.registo_id
                      or (
                          p.papel = 'encarregado'
                          and exists (
                              select 1
                              from public.encarregado_funcionarios ef
                              join public.encarregados e on e.id = ef.encarregado_id
                              join public.funcionarios f on f.id = ef.funcionario_id
                              where ef.encarregado_id = p.registo_id
                                and ef.funcionario_id = folhas_obra.funcionario_id
                                and e.admin_id = folhas_obra.admin_id
                                and f.admin_id = folhas_obra.admin_id
                          )
                      )
                  )
              )
          )
    )
);
