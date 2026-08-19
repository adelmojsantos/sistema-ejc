-- Shared, auditable visit order for coordinators and each visiting pair.

BEGIN;

ALTER TABLE public.visita_participacao
  ADD COLUMN IF NOT EXISTS ordem_roteiro integer;

ALTER TABLE public.visita_grupos
  ADD COLUMN IF NOT EXISTS roteiro_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS roteiro_atualizado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

WITH ordered AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY grupo_id
      ORDER BY created_at NULLS LAST, id
    )::integer AS ordem
  FROM public.visita_participacao
  WHERE visitante = false
    AND grupo_id IS NOT NULL
)
UPDATE public.visita_participacao visit
SET ordem_roteiro = ordered.ordem
FROM ordered
WHERE visit.id = ordered.id
  AND visit.ordem_roteiro IS NULL;

ALTER TABLE public.visita_participacao
  ADD CONSTRAINT visita_participacao_ordem_roteiro_check
  CHECK (ordem_roteiro IS NULL OR (visitante = false AND grupo_id IS NOT NULL AND ordem_roteiro > 0)) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS visita_participacao_grupo_ordem_roteiro_uidx
  ON public.visita_participacao (grupo_id, ordem_roteiro)
  WHERE visitante = false AND grupo_id IS NOT NULL AND ordem_roteiro IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prepare_visita_route_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.visitante OR NEW.grupo_id IS NULL THEN
    NEW.ordem_roteiro := NULL;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.ordem_roteiro IS NULL)
     OR (TG_OP = 'UPDATE' AND NEW.grupo_id IS DISTINCT FROM OLD.grupo_id) THEN
    PERFORM 1 FROM public.visita_grupos WHERE id = NEW.grupo_id FOR UPDATE;
    SELECT COALESCE(max(link.ordem_roteiro), 0) + 1
    INTO NEW.ordem_roteiro
    FROM public.visita_participacao link
    WHERE link.grupo_id = NEW.grupo_id
      AND link.visitante = false
      AND link.id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_visita_route_order_trigger ON public.visita_participacao;
CREATE TRIGGER prepare_visita_route_order_trigger
BEFORE INSERT OR UPDATE OF grupo_id, visitante, ordem_roteiro
ON public.visita_participacao
FOR EACH ROW
EXECUTE FUNCTION public.prepare_visita_route_order();

CREATE OR REPLACE FUNCTION public.save_visita_route_order(
  p_grupo_id uuid,
  p_visita_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_expected_count integer;
  v_distinct_count integer;
  v_allowed boolean;
BEGIN
  IF p_grupo_id IS NULL OR p_visita_ids IS NULL THEN
    RAISE EXCEPTION 'Grupo e ordem do roteiro são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  SELECT (
    public.can_manage_visita_grupos()
    OR EXISTS (
      SELECT 1
      FROM public.visita_participacao visitor_link
      JOIN public.participacoes participation ON participation.id = visitor_link.participacao_id
      WHERE visitor_link.grupo_id = p_grupo_id
        AND visitor_link.visitante = true
        AND participation.pessoa_id = public.resolve_profile_person_id(auth.uid())
    )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este roteiro.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.visita_grupos WHERE id = p_grupo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dupla de visitação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::integer
  INTO v_expected_count
  FROM public.visita_participacao
  WHERE grupo_id = p_grupo_id AND visitante = false;

  SELECT count(DISTINCT id)::integer
  INTO v_distinct_count
  FROM unnest(p_visita_ids) AS ids(id);

  IF cardinality(p_visita_ids) <> v_expected_count
     OR v_distinct_count <> v_expected_count
     OR EXISTS (
       SELECT 1
       FROM unnest(p_visita_ids) AS ids(id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.visita_participacao visit
         WHERE visit.id = ids.id
           AND visit.grupo_id = p_grupo_id
           AND visit.visitante = false
       )
     ) THEN
    RAISE EXCEPTION 'A ordem deve conter exatamente todos os encontristas ativos da dupla.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.visita_participacao
  SET ordem_roteiro = NULL
  WHERE grupo_id = p_grupo_id AND visitante = false;

  UPDATE public.visita_participacao visit
  SET ordem_roteiro = ordered.ordem
  FROM unnest(p_visita_ids) WITH ORDINALITY AS ordered(id, ordem)
  WHERE visit.id = ordered.id;

  UPDATE public.visita_grupos
  SET roteiro_atualizado_em = now(), roteiro_atualizado_por = auth.uid()
  WHERE id = p_grupo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_visita_route_order(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_visita_route_order(uuid, uuid[]) TO authenticated;

COMMENT ON COLUMN public.visita_participacao.ordem_roteiro IS
'Ordem compartilhada dos encontristas no roteiro da dupla; não implica que o ponto esteja geograficamente verificado.';

NOTIFY pgrst, 'reload schema';

COMMIT;
