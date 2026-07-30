BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(22);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  (
    '13000000-0000-0000-0000-000000000001',
    'p4.stock-reader@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '13000000-0000-0000-0000-000000000002',
    'p4.finance-reader@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '13000000-0000-0000-0000-000000000003',
    'p4.finance-manager@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '13000000-0000-0000-0000-000000000004',
    'p4.coordinator@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '13000000-0000-0000-0000-000000000005',
    'p4.unauthorized@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '13000000-0000-0000-0000-000000000006',
    'p4.administrator@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  );

INSERT INTO public.grupos (id, nome, descricao)
VALUES
  (
    '63000000-0000-0000-0000-000000000001',
    'P4 Leitura Almoxarifado',
    'Fixture transacional'
  ),
  (
    '63000000-0000-0000-0000-000000000002',
    'P4 Leitura Financeiro',
    'Fixture transacional'
  ),
  (
    '63000000-0000-0000-0000-000000000003',
    'P4 Gestão Financeiro',
    'Fixture transacional'
  );

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '63000000-0000-0000-0000-000000000001', id
FROM public.permissoes
WHERE chave = 'almoxarifado_consultar'
UNION ALL
SELECT '63000000-0000-0000-0000-000000000002', id
FROM public.permissoes
WHERE chave = 'modulo_financeiro'
UNION ALL
SELECT '63000000-0000-0000-0000-000000000003', id
FROM public.permissoes
WHERE chave = 'financeiro_gerenciar';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES
  (
    '13000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000001',
    NULL
  ),
  (
    '13000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000002',
    NULL
  ),
  (
    '13000000-0000-0000-0000-000000000003',
    '63000000-0000-0000-0000-000000000003',
    NULL
  ),
  (
    '13000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0002-000000000004',
    NULL
  ),
  (
    '13000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0002-000000000001',
    NULL
  );

SELECT set_config(
  'request.jwt.claim.sub',
  '13000000-0000-0000-0000-000000000001',
  true
);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(
  public.can_access_almoxarifado(),
  'stock reader can view warehouse data'
);
SELECT extensions.ok(
  NOT public.can_manage_almoxarifado(),
  'stock reader cannot manage warehouse catalogs'
);
SELECT extensions.ok(
  NOT public.can_move_almoxarifado(),
  'stock reader cannot move stock'
);
SELECT extensions.ok(
  NOT public.can_access_financeiro(),
  'stock reader cannot access finance'
);
SELECT extensions.ok(
  NOT public.can_operate_almoxarifado_compras(),
  'stock reader cannot operate purchases'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '13000000-0000-0000-0000-000000000002',
  true
);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(
  public.can_access_financeiro(),
  'finance reader can view finance'
);
SELECT extensions.ok(
  NOT public.can_manage_financeiro(),
  'finance reader cannot manage finance'
);
SELECT extensions.ok(
  NOT public.can_access_almoxarifado(),
  'finance reader cannot access warehouse data'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '13000000-0000-0000-0000-000000000003',
  true
);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(
  public.can_access_financeiro(),
  'finance manager can view finance'
);
SELECT extensions.ok(
  public.can_manage_financeiro(),
  'finance manager can manage finance'
);
SELECT extensions.ok(
  NOT public.can_access_almoxarifado(),
  'finance manager does not inherit warehouse access'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '13000000-0000-0000-0000-000000000004',
  true
);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(
  public.can_access_almoxarifado(),
  'coordinator can view warehouse availability'
);
SELECT extensions.ok(
  NOT public.can_manage_almoxarifado(),
  'coordinator cannot manage warehouse catalogs'
);
SELECT extensions.ok(
  NOT public.can_move_almoxarifado(),
  'coordinator cannot move stock'
);
SELECT extensions.ok(
  public.can_create_almoxarifado_pedidos(),
  'coordinator can create warehouse orders'
);
SELECT extensions.ok(
  NOT public.can_operate_almoxarifado_compras(),
  'coordinator cannot operate purchases without exact permission'
);
SELECT extensions.ok(
  NOT public.can_access_financeiro(),
  'coordinator does not inherit finance access'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '13000000-0000-0000-0000-000000000005',
  true
);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(
  NOT public.can_access_almoxarifado(),
  'authenticated user without permission cannot access warehouse data'
);
SELECT extensions.ok(
  NOT public.can_access_financeiro(),
  'authenticated user without permission cannot access finance'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '13000000-0000-0000-0000-000000000006',
  true
);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(
  public.can_manage_almoxarifado(),
  'administrator can manage warehouse data'
);
SELECT extensions.ok(
  public.can_operate_almoxarifado_compras(),
  'administrator can operate purchases'
);
SELECT extensions.ok(
  public.can_manage_financeiro(),
  'administrator can manage finance'
);
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
