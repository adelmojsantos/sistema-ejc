-- Keep historical visits read-only and return a domain-specific error before
-- delegating active saves to the transactional implementation.

BEGIN;

ALTER FUNCTION public.salvar_visita_completa(uuid, jsonb)
  RENAME TO salvar_visita_completa_impl;

REVOKE ALL ON FUNCTION public.salvar_visita_completa_impl(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_visita_completa_impl(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.salvar_visita_completa_impl(uuid, jsonb) FROM authenticated;

CREATE FUNCTION public.salvar_visita_completa(
  p_visita_id uuid,
  p_dados jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_encontro_ativo boolean;
  v_visitante boolean;
BEGIN
  SELECT e.ativo, vp.visitante
  INTO v_encontro_ativo, v_visitante
  FROM public.visita_participacao vp
  JOIN public.participacoes p ON p.id = vp.participacao_id
  JOIN public.encontros e ON e.id = p.encontro_id
  WHERE vp.id = p_visita_id;

  IF NOT FOUND OR v_visitante IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Visita de encontrista não encontrada.';
  END IF;

  IF v_encontro_ativo IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Não é possível alterar uma visita de encontro histórico.';
  END IF;

  RETURN public.salvar_visita_completa_impl(p_visita_id, p_dados);
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_visita_completa(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_visita_completa(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.salvar_visita_completa(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
