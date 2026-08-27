CREATE OR REPLACE FUNCTION public.get_pesquisa_encontrista_general_info(p_encontro_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_nome text;
  v_circulos jsonb;
BEGIN
  SELECT encounter.nome INTO v_nome
  FROM public.encontros encounter
  JOIN public.pesquisa_encontrista_config config
    ON config.encontro_id = encounter.id AND config.publicada = true
  WHERE encounter.id = p_encontro_id;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Pesquisa ainda não publicada.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'circulo_id', source.circulo_id,
    'nome', source.nome
  ) ORDER BY source.nome), '[]'::jsonb)
  INTO v_circulos
  FROM (
    SELECT DISTINCT circle.id AS circulo_id, circle.nome
    FROM public.circulo_participacao membership
    JOIN public.circulos circle ON circle.id = membership.circulo_id
    JOIN public.participacoes participation ON participation.id = membership.participacao
    WHERE participation.encontro_id = p_encontro_id
      AND participation.participante = true
      AND membership.mediador = false
      AND circle.deleted_at IS NULL
  ) source;

  RETURN jsonb_build_object(
    'encontro_id', p_encontro_id,
    'encontro_nome', v_nome,
    'circulos', v_circulos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pesquisa_encontrista_circulo_info(
  p_encontro_id uuid,
  p_circulo_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_info jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pesquisa_encontrista_config
    WHERE encontro_id = p_encontro_id AND publicada = true
  ) THEN
    RAISE EXCEPTION 'Pesquisa ainda não publicada.';
  END IF;

  SELECT public.get_circulo_public_info(p_circulo_id, p_encontro_id)::jsonb
    INTO v_info;
  IF jsonb_array_length(COALESCE(v_info -> 'participantes', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Círculo sem encontristas neste encontro.';
  END IF;
  RETURN v_info;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pesquisa_encontrista_general_info(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pesquisa_encontrista_circulo_info(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_encontrista_general_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_encontrista_circulo_info(uuid, bigint) TO anon, authenticated;

COMMENT ON FUNCTION public.get_pesquisa_encontrista_general_info(uuid) IS
  'Lista somente círculos com encontristas quando a pesquisa do encontro está publicada.';
COMMENT ON FUNCTION public.get_pesquisa_encontrista_circulo_info(uuid, bigint) IS
  'Retorna integrantes do círculo escolhido somente durante a publicação da pesquisa.';
