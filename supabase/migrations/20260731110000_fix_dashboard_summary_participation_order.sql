BEGIN;

DO $$
DECLARE
  v_definition text;
  v_fixed_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.get_my_dashboard_summary(uuid)'::regprocedure
  )
  INTO v_definition;

  IF strpos(v_definition, 'p.created_at DESC') = 0 THEN
    RAISE EXCEPTION
      'Expected invalid dashboard ordering was not found; refusing an ambiguous rewrite';
  END IF;

  v_fixed_definition := replace(
    v_definition,
    'p.created_at DESC',
    'p.data_inscricao DESC'
  );

  EXECUTE v_fixed_definition;
END;
$$;

COMMENT ON FUNCTION public.get_my_dashboard_summary(uuid) IS
  'Returns permission-filtered operational dashboard data for the authenticated user. Participation ordering uses data_inscricao.';

COMMIT;
