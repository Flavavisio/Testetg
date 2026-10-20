-- Total Gest: identidade legal da empresa (não altera dados existentes).
-- Aplicar no Supabase do projeto rfniufasivfnrqfntzog ANTES de publicar os JS.
ALTER TABLE public.administradores
  ADD COLUMN IF NOT EXISTS nome_fiscal text;
COMMENT ON COLUMN public.administradores.nome_fiscal IS
  'Denominação legal fiscal exibida sob o nome comercial nos documentos. Apenas administradores/subadministradores da própria empresa devem editá-la.';
-- AVISO: confirmar as políticas RLS existentes sobre administradores antes de disponibilizar
-- esta atualização; a interface por si só não garante a restrição de papéis.
