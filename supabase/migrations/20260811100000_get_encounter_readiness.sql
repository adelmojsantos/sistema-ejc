-- Read-only preparation summary for the active encounter.
-- The RPC returns only aggregate counts and configuration flags, without
-- exposing personal or health data from the underlying modules.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_encounter_readiness(
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
  v_encontro public.encontros%ROWTYPE;
  v_metrics jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_admin(v_user_id) THEN
    RAISE EXCEPTION 'Apenas administradores e dirigentes podem consultar a preparação do encontro.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_encontro
  FROM public.encontros
  WHERE id = p_encontro_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Encontro não encontrado.'
      USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_encontro.ativo, false) = false THEN
    RAISE EXCEPTION 'O painel de preparação está disponível somente para o encontro ativo.'
      USING ERRCODE = '22023';
  END IF;

  v_metrics := v_metrics || jsonb_build_object(
    'basic_configured',
      v_encontro.data_inicio IS NOT NULL
      AND v_encontro.data_fim IS NOT NULL
      AND btrim(COALESCE(v_encontro.local, '')) <> '',
    'fee_configured',
      COALESCE(v_encontro.valor_taxa, 0) > 0
      AND btrim(COALESCE(v_encontro.pix_taxa_chave, '')) <> '',
    'public_forms_published', COALESCE(v_encontro.formulario_publico_ativo, false),
    'quadrante_published',
      COALESCE(v_encontro.quadrante_ativo, false)
      AND v_encontro.quadrante_token IS NOT NULL
  );

  SELECT count(*)::integer
    INTO v_count
  FROM public.camiseta_config_encontro config
  WHERE config.encontro_id = p_encontro_id
    AND config.ativo = true
    AND config.valor > 0;
  v_metrics := v_metrics || jsonb_build_object('active_shirt_models', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.equipes team
  WHERE team.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.participacoes participation
      WHERE participation.encontro_id = p_encontro_id
        AND participation.equipe_id = team.id
    );
  v_metrics := v_metrics || jsonb_build_object('teams_total', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.equipes team
  WHERE team.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.participacoes participation
      WHERE participation.encontro_id = p_encontro_id
        AND participation.equipe_id = team.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.equipe_confirmacoes confirmation
      WHERE confirmation.encontro_id = p_encontro_id
        AND confirmation.equipe_id = team.id
    );
  v_metrics := v_metrics || jsonb_build_object('teams_confirmation_pending', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.lista_espera registration
  WHERE registration.encontro_id = p_encontro_id
    AND registration.status = 'pendente';
  v_metrics := v_metrics || jsonb_build_object('waitlist_pending', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.participacoes participation
  WHERE participation.encontro_id = p_encontro_id
    AND participation.participante = true;
  v_metrics := v_metrics || jsonb_build_object('encontristas_total', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.participacoes participation
  JOIN public.pessoas person ON person.id = participation.pessoa_id
  WHERE participation.encontro_id = p_encontro_id
    AND participation.participante = true
    AND (
      btrim(COALESCE(person.endereco, '')) = ''
      OR person.latitude IS NULL
      OR person.longitude IS NULL
    );
  v_metrics := v_metrics || jsonb_build_object('encontristas_without_location', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.participacoes participation
  WHERE participation.encontro_id = p_encontro_id
    AND participation.participante = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.visita_participacao visit
      WHERE visit.participacao_id = participation.id
        AND visit.visitante = false
        AND btrim(COALESCE(visit.foto_url, '')) <> ''
    );
  v_metrics := v_metrics || jsonb_build_object('encontristas_without_photo', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.participacoes participation
  WHERE participation.encontro_id = p_encontro_id
    AND participation.participante = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.visita_participacao visit
      WHERE visit.participacao_id = participation.id
        AND visit.visitante = false
    );
  v_metrics := v_metrics || jsonb_build_object('encontristas_without_visitation_group', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.participacoes participation
  WHERE participation.encontro_id = p_encontro_id
    AND participation.participante = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.circulo_participacao circle_link
      WHERE circle_link.participacao = participation.id
    );
  v_metrics := v_metrics || jsonb_build_object('encontristas_without_circle', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.encontro_cronograma schedule
  WHERE schedule.encontro_id = p_encontro_id;
  v_metrics := v_metrics || jsonb_build_object('schedule_items', v_count);

  v_metrics := v_metrics || jsonb_build_object(
    'team_evaluation_published', EXISTS (
      SELECT 1
      FROM public.pesquisa_satisfacao_config config
      WHERE config.encontro_id = p_encontro_id
        AND config.publicada = true
    ),
    'encontrista_evaluation_published', EXISTS (
      SELECT 1
      FROM public.pesquisa_encontrista_config config
      WHERE config.encontro_id = p_encontro_id
        AND config.publicada = true
    )
  );

  SELECT count(*)::integer
    INTO v_count
  FROM public.almoxarifado_pedidos request
  WHERE request.encontro_id = p_encontro_id
    AND request.status NOT IN ('finalizado', 'cancelado');
  v_metrics := v_metrics || jsonb_build_object('material_requests_open', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.almoxarifado_compras purchase
  WHERE purchase.encontro_id = p_encontro_id
    AND purchase.status = 'aberta';
  v_metrics := v_metrics || jsonb_build_object('purchases_open', v_count);

  SELECT count(*)::integer
    INTO v_count
  FROM public.pos_encontros post_encounter
  WHERE post_encounter.encontro_id = p_encontro_id
    AND post_encounter.ativo = true;
  v_metrics := v_metrics || jsonb_build_object('post_encounter_items', v_count);

  RETURN jsonb_build_object(
    'encontro_id', p_encontro_id,
    'encontro_nome', v_encontro.nome,
    'metrics', v_metrics
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_encounter_readiness(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_encounter_readiness(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_encounter_readiness(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_encounter_readiness(uuid) IS
  'Returns aggregate, admin-only preparation indicators for the active encounter.';

NOTIFY pgrst, 'reload schema';

COMMIT;
