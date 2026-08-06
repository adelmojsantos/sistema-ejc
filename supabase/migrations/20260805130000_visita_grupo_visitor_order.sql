BEGIN;

ALTER TABLE public.visita_participacao
  ADD COLUMN IF NOT EXISTS ordem_visitante smallint;

-- Preserve a deterministic order for existing pairs before the new lifecycle
-- functions start relying on it. NULL remains valid for old/non-visitor rows.
WITH ordered AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY grupo_id
      ORDER BY created_at NULLS LAST, id
    )::smallint AS ordem
  FROM public.visita_participacao
  WHERE visitante = true
    AND grupo_id IS NOT NULL
)
UPDATE public.visita_participacao vp
SET ordem_visitante = ordered.ordem
FROM ordered
WHERE vp.id = ordered.id;

CREATE UNIQUE INDEX IF NOT EXISTS visita_participacao_grupo_ordem_visitante_uidx
  ON public.visita_participacao (grupo_id, ordem_visitante)
  WHERE visitante = true AND ordem_visitante IS NOT NULL;

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

  SELECT nome_automatico INTO v_automatico
  FROM public.visita_grupos
  WHERE id = p_grupo_id
  FOR UPDATE;

  IF NOT FOUND OR (NOT p_force_automatic AND NOT v_automatico) THEN
    RETURN;
  END IF;

  SELECT count(*)::integer,
         string_agg(
           split_part(btrim(person.nome_completo), ' ', 1),
           ' & ' ORDER BY link.ordem_visitante NULLS LAST, link.created_at, link.id
         )
  INTO v_quantidade, v_nome
  FROM public.visita_participacao link
  JOIN public.participacoes participation ON participation.id = link.participacao_id
  JOIN public.pessoas person ON person.id = participation.pessoa_id
  WHERE link.grupo_id = p_grupo_id AND link.visitante = true;

  v_nome := CASE
    WHEN v_quantidade = 0 THEN 'Dupla pendente'
    WHEN v_quantidade = 1 THEN v_nome || ' & Pendente'
    ELSE v_nome
  END;

  UPDATE public.visita_grupos
  SET nome = v_nome, nome_automatico = true
  WHERE id = p_grupo_id;
END;
$$;

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
    AND encontro_id = p_encontro_id AND participante = false;

  IF v_validos <> 2 THEN
    RAISE EXCEPTION 'visitors must be workers from the selected encounter' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.visita_participacao
    WHERE visitante = true AND participacao_id IN (p_visitante_a_id, p_visitante_b_id)
  ) THEN
    RAISE EXCEPTION 'one or more visitors already belong to a group' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.visita_grupos (encontro_id, nome, nome_automatico)
  VALUES (p_encontro_id, 'Dupla pendente', true)
  RETURNING * INTO v_grupo;

  INSERT INTO public.visita_participacao (grupo_id, participacao_id, visitante, ordem_visitante)
  VALUES (v_grupo.id, p_visitante_a_id, true, 1),
         (v_grupo.id, p_visitante_b_id, true, 2);

  SELECT * INTO v_grupo FROM public.visita_grupos WHERE id = v_grupo.id;
  RETURN v_grupo;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
