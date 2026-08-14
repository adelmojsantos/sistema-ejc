-- Remove um encontreiro do encontro de forma transacional, inclusive quando
-- ele integra uma dupla de visitação. A FK restritiva permanece como proteção
-- para exclusões feitas fora deste fluxo autorizado.

CREATE OR REPLACE FUNCTION public.desvincular_integrante_encontro(
  p_participacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_participacao public.participacoes%ROWTYPE;
  v_encontro_ativo boolean;
  v_autorizado boolean;
  v_vinculos_visita integer;
  v_grupos_afetados uuid[];
BEGIN
  SELECT *
  INTO v_participacao
  FROM public.participacoes
  WHERE id = p_participacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participação não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_participacao.participante, false) THEN
    RAISE EXCEPTION 'Encontristas devem ser cancelados pelo fluxo de cancelamento de participação'
      USING ERRCODE = '22023';
  END IF;

  IF v_participacao.equipe_id IS NULL THEN
    RAISE EXCEPTION 'O encontreiro não está vinculado a uma equipe'
      USING ERRCODE = '22023';
  END IF;

  SELECT encontro.ativo
  INTO v_encontro_ativo
  FROM public.encontros encontro
  WHERE encontro.id = v_participacao.encontro_id;

  IF COALESCE(v_encontro_ativo, false) = false THEN
    RAISE EXCEPTION 'Integrantes só podem ser desvinculados do encontro ativo'
      USING ERRCODE = '22023';
  END IF;

  v_autorizado := public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_secretaria')
    OR public.has_permission(auth.uid(), 'modulo_cadastros')
    OR (
      public.has_permission(auth.uid(), 'modulo_coordenador')
      AND public.is_coordenador_da_equipe(
        v_participacao.encontro_id,
        v_participacao.equipe_id,
        auth.uid()
      )
    );

  IF NOT COALESCE(v_autorizado, false) THEN
    RAISE EXCEPTION 'Você não possui permissão para desvincular este integrante'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    count(*)::integer,
    array_agg(DISTINCT link.grupo_id) FILTER (WHERE link.grupo_id IS NOT NULL)
  INTO v_vinculos_visita, v_grupos_afetados
  FROM public.visita_participacao link
  WHERE link.participacao_id = v_participacao.id;

  DELETE FROM public.visita_participacao
  WHERE participacao_id = v_participacao.id;

  DELETE FROM public.participacoes
  WHERE id = v_participacao.id;

  RETURN jsonb_build_object(
    'participacao_id', v_participacao.id,
    'vinculos_visita_removidos', v_vinculos_visita,
    'grupos_visita_afetados', to_jsonb(COALESCE(v_grupos_afetados, ARRAY[]::uuid[]))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.desvincular_integrante_encontro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desvincular_integrante_encontro(uuid) TO authenticated;

COMMENT ON FUNCTION public.desvincular_integrante_encontro(uuid) IS
  'Desvincula um encontreiro do encontro ativo e remove antes seus vínculos operacionais de visitação.';
