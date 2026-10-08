-- Permite que a conferência de preferências atribua equipes em lote sem
-- sobrescrever vínculos já definidos. Toda a operação é atômica.

CREATE OR REPLACE FUNCTION public.assign_team_preferences_batch(
  p_encontro_id uuid,
  p_assignments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_assignment record;
  v_participacao public.participacoes%ROWTYPE;
  v_seen_pessoas uuid[] := ARRAY[]::uuid[];
  v_created integer := 0;
  v_updated integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modulo_cadastros')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para atribuir equipes.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.encontros encontro WHERE encontro.id = p_encontro_id
  ) THEN
    RAISE EXCEPTION 'Encontro não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF p_assignments IS NULL
    OR jsonb_typeof(p_assignments) <> 'array'
    OR jsonb_array_length(p_assignments) = 0
    OR jsonb_array_length(p_assignments) > 500 THEN
    RAISE EXCEPTION 'Informe entre 1 e 500 atribuições.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_assignment IN
    SELECT item.pessoa_id, item.equipe_id
    FROM jsonb_to_recordset(p_assignments) AS item(
      pessoa_id uuid,
      equipe_id uuid
    )
  LOOP
    IF v_assignment.pessoa_id IS NULL OR v_assignment.equipe_id IS NULL THEN
      RAISE EXCEPTION 'Pessoa e equipe são obrigatórias em todas as atribuições.'
        USING ERRCODE = '22023';
    END IF;

    IF v_assignment.pessoa_id = ANY(v_seen_pessoas) THEN
      RAISE EXCEPTION 'Cada pessoa pode aparecer apenas uma vez no lote.'
        USING ERRCODE = '22023';
    END IF;
    v_seen_pessoas := array_append(v_seen_pessoas, v_assignment.pessoa_id);

    IF NOT EXISTS (
      SELECT 1 FROM public.pessoas pessoa WHERE pessoa.id = v_assignment.pessoa_id
    ) THEN
      RAISE EXCEPTION 'Pessoa não encontrada.' USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.equipes equipe
      WHERE equipe.id = v_assignment.equipe_id
        AND equipe.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Equipe não encontrada ou indisponível.'
        USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_participacao
    FROM public.participacoes participacao
    WHERE participacao.pessoa_id = v_assignment.pessoa_id
      AND participacao.encontro_id = p_encontro_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_participacao.equipe_id IS NOT NULL THEN
        RAISE EXCEPTION 'Uma ou mais pessoas já possuem equipe no encontro atual.'
          USING ERRCODE = '23505';
      END IF;

      UPDATE public.participacoes
      SET equipe_id = v_assignment.equipe_id
      WHERE id = v_participacao.id;
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO public.participacoes (
        pessoa_id,
        encontro_id,
        equipe_id,
        participante,
        coordenador,
        dados_confirmados,
        pago_taxa
      )
      VALUES (
        v_assignment.pessoa_id,
        p_encontro_id,
        v_assignment.equipe_id,
        false,
        false,
        false,
        false
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_created + v_updated,
    'created', v_created,
    'updated', v_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_team_preferences_batch(uuid, jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_team_preferences_batch(uuid, jsonb)
TO authenticated;

COMMENT ON FUNCTION public.assign_team_preferences_batch(uuid, jsonb) IS
  'Cria vínculos ou preenche equipes ausentes em lote, sem mover pessoas que já possuem equipe.';

NOTIFY pgrst, 'reload schema';
