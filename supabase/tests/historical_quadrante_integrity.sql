BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(8);

SELECT extensions.has_trigger(
  'public',
  'encontros',
  'protect_historical_quadrante_trigger',
  'Quadrantes históricos possuem trava de integridade'
);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES (
  '18000000-0000-0000-0000-000000000001',
  'historical-quadrante.admin@example.test',
  'authenticated',
  'authenticated',
  crypt('fixture-password', gen_salt('bf')),
  now(), now(), now(), false, false
);

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES (
  '18000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0002-000000000001',
  NULL
);

INSERT INTO public.encontros (
  id, nome, data_inicio, data_fim, ativo, edicao,
  quadrante_ativo, quadrante_token, quadrante_pin, tematica_texto
)
VALUES
  (
    '28000000-0000-0000-0000-000000000001',
    'Histórico desativado',
    current_date - 10,
    current_date - 8,
    false,
    9992,
    false,
    '38000000-0000-0000-0000-000000000001',
    NULL,
    'Conteúdo preservado'
  ),
  (
    '28000000-0000-0000-0000-000000000002',
    'Histórico publicado',
    current_date - 20,
    current_date - 18,
    false,
    9993,
    true,
    '38000000-0000-0000-0000-000000000002',
    '1234',
    'Outro conteúdo preservado'
  );

SELECT set_config('request.jwt.claim.sub', '18000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$UPDATE public.encontros SET tematica_texto = 'Conteúdo alterado' WHERE id = '28000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'O conteúdo de um Quadrante histórico é somente leitura.',
  'conteúdo editorial histórico não pode ser alterado'
);

SELECT extensions.throws_ok(
  $$UPDATE public.encontros SET quadrante_ativo = true WHERE id = '28000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Um Quadrante histórico desativado não pode ser reativado.',
  'Quadrante histórico desativado não pode ser republicado'
);

SELECT extensions.throws_ok(
  $$UPDATE public.encontros SET quadrante_pin = '5678' WHERE id = '28000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'O PIN só pode ser alterado enquanto o Quadrante histórico estiver publicado.',
  'PIN de histórico desativado permanece bloqueado'
);

SELECT extensions.lives_ok(
  $$UPDATE public.encontros SET quadrante_token = '38000000-0000-0000-0000-000000000003' WHERE id = '28000000-0000-0000-0000-000000000001'$$,
  'token histórico pode ser rotacionado para revogar links antigos'
);

SELECT extensions.lives_ok(
  $$UPDATE public.encontros SET quadrante_pin = '5678' WHERE id = '28000000-0000-0000-0000-000000000002'$$,
  'PIN pode ser alterado enquanto o histórico estiver publicado'
);

SELECT extensions.lives_ok(
  $$UPDATE public.encontros SET quadrante_ativo = false WHERE id = '28000000-0000-0000-0000-000000000002'$$,
  'histórico publicado pode ser desativado'
);

SELECT extensions.is(
  (SELECT quadrante_ativo FROM public.encontros WHERE id = '28000000-0000-0000-0000-000000000002'),
  false,
  'desativação do acesso histórico é persistida'
);

SELECT * FROM extensions.finish();
ROLLBACK;
