BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(4);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  (
    '12000000-0000-0000-0000-000000000001',
    'p4.developer@example.test',
    'authenticated',
    'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '12000000-0000-0000-0000-000000000002',
    'p4.admin@example.test',
    'authenticated',
    'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  );

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
SELECT
  '12000000-0000-0000-0000-000000000001',
  g.id,
  NULL
FROM public.grupos g
WHERE g.nome = 'Desenvolvedores';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES (
  '12000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0002-000000000001',
  NULL
);

INSERT INTO public.app_error_logs (
  id, user_id, source, route, message
)
VALUES
  (
    '52000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    'p4-fixture',
    '/diagnostics-test',
    'Developer fixture error'
  ),
  (
    '52000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000002',
    'p4-fixture',
    '/diagnostics-test',
    'Administrator fixture error'
  );

SELECT set_config(
  'request.jwt.claim.sub',
  '12000000-0000-0000-0000-000000000001',
  true
);

SELECT extensions.ok(
  public.has_permission(
    '12000000-0000-0000-0000-000000000001',
    'modulo_diagnosticos'
  ),
  'developer has the exact diagnostics permission'
);

SET LOCAL ROLE authenticated;
SELECT extensions.is(
  (SELECT count(*) FROM public.app_error_logs),
  2::bigint,
  'developer can read server diagnostics'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '12000000-0000-0000-0000-000000000002',
  true
);

SELECT extensions.ok(
  NOT public.has_permission(
    '12000000-0000-0000-0000-000000000002',
    'modulo_diagnosticos'
  ),
  'general administrator does not inherit diagnostics permission'
);

SET LOCAL ROLE authenticated;
SELECT extensions.is(
  (SELECT count(*) FROM public.app_error_logs),
  0::bigint,
  'general administrator cannot read server diagnostics'
);
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
