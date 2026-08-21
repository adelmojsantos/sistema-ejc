BEGIN;

-- A composição das duplas é operacional e não pode reescrever encontros
-- históricos. Os gatilhos protegem também alterações feitas fora das RPCs.
CREATE OR REPLACE FUNCTION public.guard_active_visita_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_encontro_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.encontros encounter
      WHERE encounter.id = OLD.encontro_id AND encounter.ativo = true
    ) OR NOT EXISTS (
      SELECT 1 FROM public.encontros encounter
      WHERE encounter.id = NEW.encontro_id AND encounter.ativo = true
    ) THEN
      RAISE EXCEPTION 'Encontro encerrado: a composição das duplas está disponível apenas para consulta.'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_encontro_id := OLD.encontro_id;
  ELSE
    v_encontro_id := NEW.encontro_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.encontros encounter
    WHERE encounter.id = v_encontro_id
      AND encounter.ativo = true
  ) THEN
    RAISE EXCEPTION 'Encontro encerrado: a composição das duplas está disponível apenas para consulta.'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_active_visita_grupo_lifecycle ON public.visita_grupos;
CREATE TRIGGER guard_active_visita_grupo_lifecycle
BEFORE INSERT OR DELETE ON public.visita_grupos
FOR EACH ROW
EXECUTE FUNCTION public.guard_active_visita_grupo();

DROP TRIGGER IF EXISTS guard_active_visita_grupo_edit ON public.visita_grupos;
CREATE TRIGGER guard_active_visita_grupo_edit
BEFORE UPDATE OF encontro_id, nome, nome_automatico, foto_url ON public.visita_grupos
FOR EACH ROW
WHEN (
  OLD.encontro_id IS DISTINCT FROM NEW.encontro_id
  OR OLD.nome IS DISTINCT FROM NEW.nome
  OR OLD.nome_automatico IS DISTINCT FROM NEW.nome_automatico
  OR OLD.foto_url IS DISTINCT FROM NEW.foto_url
)
EXECUTE FUNCTION public.guard_active_visita_grupo();

CREATE OR REPLACE FUNCTION public.guard_active_visita_participacao_composition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_old_grupo_id uuid;
  v_new_grupo_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_grupo_id := OLD.grupo_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_grupo_id := NEW.grupo_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visita_grupos visit_group
    JOIN public.encontros encounter ON encounter.id = visit_group.encontro_id
    WHERE visit_group.id IN (v_old_grupo_id, v_new_grupo_id)
      AND encounter.ativo IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Encontro encerrado: a composição das duplas está disponível apenas para consulta.'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_active_visita_participacao_lifecycle ON public.visita_participacao;
CREATE TRIGGER guard_active_visita_participacao_lifecycle
BEFORE INSERT OR DELETE ON public.visita_participacao
FOR EACH ROW
EXECUTE FUNCTION public.guard_active_visita_participacao_composition();

DROP TRIGGER IF EXISTS guard_active_visita_participacao_edit ON public.visita_participacao;
CREATE TRIGGER guard_active_visita_participacao_edit
BEFORE UPDATE OF grupo_id, participacao_id, visitante, ordem_visitante, ordem_roteiro ON public.visita_participacao
FOR EACH ROW
WHEN (
  OLD.grupo_id IS DISTINCT FROM NEW.grupo_id
  OR OLD.participacao_id IS DISTINCT FROM NEW.participacao_id
  OR OLD.visitante IS DISTINCT FROM NEW.visitante
  OR OLD.ordem_visitante IS DISTINCT FROM NEW.ordem_visitante
  OR OLD.ordem_roteiro IS DISTINCT FROM NEW.ordem_roteiro
)
EXECUTE FUNCTION public.guard_active_visita_participacao_composition();

