-- P3: use the same administrative rule in RLS/RPCs and the frontend.
-- A legacy profiles.role value no longer grants administrative authority alone.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin(
  check_user uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    check_user IS NOT NULL
    AND (
      public.is_dirigente_atual(check_user)
      OR EXISTS (
        SELECT 1
        FROM public.usuario_grupos ug
        JOIN public.grupo_permissoes gp ON gp.grupo_id = ug.grupo_id
        JOIN public.permissoes p ON p.id = gp.permissao_id
        WHERE ug.usuario_id = check_user
          AND p.chave = 'modulo_admin'
          AND (
            ug.encontro_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM public.encontros e
              WHERE e.id = ug.encontro_id
                AND e.ativo = true
            )
          )
      )
    );
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
