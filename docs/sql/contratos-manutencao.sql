ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS gestao_manutencao jsonb;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS validade_contrato date;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS plano_manutencao jsonb;
ALTER TABLE public.registos_manutencao ADD COLUMN IF NOT EXISTS sistemas_ids jsonb;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='contratos_gestao_object' AND conrelid='public.contratos'::regclass) THEN
  ALTER TABLE public.contratos ADD CONSTRAINT contratos_gestao_object CHECK (gestao_manutencao IS NULL OR jsonb_typeof(gestao_manutencao)='object');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='servicos_plano_object' AND conrelid='public.servicos'::regclass) THEN
  ALTER TABLE public.servicos ADD CONSTRAINT servicos_plano_object CHECK (plano_manutencao IS NULL OR jsonb_typeof(plano_manutencao)='object');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='registos_sistemas_array' AND conrelid='public.registos_manutencao'::regclass) THEN
  ALTER TABLE public.registos_manutencao ADD CONSTRAINT registos_sistemas_array CHECK (sistemas_ids IS NULL OR jsonb_typeof(sistemas_ids)='array');
 END IF;
END $$;
NOTIFY pgrst, 'reload schema';
