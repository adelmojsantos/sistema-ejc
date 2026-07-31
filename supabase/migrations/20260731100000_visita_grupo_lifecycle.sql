BEGIN;

ALTER TABLE public.visita_grupos
  ADD COLUMN IF NOT EXISTS nome_automatico boolean NOT NULL DEFAULT true;

-- Preserve every existing label because the database cannot reliably tell which
-- ones were manually customized. A future visitor change re-enables automation.
UPDATE public.visita_grupos
SET nome_automatico = false
WHERE nome_automatico = true;

ALTER TABLE public.visita_participacao
  ALTER COLUMN grupo_id DROP NOT NULL;

ALTER TABLE public.visita_participacao
  DROP CONSTRAINT IF EXISTS visita_participacao_grupo_id_fkey;

ALTER TABLE public.visita_participacao
  ADD CONSTRAINT visita_participacao_grupo_id_fkey
  FOREIGN KEY (grupo_id)
  REFERENCES public.visita_grupos(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.can_manage_visita_grupos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.is_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'modulo_admin')
      OR public.has_permission(auth.uid(), 'modulo_visitacao_coordenar')
    );
$$;

CREATE OR REPLACE FUNCTION public.refresh_visita_grupo_nome(
  p_grupo_id uuid,
  p_force_automatic boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_nome text;
  v_automatico boolean;
  v_quantidade integer;
BEGIN
  IF p_grupo_id IS NULL THEN
    RETURN;
  END IF;

  SELECT nome_automatico
  INTO v_automatico
  FROM public.visita_grupos
  WHERE id = p_grupo_id
  FOR UPDATE;

  IF NOT FOUND OR (NOT p_force_automatic AND NOT v_automatico) THEN
    RETURN;
  END IF;

  SELECT
    count(*)::integer,
    string_agg(
      split_part(btrim(person.nome_completo), ' ', 1),
      ' & '
      ORDER BY link.created_at, link.id
    )
  INTO v_quantidade, v_nome
  FROM public.visita_participacao link
  JOIN public.participacoes participation ON participation.id = link.participacao_id
  JOIN public.pessoas person ON person.id = participation.pessoa_id
  WHERE link.grupo_id = p_grupo_id
    AND link.visitante = true;

  v_nome := CASE
    WHEN v_quantidade = 0 THEN 'Dupla pendente'
    WHEN v_quantidade = 1 THEN v_nome || ' & Pendente'
    ELSE v_nome
  END;

  UPDATE public.visita_grupos
  SET nome = v_nome,
      nome_automatico = true
  WHERE id = p_grupo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_visita_grupo_nome_from_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.visitante THEN
      PERFORM public.refresh_visita_grupo_nome(OLD.grupo_id, true);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.visitante
      AND (OLD.grupo_id IS DISTINCT FROM NEW.grupo_id OR NOT NEW.visitante)
    THEN
      PERFORM public.refresh_visita_grupo_nome(OLD.grupo_id, true);
    END IF;

    IF NEW.visitante
      AND (
        OLD.grupo_id IS DISTINCT FROM NEW.grupo_id
        OR OLD.participacao_id IS DISTINCT FROM NEW.participacao_id
        OR OLD.visitante IS DISTINCT FROM NEW.visitante
      )
    THEN
      PERFORM public.refresh_visita_grupo_nome(NEW.grupo_id, true);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.visitante THEN
    PERFORM public.refresh_visita_grupo_nome(NEW.grupo_id, true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_visita_grupo_nome_members
ON public.visita_participacao;

CREATE TRIGGER sync_visita_grupo_nome_members
AFTER INSERT OR UPDATE OR DELETE ON public.visita_participacao
FOR EACH ROW
EXECUTE FUNCTION public.sync_visita_grupo_nome_from_members();

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
    WHERE participation.pessoa_id = NEW.id
      AND link.grupo_id IS NOT NULL
  LOOP
    PERFORM public.refresh_visita_grupo_nome(v_grupo_id, false);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_visita_grupo_nome_person
ON public.pessoas;

CREATE TRIGGER sync_visita_grupo_nome_person
AFTER UPDATE OF nome_completo ON public.pessoas
FOR EACH ROW
EXECUTE FUNCTION public.sync_visita_grupo_nome_from_person();

CREATE OR REPLACE FUNCTION public.prepare_visita_grupo_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- Defense in depth for deletes performed outside the lifecycle RPC.
  DELETE FROM public.visita_participacao
  WHERE grupo_id = OLD.id AND visitante = true;

  UPDATE public.visita_participacao
  SET grupo_id = NULL
  WHERE grupo_id = OLD.id AND visitante = false;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prepare_visita_grupo_delete
ON public.visita_grupos;

CREATE TRIGGER prepare_visita_grupo_delete
BEFORE DELETE ON public.visita_grupos
FOR EACH ROW
EXECUTE FUNCTION public.prepare_visita_grupo_delete();

CREATE OR REPLACE FUNCTION public.create_visita_grupo(
  p_encontro_id uuid,
  p_visitante_a_id uuid,
  p_visitante_b_id uuid
)
RETURNS public.visita_grupos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_grupo public.visita_grupos;
  v_validos integer;
BEGIN
  IF NOT public.can_manage_visita_grupos() THEN
    RAISE EXCEPTION 'permission denied to manage visitation groups' USING ERRCODE = '42501';
  END IF;
  IF p_visitante_a_id = p_visitante_b_id THEN
    RAISE EXCEPTION 'visitors must be different' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer INTO v_validos
  FROM public.participacoes
  WHERE id IN (p_visitante_a_id, p_visitante_b_id)
    AND encontro_id = p_encontro_id
    AND participante = false;

  IF v_validos <> 2 THEN
    RAISE EXCEPTION 'visitors must be workers from the selected encounter' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.visita_participacao
    WHERE visitante = true
      AND participacao_id IN (p_visitante_a_id, p_visitante_b_id)
  ) THEN
    RAISE EXCEPTION 'one or more visitors already belong to a group' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.visita_grupos (encontro_id, nome, nome_automatico)
  VALUES (p_encontro_id, 'Dupla pendente', true)
  RETURNING * INTO v_grupo;

  INSERT INTO public.visita_participacao (grupo_id, participacao_id, visitante)
  VALUES
    (v_grupo.id, p_visitante_a_id, true),
    (v_grupo.id, p_visitante_b_id, true);

  SELECT * INTO v_grupo FROM public.visita_grupos WHERE id = v_grupo.id;
  RETURN v_grupo;
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_visita_grupo(
  p_grupo_id uuid,
  p_nome text
)
RETURNS public.visita_grupos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_grupo public.visita_grupos;
BEGIN
  IF NOT public.can_manage_visita_grupos() THEN
    RAISE EXCEPTION 'permission denied to manage visitation groups' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'group name is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.visita_grupos
  SET nome = btrim(p_nome), nome_automatico = false
  WHERE id = p_grupo_id
  RETURNING * INTO v_grupo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'visitation group not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_grupo;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_visita_grupo_visitor(
  p_grupo_id uuid,
  p_vinculo_visitante_id uuid,
  p_nova_participacao_id uuid
)
RETURNS public.visita_grupos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_grupo public.visita_grupos;
  v_encontro_id uuid;
