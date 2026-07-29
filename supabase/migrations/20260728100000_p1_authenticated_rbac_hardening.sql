-- P1: authenticated authorization hardening.
-- Keeps permission checks in the database and prevents users from enumerating
-- other accounts' group assignments.

DROP POLICY IF EXISTS "authenticated_can_read_usuario_grupos"
  ON public.usuario_grupos;

CREATE POLICY "authenticated_can_read_own_usuario_grupos"
ON public.usuario_grupos
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  OR public.is_admin(auth.uid())
);

CREATE OR REPLACE FUNCTION public.has_permission(
  check_user uuid,
  permission_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_encontro_ativo_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- A regular authenticated user may only inspect their own permissions.
  IF check_user IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin(auth.uid()) THEN
    RETURN false;
  END IF;

  SELECT e.id
  INTO v_encontro_ativo_id
  FROM public.encontros e
  WHERE e.ativo = true
  LIMIT 1;

  RETURN EXISTS (
    SELECT 1
    FROM public.usuario_grupos ug
    JOIN public.grupo_permissoes gp ON gp.grupo_id = ug.grupo_id
    JOIN public.permissoes p ON p.id = gp.permissao_id
    WHERE ug.usuario_id = check_user
      AND p.chave = permission_key
      AND (
        ug.encontro_id IS NULL
        OR ug.encontro_id = v_encontro_ativo_id
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- Prevent object-name hijacking in every existing public SECURITY DEFINER
-- function, including legacy functions created before the convention existed.
DO $$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public, pg_temp',
      v_function.schema_name,
      v_function.function_name,
      v_function.identity_arguments
    );
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
