-- P3: align operational RLS with the permissions enforced by the application.
-- External forms keep using the token-validated SECURITY DEFINER RPCs from P0.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_operational_participation(
  p_participacao_id uuid,
  p_module_permission text,
  p_allow_visitacao boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'modulo_admin')
      OR public.has_permission(auth.uid(), 'modulo_secretaria')
      OR public.has_permission(auth.uid(), p_module_permission)
      OR (
        p_allow_visitacao
        AND (
          public.has_permission(auth.uid(), 'modulo_visitacao_coordenar')
          OR public.has_permission(auth.uid(), 'modulo_visitacao_duplas')
        )
      )
      OR (
        public.has_permission(auth.uid(), 'modulo_coordenador')
        AND EXISTS (
          SELECT 1
          FROM public.participacoes target
          WHERE target.id = p_participacao_id
            AND target.equipe_id IS NOT NULL
            AND public.is_coordenador_da_equipe(
              target.encontro_id,
              target.equipe_id,
              auth.uid()
          )
        )
      )
      OR (
        p_module_permission = 'modulo_recreacao'
        AND public.has_permission(auth.uid(), 'modulo_coordenador')
        AND EXISTS (
          SELECT 1
          FROM public.participacoes target
          JOIN public.participacoes coordinator
            ON coordinator.encontro_id = target.encontro_id
           AND coordinator.coordenador = true
          JOIN public.equipes coordinator_team
            ON coordinator_team.id = coordinator.equipe_id
          JOIN public.pessoas coordinator_person
            ON coordinator_person.id = coordinator.pessoa_id
          JOIN public.profiles coordinator_profile
            ON lower(coordinator_profile.email) = lower(coordinator_person.email)
          WHERE target.id = p_participacao_id
            AND coordinator_profile.id = auth.uid()
            AND lower(coordinator_team.nome) LIKE '%cozinha%'
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_operational_participation(uuid, text, boolean)
FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_operational_participation(uuid, text, boolean)
FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_operational_participation(uuid, text, boolean)
TO authenticated;

DROP POLICY IF EXISTS "Allow authenticated users to select recepcao_dados"
ON public.recepcao_dados;
DROP POLICY IF EXISTS "Allow authenticated users to insert recepcao_dados"
ON public.recepcao_dados;
DROP POLICY IF EXISTS "Allow authenticated users to update recepcao_dados"
ON public.recepcao_dados;
DROP POLICY IF EXISTS "Allow authenticated users to delete recepcao_dados"
ON public.recepcao_dados;
DROP POLICY IF EXISTS "Permitir gestão recepcao"
ON public.recepcao_dados;
DROP POLICY IF EXISTS "Permitir leitura recepcao"
ON public.recepcao_dados;
DROP POLICY IF EXISTS "authorized_read_recepcao_dados"
ON public.recepcao_dados;
DROP POLICY IF EXISTS "authorized_insert_recepcao_dados"
ON public.recepcao_dados;
DROP POLICY IF EXISTS "authorized_update_recepcao_dados"
ON public.recepcao_dados;
DROP POLICY IF EXISTS "authorized_delete_recepcao_dados"
ON public.recepcao_dados;

CREATE POLICY "authorized_read_recepcao_dados"
ON public.recepcao_dados
FOR SELECT TO authenticated
USING (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recepcao',
    true
  )
);

CREATE POLICY "authorized_insert_recepcao_dados"
ON public.recepcao_dados
FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recepcao',
    true
  )
);

CREATE POLICY "authorized_update_recepcao_dados"
ON public.recepcao_dados
FOR UPDATE TO authenticated
USING (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recepcao',
    true
  )
)
WITH CHECK (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recepcao',
    true
  )
);

CREATE POLICY "authorized_delete_recepcao_dados"
ON public.recepcao_dados
FOR DELETE TO authenticated
USING (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recepcao',
    true
  )
);

DROP POLICY IF EXISTS "Allow authenticated users to manage recreacao_dados"
ON public.recreacao_dados;
DROP POLICY IF EXISTS "Permitir gestão recreacao"
ON public.recreacao_dados;
DROP POLICY IF EXISTS "Permitir leitura recreacao"
ON public.recreacao_dados;
DROP POLICY IF EXISTS "authorized_read_recreacao_dados"
ON public.recreacao_dados;
DROP POLICY IF EXISTS "authorized_insert_recreacao_dados"
ON public.recreacao_dados;
DROP POLICY IF EXISTS "authorized_update_recreacao_dados"
ON public.recreacao_dados;
DROP POLICY IF EXISTS "authorized_delete_recreacao_dados"
ON public.recreacao_dados;

