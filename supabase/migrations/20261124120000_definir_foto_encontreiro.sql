-- Permite que coordenadores registrem a foto individual dos encontreiros da
-- própria equipe. A foto fica na participação (por encontro) e é exibida no
-- Quadrante, que já lê participacoes.foto_url pelo payload público.
--
-- A escrita passa por esta função para não ampliar a policy de UPDATE da
-- tabela participacoes: somente foto_url e foto_posicao_y são alterados.

CREATE OR REPLACE FUNCTION public.definir_foto_encontreiro(
  p_participacao_id uuid,
  p_foto_url text,
  p_foto_posicao_y integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_participacao public.participacoes%ROWTYPE;
  v_encontro_ativo boolean;
  v_gestor boolean;
  v_coordenador boolean;
  v_foto_url text := NULLIF(btrim(p_foto_url), '');
  v_posicao integer := COALESCE(p_foto_posicao_y, 50);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE = '42501';
  END IF;

  IF v_foto_url IS NOT NULL
    AND (v_foto_url !~ '^https://[^[:space:]]+$' OR length(v_foto_url) > 2048) THEN
    RAISE EXCEPTION 'Endereço da foto inválido' USING ERRCODE = '22023';
  END IF;

  IF v_posicao < 0 OR v_posicao > 100 THEN
    RAISE EXCEPTION 'Enquadramento da foto deve estar entre 0 e 100' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_participacao
  FROM public.participacoes
  WHERE id = p_participacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participação não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_participacao.participante, false) THEN
    RAISE EXCEPTION 'A foto de encontristas é gerenciada pela Secretaria'
      USING ERRCODE = '22023';
  END IF;

  IF v_participacao.equipe_id IS NULL THEN
    RAISE EXCEPTION 'O encontreiro não está vinculado a uma equipe'
      USING ERRCODE = '22023';
  END IF;

  v_gestor := public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_secretaria')
    OR public.has_permission(auth.uid(), 'modulo_cadastros');

  v_coordenador := public.has_permission(auth.uid(), 'modulo_coordenador')
    AND public.is_coordenador_da_equipe(
      v_participacao.encontro_id,
      v_participacao.equipe_id,
      auth.uid()
    );

  IF NOT COALESCE(v_gestor, false) AND NOT COALESCE(v_coordenador, false) THEN
    RAISE EXCEPTION 'Você não possui permissão para alterar a foto deste integrante'
      USING ERRCODE = '42501';
  END IF;

  IF NOT COALESCE(v_gestor, false) THEN
    SELECT encontro.ativo
    INTO v_encontro_ativo
    FROM public.encontros encontro
    WHERE encontro.id = v_participacao.encontro_id;

    IF COALESCE(v_encontro_ativo, false) = false THEN
      RAISE EXCEPTION 'A foto só pode ser alterada no encontro ativo'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.participacoes
  SET foto_url = v_foto_url,
      foto_posicao_y = CASE WHEN v_foto_url IS NULL THEN 50 ELSE v_posicao END
  WHERE id = v_participacao.id;

  RETURN jsonb_build_object(
    'participacao_id', v_participacao.id,
    'foto_url', v_foto_url,
    'foto_posicao_y', CASE WHEN v_foto_url IS NULL THEN 50 ELSE v_posicao END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.definir_foto_encontreiro(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_foto_encontreiro(uuid, text, integer) TO authenticated;

COMMENT ON FUNCTION public.definir_foto_encontreiro(uuid, text, integer) IS
  'Define, ajusta ou remove a foto individual de um encontreiro. Coordenadores só alteram a própria equipe no encontro ativo.';
