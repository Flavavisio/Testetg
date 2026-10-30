-- Extend the existing specialty records and number series; preserve tenant RLS.
ALTER TABLE public.relatorios_especialidade DROP CONSTRAINT relatorios_especialidade_tipo_check;
ALTER TABLE public.relatorios_especialidade ADD CONSTRAINT relatorios_especialidade_tipo_check
 CHECK (tipo IN ('REX','RBI','RSI','RCM','RIE','RCP','RCCTV','RIN','RDI','RAVAC','RLIM','RELE'));
ALTER TABLE public.config_series_relatorio DROP CONSTRAINT config_series_relatorio_tipo_check;
ALTER TABLE public.config_series_relatorio ADD CONSTRAINT config_series_relatorio_tipo_check
 CHECK (tipo IN ('REX','RBI','RSI','RCM','RIE','RCP','RCCTV','RIN','RDI','RAVAC','RLIM','RELE'));
CREATE POLICY native_area_relatorios_insert ON public.relatorios_especialidade
 AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
 tipo NOT IN ('RLIM','RELE') OR EXISTS (
 SELECT 1 FROM public.administradores a WHERE a.id=relatorios_especialidade.admin_id
 AND a.areas_negocio @> jsonb_build_array(CASE relatorios_especialidade.tipo WHEN 'RLIM' THEN 'limpeza' ELSE 'eletricidade' END)));
CREATE POLICY native_area_relatorios_update ON public.relatorios_especialidade
 AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (tipo NOT IN ('RLIM','RELE') OR EXISTS (
 SELECT 1 FROM public.administradores a WHERE a.id=relatorios_especialidade.admin_id
 AND a.areas_negocio @> jsonb_build_array(CASE relatorios_especialidade.tipo WHEN 'RLIM' THEN 'limpeza' ELSE 'eletricidade' END)))
 WITH CHECK (tipo NOT IN ('RLIM','RELE') OR EXISTS (
 SELECT 1 FROM public.administradores a WHERE a.id=relatorios_especialidade.admin_id
 AND a.areas_negocio @> jsonb_build_array(CASE relatorios_especialidade.tipo WHEN 'RLIM' THEN 'limpeza' ELSE 'eletricidade' END)));
