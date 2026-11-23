-- Plano próprio das Ordens de Serviço sem Obra.
-- A ligação à obra continua a usar obra_materiais como única fonte de previsão.
-- Apenas introduz a coluna; as políticas de acesso existentes de servicos mantêm-se.
ALTER TABLE public.servicos
    ADD COLUMN IF NOT EXISTS materiais_previstos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.servicos.materiais_previstos IS
'Plano de materiais de uma OS avulsa: [{artigoId,qtdPrevista,qtdConsumida}]. OS associada a obra utiliza obra_materiais.';
