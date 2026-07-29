-- Test-only compatibility for historical migrations that were originally
-- completed with manual database changes between versioned files.

ALTER TABLE public.permissoes
ADD COLUMN IF NOT EXISTS nome text;

-- An early purchases policy referenced the retired `usuarios` relation.
-- The compatibility view lets the historical statement compile; later
-- hardening migrations replace that policy with the canonical RBAC rules.
CREATE VIEW public.usuarios AS
SELECT
  id,
  role::text AS perfil,
  '[]'::jsonb AS permissions
FROM public.profiles;
