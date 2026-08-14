BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(9);

SELECT extensions.has_function(
  'public',
  'get_encounter_readiness',
  ARRAY['uuid'],
  'a RPC de preparação do encontro existe'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.get_encounter_readiness(uuid)', 'EXECUTE'),
  'usuários anônimos não executam o painel de preparação'
);

SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.get_encounter_readiness(uuid)', 'EXECUTE'),
  'usuários autenticados podem chamar a RPC, que valida a administração internamente'
);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('17000000-0000-0000-0000-000000000001', 'readiness.admin@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('17000000-0000-0000-0000-000000000002', 'readiness.user@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES (
  '17000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0002-000000000001',
  NULL
);

INSERT INTO public.encontros (
  id, nome, data_inicio, data_fim, local, ativo, edicao,
  valor_taxa, pix_taxa_chave, pix_taxa_tipo, formulario_publico_ativo,
  tema, musica
)
VALUES (
  '27000000-0000-0000-0000-000000000001',
  'Encontro em preparação',
  '2099-01-01',
  '2099-01-03',
  'Local de teste',
  true,
  9991,
  100,
  'chave-pix-teste',
  'email',
  true,
  'Tema de teste',
  'Música de teste'
);

SELECT set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.get_encounter_readiness('27000000-0000-0000-0000-000000000001')$$,
  '42501',
  NULL,
  'usuário sem administração não consulta a preparação'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (public.get_encounter_readiness('27000000-0000-0000-0000-000000000001')->'metrics'->>'public_forms_published')::boolean,
  true,
  'a publicação dos formulários externos integra a prontidão'
);

SELECT extensions.is(
  (public.get_encounter_readiness('27000000-0000-0000-0000-000000000001')->'metrics'->>'basic_configured')::boolean,
  true,
  'dados básicos completos são reconhecidos'
);

SELECT extensions.is(
  (public.get_encounter_readiness('27000000-0000-0000-0000-000000000001')->'metrics'->>'fee_configured')::boolean,
  true,
  'valor, chave e tipo PIX completos são reconhecidos'
);

-- A alteração abaixo prepara o cenário seguinte; não faz parte da autorização
-- exercitada pela RPC e, por isso, é executada pelo papel do teste.
RESET ROLE;

UPDATE public.encontros
SET tema = NULL
WHERE id = '27000000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  (public.get_encounter_readiness('27000000-0000-0000-0000-000000000001')->'metrics'->'basic_missing_fields') ? 'Tema',
  'a RPC informa especificamente o campo de encontro ausente'
);

SELECT extensions.is(
  (public.get_encounter_readiness('27000000-0000-0000-0000-000000000001')->'metrics'->>'teams_total')::integer,
  0,
  'a RPC retorna contagens agregadas sem exigir registros operacionais'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
