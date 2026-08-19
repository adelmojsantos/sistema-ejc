-- Persist address and geolocation quality as one protected operation.

BEGIN;

CREATE OR REPLACE FUNCTION public.atualizar_endereco_visitacao_v2(
  p_participacao_id uuid,
  p_endereco jsonb
)
RETURNS public.pessoas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_pessoa_id uuid;
  v_pessoa public.pessoas%ROWTYPE;
BEGIN
  IF p_endereco IS NULL OR jsonb_typeof(p_endereco) <> 'object' THEN
    RAISE EXCEPTION 'Dados de endereço inválidos.';
  END IF;

  SELECT p.pessoa_id
  INTO v_pessoa_id
  FROM public.participacoes p
  WHERE p.id = p_participacao_id
    AND p.participante = true;

  IF v_pessoa_id IS NULL THEN
    RAISE EXCEPTION 'Participação de encontrista não encontrada.';
  END IF;

  IF NOT public.can_access_operational_participation(
    p_participacao_id,
    'modulo_visitacao',
    true
  ) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar o endereço deste encontrista.';
  END IF;

  UPDATE public.pessoas
  SET
    endereco = NULLIF(BTRIM(p_endereco ->> 'endereco'), ''),
    numero = NULLIF(BTRIM(p_endereco ->> 'numero'), ''),
    complemento = NULLIF(BTRIM(p_endereco ->> 'complemento'), ''),
    cep = NULLIF(regexp_replace(COALESCE(p_endereco ->> 'cep', ''), '\D', '', 'g'), ''),
    bairro = NULLIF(BTRIM(p_endereco ->> 'bairro'), ''),
    cidade = NULLIF(BTRIM(p_endereco ->> 'cidade'), ''),
    estado = NULLIF(upper(BTRIM(p_endereco ->> 'estado')), ''),
    latitude = NULLIF(p_endereco ->> 'latitude', '')::numeric,
    longitude = NULLIF(p_endereco ->> 'longitude', '')::numeric,
    geo_status = COALESCE(NULLIF(p_endereco ->> 'geo_status', ''), 'pending'),
    geo_source = NULLIF(p_endereco ->> 'geo_source', ''),
    geo_precision = NULLIF(p_endereco ->> 'geo_precision', ''),
    geo_accuracy_m = NULLIF(p_endereco ->> 'geo_accuracy_m', '')::numeric,
    geo_address_fingerprint = NULLIF(p_endereco ->> 'geo_address_fingerprint', ''),
    geo_checked_at = NULLIF(p_endereco ->> 'geo_checked_at', '')::timestamptz,
    geo_verified_at = NULLIF(p_endereco ->> 'geo_verified_at', '')::timestamptz,
    geo_verified_by = CASE
      WHEN p_endereco ->> 'geo_source' IN ('gps', 'manual') THEN auth.uid()
      ELSE NULL
    END,
    geo_failure_code = NULLIF(p_endereco ->> 'geo_failure_code', ''),
    geo_retry_count = COALESCE(NULLIF(p_endereco ->> 'geo_retry_count', '')::integer, 0),
    geo_next_retry_at = NULLIF(p_endereco ->> 'geo_next_retry_at', '')::timestamptz
  WHERE id = v_pessoa_id
  RETURNING * INTO v_pessoa;

  RETURN v_pessoa;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_endereco_visitacao_v2(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_endereco_visitacao_v2(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.atualizar_endereco_visitacao_v2(uuid, jsonb) IS
'Atualiza endereço e metadados de qualidade geográfica de forma atômica, respeitando o escopo operacional da Visitação.';

CREATE OR REPLACE FUNCTION public.salvar_visita_completa_v2(
  p_visita_id uuid,
  p_dados jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  v_resultado := public.salvar_visita_completa(p_visita_id, p_dados);

  PERFORM public.atualizar_endereco_visitacao_v2(
    (v_resultado ->> 'participacao_id')::uuid,
    p_dados -> 'pessoa'
  );

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_visita_completa_v2(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_visita_completa_v2(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.salvar_visita_completa_v2(uuid, jsonb) IS
'Salva a visita e, na mesma transação, persiste a qualidade da geolocalização do endereço.';

COMMIT;
