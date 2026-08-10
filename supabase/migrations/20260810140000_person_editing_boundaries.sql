-- Keep people edits aligned with the operational responsibility of each module.
-- The RPCs deliberately receive only the fields each flow is allowed to change.

BEGIN;

CREATE OR REPLACE FUNCTION public.atualizar_endereco_visitacao(
  p_participacao_id uuid,
  p_endereco text,
  p_numero text,
  p_complemento text,
  p_cep text,
  p_bairro text,
  p_cidade text,
  p_estado text,
  p_latitude numeric,
  p_longitude numeric
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
    endereco = NULLIF(BTRIM(p_endereco), ''),
    numero = NULLIF(BTRIM(p_numero), ''),
    complemento = NULLIF(BTRIM(p_complemento), ''),
    cep = NULLIF(regexp_replace(COALESCE(p_cep, ''), '\\D', '', 'g'), ''),
    bairro = NULLIF(BTRIM(p_bairro), ''),
    cidade = NULLIF(BTRIM(p_cidade), ''),
    estado = NULLIF(BTRIM(p_estado), ''),
    latitude = p_latitude,
    longitude = p_longitude
  WHERE id = v_pessoa_id
  RETURNING * INTO v_pessoa;

  RETURN v_pessoa;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_dados_integrante_equipe(
  p_participacao_id uuid
)
RETURNS public.participacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_participacao public.participacoes%ROWTYPE;
BEGIN
  SELECT p.*
  INTO v_participacao
  FROM public.participacoes p
  WHERE p.id = p_participacao_id
    AND p.participante = false
    AND p.equipe_id IS NOT NULL;

  IF v_participacao.id IS NULL THEN
    RAISE EXCEPTION 'A confirmação é exclusiva para integrantes de equipe.';
  END IF;

  IF NOT (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_secretaria')
    OR (
      public.has_permission(auth.uid(), 'modulo_coordenador')
      AND public.is_coordenador_da_equipe(
        v_participacao.encontro_id,
        v_participacao.equipe_id,
        auth.uid()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar os dados deste integrante.';
  END IF;

  UPDATE public.participacoes
  SET
    dados_confirmados = true,
    confirmado_em = now()
  WHERE id = p_participacao_id
  RETURNING * INTO v_participacao;

  RETURN v_participacao;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_endereco_visitacao(uuid, text, text, text, text, text, text, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_dados_integrante_equipe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_endereco_visitacao(uuid, text, text, text, text, text, text, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_dados_integrante_equipe(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
