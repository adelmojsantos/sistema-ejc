-- Follow-up for databases where the P0 migration was already recorded.
-- Fixes the actual FK name used by circulo_participacao and makes the
-- authenticated read grants explicit without restoring anonymous table access.

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.get_quadrante_public_payload(uuid,text)'::regprocedure
  )
  INTO v_definition;

  IF position('cp.circulo_id' IN v_definition) = 0 THEN
    IF position('cp.circulo' IN v_definition) = 0 THEN
      RAISE EXCEPTION
        'Não foi possível localizar a referência de círculo em get_quadrante_public_payload';
    END IF;

    v_definition := replace(
      v_definition,
      'ci.id = cp.circulo',
      'ci.id = cp.circulo_id'
    );

    EXECUTE v_definition;
  END IF;
END;
$$;

ALTER FUNCTION public.get_quadrante_public_payload(uuid, text) SECURITY DEFINER;
ALTER FUNCTION public.get_quadrante_public_payload(uuid, text)
  SET search_path = public;

REVOKE ALL ON FUNCTION public.get_quadrante_public_payload(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quadrante_public_payload(uuid, text)
  TO anon, authenticated;

GRANT SELECT ON TABLE public.encontros TO authenticated;
GRANT SELECT ON TABLE public.participacoes TO authenticated;
GRANT SELECT ON TABLE public.pessoas TO authenticated;
GRANT SELECT ON TABLE public.equipes TO authenticated;
GRANT SELECT ON TABLE public.circulos TO authenticated;
GRANT SELECT ON TABLE public.circulo_participacao TO authenticated;
GRANT SELECT ON TABLE public.equipe_confirmacoes TO authenticated;
GRANT SELECT ON TABLE public.circulo_mediadores_fotos TO authenticated;
GRANT SELECT ON TABLE public.palestras TO authenticated;

-- Keep the original P0 boundary intact.
REVOKE SELECT ON TABLE public.encontros FROM anon;
REVOKE SELECT ON TABLE public.participacoes FROM anon;
REVOKE SELECT ON TABLE public.pessoas FROM anon;
REVOKE SELECT ON TABLE public.equipes FROM anon;
REVOKE SELECT ON TABLE public.circulos FROM anon;
REVOKE SELECT ON TABLE public.circulo_participacao FROM anon;
REVOKE SELECT ON TABLE public.equipe_confirmacoes FROM anon;
REVOKE SELECT ON TABLE public.circulo_mediadores_fotos FROM anon;
REVOKE SELECT ON TABLE public.palestras FROM anon;

NOTIFY pgrst, 'reload schema';
