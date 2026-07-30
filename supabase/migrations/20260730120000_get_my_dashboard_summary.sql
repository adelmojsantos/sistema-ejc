-- Operational dashboard summary.
-- Returns counts only and applies the same encounter-scoped authorization used
-- by the application. SECURITY DEFINER prevents the frontend from needing broad
-- SELECT access to operational tables.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_dashboard_summary(
  p_encontro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_metrics jsonb := '{}'::jsonb;
  v_count integer;
  v_team_id uuid;
  v_team_name text;
  v_participacao_id uuid;
  v_team_members_pending integer := 0;
  v_team_members_total integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.encontros e
    WHERE e.id = p_encontro_id
      AND e.ativo = true
  ) THEN
    RAISE EXCEPTION 'O dashboard está disponível somente para o encontro ativo.'
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.is_admin(v_user_id);

  -- Dirigentes and administrators receive a deliberately small cross-module
  -- overview instead of inheriting every operational card.
  IF v_is_admin THEN
    SELECT count(*)::integer
    INTO v_count
    FROM public.lista_espera le
    WHERE le.encontro_id = p_encontro_id
      AND le.status = 'pendente';
    v_metrics := v_metrics || jsonb_build_object('waitlist_pending', v_count);

    SELECT count(*)::integer
    INTO v_count
    FROM public.equipes eq
    WHERE eq.deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.participacoes p
        WHERE p.encontro_id = p_encontro_id
          AND p.equipe_id = eq.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.equipe_confirmacoes ec
        WHERE ec.encontro_id = p_encontro_id
          AND ec.equipe_id = eq.id
      );
    v_metrics := v_metrics || jsonb_build_object('teams_confirmation_pending', v_count);

    SELECT count(*)::integer
    INTO v_count
    FROM public.participacoes p
    WHERE p.encontro_id = p_encontro_id
      AND p.participante = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.visita_participacao vp
        WHERE vp.participacao_id = p.id
          AND vp.visitante = false
      );
    v_metrics := v_metrics || jsonb_build_object('unpaired_encontristas', v_count);

    SELECT count(*)::integer
    INTO v_count
    FROM public.almoxarifado_compras ac
    WHERE ac.encontro_id = p_encontro_id
      AND ac.status = 'aberta';
    v_metrics := v_metrics || jsonb_build_object('open_purchases', v_count);

    RETURN jsonb_build_object(
      'encontro_id', p_encontro_id,
      'mode', 'admin',
      'metrics', v_metrics
    );
  END IF;

  SELECT
    p.id,
    p.equipe_id,
    eq.nome
  INTO
    v_participacao_id,
    v_team_id,
    v_team_name
  FROM public.profiles pr
  JOIN public.pessoas pe
    ON lower(pe.email) = lower(pr.email)
  JOIN public.participacoes p
    ON p.pessoa_id = pe.id
   AND p.encontro_id = p_encontro_id
  LEFT JOIN public.equipes eq ON eq.id = p.equipe_id
  WHERE pr.id = v_user_id
  ORDER BY p.coordenador DESC, p.created_at DESC
  LIMIT 1;

  IF public.has_permission(v_user_id, 'modulo_coordenador')
     AND v_team_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.participacoes coordinator
       WHERE coordinator.id = v_participacao_id
         AND coordinator.coordenador = true
     ) THEN
    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE COALESCE(p.dados_confirmados, false) = false)::integer
    INTO
      v_team_members_total,
      v_team_members_pending
    FROM public.participacoes p
    WHERE p.encontro_id = p_encontro_id
      AND p.equipe_id = v_team_id;

    v_metrics := v_metrics || jsonb_build_object(
      'team_members_pending',
      v_team_members_pending
    );

    IF v_team_members_total > 0
       AND v_team_members_pending = 0
       AND NOT EXISTS (
         SELECT 1
         FROM public.equipe_confirmacoes ec
         WHERE ec.encontro_id = p_encontro_id
           AND ec.equipe_id = v_team_id
       ) THEN
      v_metrics := v_metrics || jsonb_build_object('team_finalize_pending', 1);
    ELSE
      v_metrics := v_metrics || jsonb_build_object('team_finalize_pending', 0);
    END IF;

    SELECT count(*)::integer
    INTO v_count
    FROM public.participacoes p
    WHERE p.encontro_id = p_encontro_id
      AND p.equipe_id = v_team_id
      AND COALESCE(p.pago_taxa, false) = false;
    v_metrics := v_metrics || jsonb_build_object('team_fees_pending', v_count);

    SELECT count(DISTINCT p.id)::integer
    INTO v_count
    FROM public.participacoes p
    WHERE p.encontro_id = p_encontro_id
      AND p.equipe_id = v_team_id
      AND COALESCE(p.pago_camiseta, false) = false
      AND EXISTS (
        SELECT 1
        FROM public.camiseta_pedidos cp
        WHERE cp.participacao_id = p.id
      );
    v_metrics := v_metrics || jsonb_build_object('team_shirts_pending', v_count);

    IF EXISTS (
      SELECT 1
      FROM public.pesquisa_satisfacao_config psc
      WHERE psc.encontro_id = p_encontro_id
        AND psc.publicada = true
    ) THEN
      SELECT count(*)::integer
      INTO v_count
      FROM public.participacoes p
      WHERE p.encontro_id = p_encontro_id
        AND p.equipe_id = v_team_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.pesquisa_satisfacao_envios pse
          WHERE pse.encontro_id = p_encontro_id
            AND pse.participacao_id = p.id
            AND pse.status = 'enviado'
        );
      v_metrics := v_metrics || jsonb_build_object('team_evaluations_pending', v_count);
    END IF;
  END IF;

  IF public.has_permission(v_user_id, 'modulo_secretaria') THEN
    SELECT count(*)::integer
    INTO v_count
    FROM public.lista_espera le
    WHERE le.encontro_id = p_encontro_id
      AND le.status = 'pendente';
    v_metrics := v_metrics || jsonb_build_object('waitlist_pending', v_count);

    SELECT count(*)::integer
    INTO v_count
    FROM public.equipes eq
    WHERE eq.deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.participacoes p
        WHERE p.encontro_id = p_encontro_id
          AND p.equipe_id = eq.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.equipe_confirmacoes ec
        WHERE ec.encontro_id = p_encontro_id
          AND ec.equipe_id = eq.id
      );
    v_metrics := v_metrics || jsonb_build_object('teams_confirmation_pending', v_count);
  END IF;

  IF public.has_permission(v_user_id, 'modulo_visitacao_coordenar') THEN
    SELECT count(*)::integer
    INTO v_count
    FROM public.participacoes p
    WHERE p.encontro_id = p_encontro_id
      AND p.participante = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.visita_participacao vp
        WHERE vp.participacao_id = p.id
          AND vp.visitante = false
      );
    v_metrics := v_metrics || jsonb_build_object('unpaired_encontristas', v_count);

    SELECT count(*)::integer
    INTO v_count
    FROM public.visita_participacao vp
    JOIN public.participacoes p ON p.id = vp.participacao_id
    WHERE p.encontro_id = p_encontro_id
      AND vp.visitante = false
      AND vp.status = 'pendente';
    v_metrics := v_metrics || jsonb_build_object('visits_pending', v_count);

    SELECT count(*)::integer
    INTO v_count
    FROM public.visita_participacao vp
    JOIN public.participacoes p ON p.id = vp.participacao_id
    WHERE p.encontro_id = p_encontro_id
      AND vp.visitante = false
      AND vp.status = 'ausente';
    v_metrics := v_metrics || jsonb_build_object('visits_absent', v_count);

    SELECT count(*)::integer
    INTO v_count
    FROM public.visita_participacao vp
    JOIN public.participacoes p ON p.id = vp.participacao_id
    JOIN public.pessoas pe ON pe.id = p.pessoa_id
    WHERE p.encontro_id = p_encontro_id
      AND vp.visitante = false
      AND (
        btrim(COALESCE(pe.endereco, '')) = ''
        OR pe.latitude IS NULL
        OR pe.longitude IS NULL
      );
    v_metrics := v_metrics || jsonb_build_object('visits_without_location', v_count);
  ELSIF public.has_permission(v_user_id, 'modulo_visitacao_duplas')
        AND v_participacao_id IS NOT NULL THEN
    SELECT count(*)::integer
    INTO v_count
    FROM public.visita_participacao vp
    JOIN public.participacoes p ON p.id = vp.participacao_id
    WHERE p.encontro_id = p_encontro_id
      AND vp.visitante = false
      AND vp.status = 'pendente'
      AND EXISTS (
        SELECT 1
        FROM public.visita_participacao mine
        WHERE mine.participacao_id = v_participacao_id
          AND mine.visitante = true
          AND mine.grupo_id = vp.grupo_id
      );
    v_metrics := v_metrics || jsonb_build_object('duo_visits_pending', v_count);

    SELECT count(*)::integer
    INTO v_count
    FROM public.visita_participacao vp
    JOIN public.participacoes p ON p.id = vp.participacao_id
    WHERE p.encontro_id = p_encontro_id
      AND vp.visitante = false
      AND vp.status = 'ausente'
      AND EXISTS (
        SELECT 1
        FROM public.visita_participacao mine
        WHERE mine.participacao_id = v_participacao_id
          AND mine.visitante = true
          AND mine.grupo_id = vp.grupo_id
      );
    v_metrics := v_metrics || jsonb_build_object('duo_visits_absent', v_count);

    SELECT count(*)::integer
    INTO v_count
    FROM public.visita_participacao vp
    JOIN public.participacoes p ON p.id = vp.participacao_id
    WHERE p.encontro_id = p_encontro_id
      AND vp.visitante = false
      AND COALESCE(vp.taxa_paga, false) = false
      AND EXISTS (
        SELECT 1
        FROM public.visita_participacao mine
        WHERE mine.participacao_id = v_participacao_id
          AND mine.visitante = true
          AND mine.grupo_id = vp.grupo_id
      );
    v_metrics := v_metrics || jsonb_build_object('duo_fees_pending', v_count);
  END IF;

  IF public.has_permission(v_user_id, 'modulo_coordenador')
     AND lower(COALESCE(v_team_name, '')) LIKE '%cozinha%' THEN
    SELECT count(DISTINCT ep.participacao_id)::integer
    INTO v_count
    FROM public.encontro_presencas ep
    WHERE ep.encontro_id = p_encontro_id
      AND ep.data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND ep.presente = true
      AND EXISTS (
        SELECT 1
        FROM public.visita_participacao vp
        WHERE vp.participacao_id = ep.participacao_id
          AND vp.visitante = false
      );
    v_metrics := v_metrics || jsonb_build_object('kitchen_present_today', v_count);
  END IF;

  RETURN jsonb_build_object(
    'encontro_id', p_encontro_id,
    'mode', 'operational',
    'metrics', v_metrics
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_dashboard_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_dashboard_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_dashboard_summary(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_my_dashboard_summary(uuid) IS
  'Returns encounter-scoped operational counts authorized for the current user, without personal data.';

NOTIFY pgrst, 'reload schema';

COMMIT;
