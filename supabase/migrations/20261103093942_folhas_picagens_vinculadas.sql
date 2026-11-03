-- Additive association; no backfill or updates to historical clocks/sheets.
alter table public.folhas_obra add column if not exists picagens_vinculadas jsonb;
alter table public.folhas_obra add constraint folhas_picagens_vinculadas_array check (picagens_vinculadas is null or jsonb_typeof(picagens_vinculadas) = 'array') not valid;
alter table public.folhas_obra validate constraint folhas_picagens_vinculadas_array;
comment on column public.folhas_obra.picagens_vinculadas is 'Associacoes explicitas por tipo e id de picagem. NULL preserva folhas legadas; [] representa folha manual sem picagens. Sem alteracoes aos registos de ponto originais.';
notify pgrst, 'reload schema';