CREATE POLICY "authorized_read_recreacao_dados"
ON public.recreacao_dados
FOR SELECT TO authenticated
USING (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recreacao',
    false
  )
);

CREATE POLICY "authorized_insert_recreacao_dados"
ON public.recreacao_dados
FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recreacao',
    false
  )
);

CREATE POLICY "authorized_update_recreacao_dados"
ON public.recreacao_dados
FOR UPDATE TO authenticated
USING (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recreacao',
    false
  )
)
WITH CHECK (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recreacao',
    false
  )
);

CREATE POLICY "authorized_delete_recreacao_dados"
ON public.recreacao_dados
FOR DELETE TO authenticated
USING (
  public.can_access_operational_participation(
    participacao_id,
    'modulo_recreacao',
    false
  )
);

-- Replace legacy policies that still queried usuarios.permissions and allowed
-- every authenticated account to read every shirt order.
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'camiseta_modelos',
        'camiseta_tamanhos',
        'camiseta_pedidos',
        'camiseta_config_encontro'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.%I',
      v_policy.policyname,
      v_policy.tablename
    );
  END LOOP;
END;
$$;

ALTER TABLE public.camiseta_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camiseta_tamanhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camiseta_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camiseta_config_encontro ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_camiseta_catalog()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'modulo_coordenador');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_camiseta_catalog()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_compras');
$$;

CREATE OR REPLACE FUNCTION public.can_access_camiseta_order(
  p_participacao_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    public.can_manage_camiseta_catalog()
    OR (
      public.has_permission(auth.uid(), 'modulo_coordenador')
      AND EXISTS (
        SELECT 1
        FROM public.participacoes p
        WHERE p.id = p_participacao_id
          AND p.equipe_id IS NOT NULL
          AND public.is_coordenador_da_equipe(
            p.encontro_id,
            p.equipe_id,
            auth.uid()
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_camiseta_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_camiseta_catalog() FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_camiseta_catalog() TO authenticated;

REVOKE ALL ON FUNCTION public.can_manage_camiseta_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_camiseta_catalog() FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_camiseta_catalog() TO authenticated;

REVOKE ALL ON FUNCTION public.can_access_camiseta_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_camiseta_order(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_camiseta_order(uuid) TO authenticated;

CREATE POLICY "authorized_read_camiseta_modelos"
ON public.camiseta_modelos
FOR SELECT TO authenticated
USING (public.can_read_camiseta_catalog());

CREATE POLICY "authorized_manage_camiseta_modelos"
ON public.camiseta_modelos
FOR ALL TO authenticated
USING (public.can_manage_camiseta_catalog())
WITH CHECK (public.can_manage_camiseta_catalog());

CREATE POLICY "authorized_read_camiseta_tamanhos"
ON public.camiseta_tamanhos
FOR SELECT TO authenticated
USING (public.can_read_camiseta_catalog());

CREATE POLICY "authorized_manage_camiseta_tamanhos"
ON public.camiseta_tamanhos
FOR ALL TO authenticated
USING (public.can_manage_camiseta_catalog())
WITH CHECK (public.can_manage_camiseta_catalog());

CREATE POLICY "authorized_read_camiseta_config_encontro"
ON public.camiseta_config_encontro
FOR SELECT TO authenticated
USING (public.can_read_camiseta_catalog());

CREATE POLICY "authorized_manage_camiseta_config_encontro"
ON public.camiseta_config_encontro
FOR ALL TO authenticated
USING (public.can_manage_camiseta_catalog())
WITH CHECK (public.can_manage_camiseta_catalog());

CREATE POLICY "authorized_read_camiseta_pedidos"
ON public.camiseta_pedidos
FOR SELECT TO authenticated
USING (public.can_access_camiseta_order(participacao_id));

CREATE POLICY "authorized_manage_camiseta_pedidos"
ON public.camiseta_pedidos
FOR ALL TO authenticated
USING (public.can_access_camiseta_order(participacao_id))
WITH CHECK (public.can_access_camiseta_order(participacao_id));

NOTIFY pgrst, 'reload schema';

COMMIT;