BEGIN
  IF NOT public.can_manage_visita_grupos() THEN
    RAISE EXCEPTION 'permission denied to manage visitation groups' USING ERRCODE = '42501';
  END IF;

  SELECT encontro_id INTO v_encontro_id
  FROM public.visita_grupos
  WHERE id = p_grupo_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'visitation group not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.visita_participacao
    WHERE id = p_vinculo_visitante_id
      AND grupo_id = p_grupo_id
      AND visitante = true
  ) THEN
    RAISE EXCEPTION 'visitor link not found in group' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.participacoes
    WHERE id = p_nova_participacao_id
      AND encontro_id = v_encontro_id
      AND participante = false
  ) THEN
    RAISE EXCEPTION 'replacement must be a worker from the same encounter' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.visita_participacao
    WHERE visitante = true
      AND participacao_id = p_nova_participacao_id
      AND id <> p_vinculo_visitante_id
  ) THEN
    RAISE EXCEPTION 'replacement already belongs to a group' USING ERRCODE = '23505';
  END IF;

  UPDATE public.visita_participacao
  SET participacao_id = p_nova_participacao_id
  WHERE id = p_vinculo_visitante_id;

  SELECT * INTO v_grupo FROM public.visita_grupos WHERE id = p_grupo_id;
  RETURN v_grupo;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_visita_participant(
  p_grupo_id uuid,
  p_participacao_id uuid
)
RETURNS public.visita_participacao
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_result public.visita_participacao;
  v_encontro_id uuid;
