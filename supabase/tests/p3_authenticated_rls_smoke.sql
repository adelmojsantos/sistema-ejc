BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(6);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'p3.admin@example.test',
    'authenticated',
    'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'p3.unauthorized@example.test',
    'authenticated',
    'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  );

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0002-000000000001',
  NULL
);

INSERT INTO public.encontros (
  id, nome, data_inicio, data_fim, ativo, edicao
)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  'P3 authorization fixture',
  current_date,
  current_date + 2,
  true,
  999901
);

INSERT INTO public.pessoas (id, nome_completo, email)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'Pessoa fixture',
  'p3.person@example.test'
);

INSERT INTO public.participacoes (
  id, pessoa_id, encontro_id, participante
)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  true
);

SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  public.can_read_camiseta_catalog(),
  'administrator can read the shirt catalog'
);
SELECT extensions.ok(
  public.can_manage_camiseta_catalog(),
  'administrator can manage the shirt catalog'
);
SELECT extensions.ok(
  public.can_access_operational_participation(
    '40000000-0000-0000-0000-000000000001',
    'modulo_recepcao',
    true
  ),
  'administrator can access operational participation'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  NOT public.can_read_camiseta_catalog(),
  'unauthorized user cannot read the shirt catalog'
);
SELECT extensions.ok(
  NOT public.can_manage_camiseta_catalog(),
  'unauthorized user cannot manage the shirt catalog'
);
SELECT extensions.ok(
  NOT public.can_access_operational_participation(
    '40000000-0000-0000-0000-000000000001',
    'modulo_recepcao',
    true
  ),
  'unauthorized user cannot access operational participation'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
