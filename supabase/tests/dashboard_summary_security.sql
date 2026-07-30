BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(5);

SELECT extensions.has_function(
  'public',
  'get_my_dashboard_summary',
  ARRAY['uuid'],
  'dashboard summary RPC exists'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.get_my_dashboard_summary(uuid)', 'EXECUTE'),
  'anonymous users cannot execute the dashboard summary'
);

SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.get_my_dashboard_summary(uuid)', 'EXECUTE'),
  'authenticated users can execute the dashboard summary'
);

SELECT extensions.ok(
  (
    SELECT p.prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_my_dashboard_summary'
      AND pg_get_function_identity_arguments(p.oid) = 'p_encontro_id uuid'
  ),
  'dashboard summary uses security definer to avoid broad table grants'
);

SELECT extensions.ok(
  (
    SELECT 'search_path=pg_catalog, public, pg_temp' = ANY(COALESCE(p.proconfig, ARRAY[]::text[]))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_my_dashboard_summary'
      AND pg_get_function_identity_arguments(p.oid) = 'p_encontro_id uuid'
  ),
  'dashboard summary pins a safe search path'
);

SELECT * FROM extensions.finish();
ROLLBACK;
