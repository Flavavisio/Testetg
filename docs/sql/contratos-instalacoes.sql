ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS locais_ids text[];
CREATE OR REPLACE FUNCTION public.validar_instalacoes_contrato()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.locais_ids IS NOT NULL THEN
    IF cardinality(NEW.locais_ids) = 0 OR EXISTS (
      SELECT 1 FROM unnest(NEW.locais_ids) AS item(id)
      WHERE item.id IS NULL OR (item.id <> '' AND NOT EXISTS (
        SELECT 1 FROM public.locais l WHERE l.id = item.id
        AND l.admin_id = NEW.admin_id AND l.cliente_id = NEW.cliente_id
      ))
    ) THEN RAISE EXCEPTION 'Instalações inválidas para o cliente do contrato'; END IF;
    IF NOT (coalesce(NEW.local_id, '') = ANY(NEW.locais_ids)) THEN
      RAISE EXCEPTION 'A instalação principal deve estar abrangida pelo contrato';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS contratos_validar_instalacoes ON public.contratos;
CREATE TRIGGER contratos_validar_instalacoes BEFORE INSERT OR UPDATE OF locais_ids, local_id, cliente_id, admin_id ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.validar_instalacoes_contrato();
ALTER TABLE public.registos_manutencao ADD COLUMN IF NOT EXISTS local_id text;
NOTIFY pgrst, 'reload schema';