-- Nomes automáticos de encontros históricos permanecem congelados, sem
-- impedir a correção do cadastro global da pessoa.
CREATE OR REPLACE FUNCTION public.sync_visita_grupo_nome_from_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_grupo_id uuid;
BEGIN
  IF NEW.nome_completo IS NOT DISTINCT FROM OLD.nome_completo THEN
    RETURN NEW;
  END IF;

  FOR v_grupo_id IN
    SELECT DISTINCT link.grupo_id
    FROM public.participacoes participation
    JOIN public.visita_participacao link
      ON link.participacao_id = participation.id
     AND link.visitante = true
    JOIN public.visita_grupos visit_group
      ON visit_group.id = link.grupo_id
     AND visit_group.nome_automatico = true
    JOIN public.encontros encounter
      ON encounter.id = visit_group.encontro_id
     AND encounter.ativo = true
    WHERE participation.pessoa_id = NEW.id
      AND link.grupo_id IS NOT NULL
  LOOP
    PERFORM public.refresh_visita_grupo_nome(v_grupo_id, false);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_visita_group_participants(
  p_grupo_a_id uuid,
  p_grupo_b_id uuid,
  p_modo text,
  p_vinculo_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_group_count integer;
  v_encounter_count integer;
  v_active boolean;
  v_requested_count integer;
  v_valid_count integer;
  v_moved_a_to_b integer := 0;
  v_moved_b_to_a integer := 0;
BEGIN
  IF NOT public.can_manage_visita_grupos() THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar as duplas de visitação.' USING ERRCODE = '42501';
  END IF;
  IF p_grupo_a_id IS NULL OR p_grupo_b_id IS NULL OR p_grupo_a_id = p_grupo_b_id THEN
    RAISE EXCEPTION 'Selecione duas duplas diferentes.' USING ERRCODE = '22023';
  END IF;
  IF p_modo NOT IN ('individual', 'mover_todos', 'swap_completo') THEN
    RAISE EXCEPTION 'Modo de troca inválido.' USING ERRCODE = '22023';
  END IF;

  -- A ordem estável evita deadlock quando duas operações concorrentes usam as
  -- mesmas duplas em sentidos opostos.
  PERFORM visit_group.id
  FROM public.visita_grupos visit_group
  WHERE visit_group.id IN (p_grupo_a_id, p_grupo_b_id)
  ORDER BY visit_group.id
  FOR UPDATE;

  SELECT
    count(*)::integer,
    count(DISTINCT visit_group.encontro_id)::integer,
    bool_and(encounter.ativo)
  INTO v_group_count, v_encounter_count, v_active
  FROM public.visita_grupos visit_group
  JOIN public.encontros encounter ON encounter.id = visit_group.encontro_id
  WHERE visit_group.id IN (p_grupo_a_id, p_grupo_b_id);

  IF v_group_count <> 2 THEN
    RAISE EXCEPTION 'Uma ou mais duplas não foram encontradas.' USING ERRCODE = 'P0002';
  END IF;
  IF v_encounter_count <> 1 THEN
    RAISE EXCEPTION 'As duplas devem pertencer ao mesmo encontro.' USING ERRCODE = '22023';
  END IF;
  IF v_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Encontro encerrado: a composição das duplas está disponível apenas para consulta.'
      USING ERRCODE = '55000';
  END IF;

  IF p_modo = 'individual' THEN
    v_requested_count := COALESCE(cardinality(p_vinculo_ids), 0);
    IF v_requested_count = 0 THEN
      RAISE EXCEPTION 'Selecione ao menos um encontrista.' USING ERRCODE = '22023';
    END IF;
    IF v_requested_count <> (
      SELECT count(DISTINCT requested.id)::integer
      FROM unnest(p_vinculo_ids) AS requested(id)
    ) THEN
      RAISE EXCEPTION 'A seleção contém vínculos duplicados.' USING ERRCODE = '22023';
    END IF;

    PERFORM link.id
    FROM public.visita_participacao link
    WHERE link.id = ANY(p_vinculo_ids)
      AND link.grupo_id = p_grupo_a_id
      AND link.visitante = false
    ORDER BY link.id
    FOR UPDATE;

    SELECT count(*)::integer
    INTO v_valid_count
    FROM public.visita_participacao link
    WHERE link.id = ANY(p_vinculo_ids)
      AND link.grupo_id = p_grupo_a_id
      AND link.visitante = false;

    IF v_valid_count <> v_requested_count THEN
      RAISE EXCEPTION 'A seleção contém vínculos que não pertencem à dupla de origem.'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.visita_participacao
    SET grupo_id = p_grupo_b_id
    WHERE id = ANY(p_vinculo_ids)
      AND grupo_id = p_grupo_a_id
      AND visitante = false;
    GET DIAGNOSTICS v_moved_a_to_b = ROW_COUNT;
  ELSIF p_modo = 'mover_todos' THEN
    UPDATE public.visita_participacao
    SET grupo_id = p_grupo_b_id
    WHERE grupo_id = p_grupo_a_id
      AND visitante = false;
    GET DIAGNOSTICS v_moved_a_to_b = ROW_COUNT;
  ELSE
    WITH moved AS (
      UPDATE public.visita_participacao
      SET grupo_id = CASE
        WHEN grupo_id = p_grupo_a_id THEN p_grupo_b_id
        ELSE p_grupo_a_id
      END
      WHERE grupo_id IN (p_grupo_a_id, p_grupo_b_id)
        AND visitante = false
      RETURNING grupo_id
    )
    SELECT
      count(*) FILTER (WHERE grupo_id = p_grupo_b_id)::integer,
      count(*) FILTER (WHERE grupo_id = p_grupo_a_id)::integer
    INTO v_moved_a_to_b, v_moved_b_to_a
    FROM moved;
  END IF;

  RETURN jsonb_build_object(
    'modo', p_modo,
    'movidos_a_para_b', v_moved_a_to_b,
    'movidos_b_para_a', v_moved_b_to_a
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guard_active_visita_grupo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_active_visita_participacao_composition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_visita_group_participants(uuid, uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_visita_group_participants(uuid, uuid, text, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.move_visita_group_participants(uuid, uuid, text, uuid[]) IS
  'Move encontristas entre duas duplas do encontro ativo em uma única transação.';

NOTIFY pgrst, 'reload schema';

COMMIT;