BEGIN
  IF NOT public.can_manage_visita_grupos() THEN
    RAISE EXCEPTION 'permission denied to manage visitation groups' USING ERRCODE = '42501';
  END IF;
  SELECT encontro_id INTO v_encontro_id FROM public.visita_grupos WHERE id = p_grupo_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.participacoes
    WHERE id = p_participacao_id
      AND encontro_id = v_encontro_id
      AND participante = true
  ) THEN
    RAISE EXCEPTION 'participant and group must belong to the same encounter' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_result
  FROM public.visita_participacao
  WHERE participacao_id = p_participacao_id
    AND visitante = false
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_result.grupo_id IS NOT NULL AND v_result.grupo_id <> p_grupo_id THEN
      RAISE EXCEPTION 'participant already belongs to another visitation group' USING ERRCODE = '23505';
    END IF;
    UPDATE public.visita_participacao
    SET grupo_id = p_grupo_id
    WHERE id = v_result.id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.visita_participacao (grupo_id, participacao_id, visitante, status)
    VALUES (p_grupo_id, p_participacao_id, false, 'pendente')
    RETURNING * INTO v_result;
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_visita_grupo_delete_impact(p_grupo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.can_manage_visita_grupos() THEN
    RAISE EXCEPTION 'permission denied to manage visitation groups' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'grupo_id', visit_group.id,
    'nome', visit_group.nome,
    'foto_url', visit_group.foto_url,
    'visitantes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vinculo_id', link.id,
        'participacao_id', participation.id,
        'nome', person.nome_completo
      ) ORDER BY link.created_at, link.id)
      FROM public.visita_participacao link
      JOIN public.participacoes participation ON participation.id = link.participacao_id
      JOIN public.pessoas person ON person.id = participation.pessoa_id
      WHERE link.grupo_id = visit_group.id AND link.visitante = true
    ), '[]'::jsonb),
    'visitantes_total', (SELECT count(*) FROM public.visita_participacao link WHERE link.grupo_id = visit_group.id AND link.visitante = true),
    'encontristas_total', (SELECT count(*) FROM public.visita_participacao link WHERE link.grupo_id = visit_group.id AND link.visitante = false),
    'pendentes_total', (SELECT count(*) FROM public.visita_participacao link WHERE link.grupo_id = visit_group.id AND NOT link.visitante AND link.status = 'pendente'),
    'realizadas_total', (SELECT count(*) FROM public.visita_participacao link WHERE link.grupo_id = visit_group.id AND NOT link.visitante AND link.status = 'realizada'),
    'ausentes_total', (SELECT count(*) FROM public.visita_participacao link WHERE link.grupo_id = visit_group.id AND NOT link.visitante AND link.status = 'ausente'),
    'fotos_familia_total', (SELECT count(*) FROM public.visita_participacao link WHERE link.grupo_id = visit_group.id AND NOT link.visitante AND link.foto_familia_url IS NOT NULL),
    'intencoes_camiseta_total', (
      SELECT count(*) FROM public.visita_intencao_camiseta intention
      JOIN public.visita_participacao link ON link.id = intention.visita_id
      WHERE link.grupo_id = visit_group.id AND NOT link.visitante
    ),
    'presencas_total', (SELECT count(*) FROM public.encontro_presencas presence WHERE presence.grupo_id = visit_group.id),
    'desistentes_total', (SELECT count(*) FROM public.participacoes_canceladas canceled WHERE canceled.grupo_id = visit_group.id)
  ) INTO v_result
  FROM public.visita_grupos visit_group
  WHERE visit_group.id = p_grupo_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'visitation group not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.dissolve_visita_grupo(p_grupo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_impact jsonb;
BEGIN
  IF NOT public.can_manage_visita_grupos() THEN
    RAISE EXCEPTION 'permission denied to manage visitation groups' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.visita_grupos WHERE id = p_grupo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'visitation group not found' USING ERRCODE = 'P0002';
  END IF;
  v_impact := public.get_visita_grupo_delete_impact(p_grupo_id);

  -- Workers are released. Encounter participants keep their operational visit
  -- record (status, photos, tax and shirt intentions) ready for reassignment.
  DELETE FROM public.visita_participacao
  WHERE grupo_id = p_grupo_id AND visitante = true;

  UPDATE public.visita_participacao
  SET grupo_id = NULL
  WHERE grupo_id = p_grupo_id AND visitante = false;

  DELETE FROM public.visita_grupos WHERE id = p_grupo_id;
  RETURN v_impact;
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_visita_grupos() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_visita_grupo_nome(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_visita_grupo(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rename_visita_grupo(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replace_visita_grupo_visitor(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_visita_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_visita_grupo_delete_impact(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dissolve_visita_grupo(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_visita_grupo(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_visita_grupo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_visita_grupo_visitor(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_visita_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visita_grupo_delete_impact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dissolve_visita_grupo(uuid) TO authenticated;

COMMIT;
