-- Corrige a atribuição do status textual recebido pela RPC à coluna enum.
-- A validação de domínio continua ocorrendo antes do cast.

BEGIN;

CREATE OR REPLACE FUNCTION public.salvar_visita_completa_impl(
  p_visita_id uuid,
  p_dados jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_visita public.visita_participacao%ROWTYPE;
  v_pessoa_id uuid;
  v_status text := NULLIF(BTRIM(p_dados ->> 'status'), '');
  v_intencao jsonb;
  v_intencao_id uuid;
  v_intencao_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT vp.*
  INTO v_visita
  FROM public.visita_participacao vp
  JOIN public.participacoes p ON p.id = vp.participacao_id
  JOIN public.encontros e ON e.id = p.encontro_id
  WHERE vp.id = p_visita_id
    AND vp.visitante = false
    AND p.participante = true
    AND e.ativo = true
  FOR UPDATE OF vp, p;

  IF v_visita.id IS NULL THEN
    RAISE EXCEPTION 'Visita de encontrista não encontrada.';
  END IF;

  SELECT pessoa_id
  INTO v_pessoa_id
  FROM public.participacoes
  WHERE id = v_visita.participacao_id
  FOR UPDATE;

  IF NOT public.can_access_operational_participation(
    v_visita.participacao_id,
    'modulo_visitacao',
    true
  ) THEN
    RAISE EXCEPTION 'Sem permissão para salvar esta visita.';
  END IF;

  IF v_status NOT IN ('pendente', 'realizada', 'ausente', 'cancelada') THEN
    RAISE EXCEPTION 'Status da visita inválido.';
  END IF;

  UPDATE public.visita_participacao
  SET
    status = v_status::public.visita_status,
    observacoes = NULLIF(BTRIM(p_dados ->> 'observacoes'), ''),
    foto_familia_url = NULLIF(BTRIM(p_dados ->> 'foto_familia_url'), ''),
    taxa_paga = COALESCE((p_dados ->> 'taxa_paga')::boolean, false),
    data_visita = CASE
      WHEN v_status = 'realizada' THEN COALESCE(NULLIF(p_dados ->> 'data_visita', '')::timestamptz, now())
      ELSE NULLIF(p_dados ->> 'data_visita', '')::timestamptz
    END
  WHERE id = p_visita_id;

  UPDATE public.participacoes
  SET foto_url = NULLIF(BTRIM(p_dados ->> 'foto_participacao_url'), '')
  WHERE id = v_visita.participacao_id;

  UPDATE public.pessoas
  SET
    nome_completo = NULLIF(BTRIM(p_dados #>> '{pessoa,nome_completo}'), ''),
    telefone = regexp_replace(COALESCE(p_dados #>> '{pessoa,telefone}', ''), '\\D', '', 'g'),
    endereco = NULLIF(BTRIM(p_dados #>> '{pessoa,endereco}'), ''),
    numero = NULLIF(BTRIM(p_dados #>> '{pessoa,numero}'), ''),
    complemento = NULLIF(BTRIM(p_dados #>> '{pessoa,complemento}'), ''),
    cep = NULLIF(regexp_replace(COALESCE(p_dados #>> '{pessoa,cep}', ''), '\\D', '', 'g'), ''),
    bairro = NULLIF(BTRIM(p_dados #>> '{pessoa,bairro}'), ''),
    cidade = NULLIF(BTRIM(p_dados #>> '{pessoa,cidade}'), ''),
    estado = NULLIF(BTRIM(p_dados #>> '{pessoa,estado}'), ''),
    latitude = NULLIF(p_dados #>> '{pessoa,latitude}', '')::numeric,
    longitude = NULLIF(p_dados #>> '{pessoa,longitude}', '')::numeric,
    data_nascimento = NULLIF(p_dados #>> '{pessoa,data_nascimento}', '')::date,
    nome_pai = NULLIF(BTRIM(p_dados #>> '{pessoa,nome_pai}'), ''),
    telefone_pai = NULLIF(regexp_replace(COALESCE(p_dados #>> '{pessoa,telefone_pai}', ''), '\\D', '', 'g'), ''),
    nome_mae = NULLIF(BTRIM(p_dados #>> '{pessoa,nome_mae}'), ''),
    telefone_mae = NULLIF(regexp_replace(COALESCE(p_dados #>> '{pessoa,telefone_mae}', ''), '\\D', '', 'g'), ''),
    restricao_alimentar = NULLIF(BTRIM(p_dados #>> '{pessoa,restricao_alimentar}'), ''),
    medicamento_continuo = NULLIF(BTRIM(p_dados #>> '{pessoa,medicamento_continuo}'), ''),
    alergia = NULLIF(BTRIM(p_dados #>> '{pessoa,alergia}'), ''),
    observacoes_saude = NULLIF(BTRIM(p_dados #>> '{pessoa,observacoes_saude}'), ''),
    possui_restricao_alimentar = NULLIF(p_dados #>> '{pessoa,possui_restricao_alimentar}', '')::boolean,
    possui_alergia = NULLIF(p_dados #>> '{pessoa,possui_alergia}', '')::boolean,
    usa_medicamento_continuo = NULLIF(p_dados #>> '{pessoa,usa_medicamento_continuo}', '')::boolean,
    possui_observacao_saude = NULLIF(p_dados #>> '{pessoa,possui_observacao_saude}', '')::boolean
  WHERE id = v_pessoa_id;

  FOR v_intencao IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_dados -> 'intencoes', '[]'::jsonb))
  LOOP
    IF NULLIF(v_intencao ->> 'modelo_id', '') IS NULL
       OR NULLIF(BTRIM(v_intencao ->> 'tamanho'), '') IS NULL
       OR COALESCE(NULLIF(v_intencao ->> 'quantidade', '')::integer, 0) < 1 THEN
      RAISE EXCEPTION 'Intenção de camiseta inválida.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.camiseta_modelos
      WHERE id = (v_intencao ->> 'modelo_id')::uuid
    ) THEN
      RAISE EXCEPTION 'Modelo de camiseta inválido.';
    END IF;

    IF NULLIF(v_intencao ->> 'id', '') IS NOT NULL THEN
      UPDATE public.visita_intencao_camiseta
      SET
        modelo_id = (v_intencao ->> 'modelo_id')::uuid,
        tamanho = BTRIM(v_intencao ->> 'tamanho'),
        quantidade = (v_intencao ->> 'quantidade')::integer
      WHERE id = (v_intencao ->> 'id')::uuid
        AND visita_id = p_visita_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Intenção de camiseta não encontrada.';
      END IF;

      v_intencao_ids := array_append(
        v_intencao_ids,
        (v_intencao ->> 'id')::uuid
      );
    ELSE
      INSERT INTO public.visita_intencao_camiseta (
        visita_id,
        modelo_id,
        tamanho,
        quantidade
      )
      VALUES (
        p_visita_id,
        (v_intencao ->> 'modelo_id')::uuid,
        BTRIM(v_intencao ->> 'tamanho'),
        (v_intencao ->> 'quantidade')::integer
      )
      RETURNING id INTO v_intencao_id;

      v_intencao_ids := array_append(v_intencao_ids, v_intencao_id);
    END IF;
  END LOOP;

  DELETE FROM public.visita_intencao_camiseta
  WHERE visita_id = p_visita_id
    AND NOT (id = ANY(v_intencao_ids));

  RETURN jsonb_build_object(
    'visita_id', p_visita_id,
    'participacao_id', v_visita.participacao_id,
    'pessoa_id', v_pessoa_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_visita_completa_impl(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_visita_completa_impl(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.salvar_visita_completa_impl(uuid, jsonb) FROM authenticated;

COMMENT ON FUNCTION public.salvar_visita_completa_impl(uuid, jsonb) IS
'Implementação interna e transacional do salvamento da visita; executada somente pela RPC pública validada.';

COMMIT;
