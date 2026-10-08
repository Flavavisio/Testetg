-- Additive installation passport. Existing rows, histories and policies are preserved.
begin;
alter table public.clientes add column if not exists passaporte_tecnico jsonb;
alter table public.locais add column if not exists passaporte_tecnico jsonb;
alter table public.equipamentos add column if not exists ficha_tecnica jsonb;
alter table public.equipamentos add column if not exists cliente_id text references public.clientes(id);
alter table public.servicos add column if not exists passaporte_intervencao jsonb;
comment on column public.clientes.passaporte_tecnico is 'Technical passport for the customer main site. No credentials.';
comment on column public.locais.passaporte_tecnico is 'Installation photo, access notes, rack, pending issues and documents. No credentials.';
comment on column public.equipamentos.ficha_tecnica is 'Equipment name/model/photo, position, IP, port and cabling.';
comment on column public.servicos.passaporte_intervencao is 'Technical intervention supplement. Does not replace OS, checklist, photos or existing reports.';
notify pgrst, 'reload schema';
commit;
