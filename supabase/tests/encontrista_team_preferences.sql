BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(6);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('1f000000-0000-0000-0000-000000000001', 'preferences-admin@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('1f000000-0000-0000-0000-000000000002', 'preferences-viewer@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('1f000000-0000-0000-0000-000000000003', 'preferences-cadastros@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.grupos (id, nome, descricao)
VALUES ('7f000000-0000-0000-0000-000000000001', 'Cadastro preferências', 'Fixture de permissão');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '7f000000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_cadastros';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES
  ('1f000000-0000-0000-0000-000000000001', '00000000-0000-0000-0002-000000000001', NULL),
  ('1f000000-0000-0000-0000-000000000003', '7f000000-0000-0000-0000-000000000001', NULL);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES ('2f000000-0000-0000-0000-000000000001', 'Encontro de origem', current_date - 30, current_date - 28, false, 99801);

INSERT INTO public.equipes (id, nome)
VALUES
  ('3f000000-0000-0000-0000-000000000001', 'Compras preferência'),
  ('3f000000-0000-0000-0000-000000000002', 'Recepção preferência');

INSERT INTO public.pessoas (id, nome_completo, cpf)
VALUES ('4f000000-0000-0000-0000-000000000001', 'Encontrista preferência', '99801000001');

INSERT INTO public.participacoes (id, pessoa_id, encontro_id, participante, coordenador)
VALUES ('5f000000-0000-0000-0000-000000000001', '4f000000-0000-0000-0000-000000000001', '2f000000-0000-0000-0000-000000000001', true, false);

INSERT INTO public.pesquisa_encontrista_envios (encontro_id, participacao_id, respostas, status, enviado_em)
VALUES (
  '2f000000-0000-0000-0000-000000000001',
  '5f000000-0000-0000-0000-000000000001',
  '{"pergunta-1":{"texto":"Resposta teste"}}'::jsonb,
  'enviado',
  now()
);

INSERT INTO public.pos_encontro_fichas (id, encontro_id, participacao_id, tem_carro)
VALUES ('6f000000-0000-0000-0000-000000000001', '2f000000-0000-0000-0000-000000000001', '5f000000-0000-0000-0000-000000000001', true);

INSERT INTO public.pos_encontro_ficha_equipes (ficha_id, equipe_id, ordem_preferencia)
VALUES
  ('6f000000-0000-0000-0000-000000000001', '3f000000-0000-0000-0000-000000000001', 1),
  ('6f000000-0000-0000-0000-000000000001', '3f000000-0000-0000-0000-000000000002', 2);

SELECT extensions.has_function(
  'public',
  'get_encontrista_team_preferences',
  ARRAY['uuid'],
  'RPC de preferências existe'
);

SELECT set_config('request.jwt.claim.sub', '1f000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.get_encontrista_team_preferences('2f000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Sem permissão para consultar as preferências dos encontristas.',
  'usuário sem permissão não consulta preferências'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '1f000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  public.get_encontrista_team_preferences('2f000000-0000-0000-0000-000000000001')->'encontro'->>'nome',
  'Encontro de origem',
  'retorno identifica o encontro de origem'
);

SELECT extensions.is(
  jsonb_array_length(public.get_encontrista_team_preferences('2f000000-0000-0000-0000-000000000001')->'encontristas'),
  1,
  'retorno fica restrito aos encontristas do encontro'
);

SELECT extensions.is(
  public.get_encontrista_team_preferences('2f000000-0000-0000-0000-000000000001')->'encontristas'->0->'preferencias'->0->>'ordemPreferencia',
  '1',
  'preferências preservam a ordem escolhida'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '1f000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.get_encontrista_team_preferences('2f000000-0000-0000-0000-000000000001')$$,
  'usuário de cadastros pode consultar preferências'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
