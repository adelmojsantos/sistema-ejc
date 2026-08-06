-- This migration was already applied to the linked Supabase project.
-- It remains in the repository so local and remote migration histories stay
-- consistent. The dashboard UI intentionally hides operational summaries for
-- historical encounters.

BEGIN;

DO $$
DECLARE
  v_definition text;
  v_active_predicate text := E'      AND e.ativo = true';
BEGIN
  SELECT pg_get_functiondef('public.get_my_dashboard_summary(uuid)'::regprocedure)
    INTO v_definition;

  IF strpos(v_definition, v_active_predicate) = 0 THEN
    RAISE EXCEPTION 'Dashboard summary active-only guard was not found; migration stopped safely.';
  END IF;

  v_definition := replace(v_definition, v_active_predicate, E'      AND TRUE');
  EXECUTE v_definition;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
