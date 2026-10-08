BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(11);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('1e000000-0000-0000-0000-000000000001', 'assign-admin@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('1e000000-0000-0000-0000-000000000002', 'assign-viewer@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('1e000000-0000-0000-0000-000000000003', 'assign-cadastros@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.grupos (id, nome, descricao)
VALUES ('7e000000-0000-0000-0000-000000000001', 'Cadastro atribuições', 'Fixture de permissão');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '7e000000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_cadastros';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES
  ('1e000000-0000-0000-0000-000000000001', '00000000-0000-0000-0002-000000000001', NULL),
  ('1e000000-0000-0000-0000-000000000003', '7e000000-0000-0000-0000-000000000001', NULL);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES ('2e000000-0000-0000-0000-000000000001', 'Encontro de destino', current_date, current_date + 2, true, 99811);

INSERT INTO public.equipes (id, nome, deleted_at)
VALUES
  ('3e000000-0000-0000-0000-000000000001', 'Equipe disponível', NULL),
  ('3e000000-0000-0000-0000-000000000002', 'Equipe ocupada', NULL),
  ('3e000000-0000-0000-0000-000000000003', 'Equipe removida', now());

INSERT INTO public.pessoas (id, nome_completo, cpf)
VALUES
  ('4e000000-0000-0000-0000-000000000001', 'Pessoa nova', '99811000001'),
  ('4e000000-0000-0000-0000-000000000002', 'Pessoa sem equipe', '99811000002'),
  ('4e000000-0000-0000-0000-000000000003', 'Pessoa com equipe', '99811000003'),
  ('4e000000-0000-0000-0000-000000000004', 'Pessoa lote atômico', '99811000004'),
  ('4e000000-0000-0000-0000-000000000005', 'Pessoa cadastro', '99811000005');

INSERT INTO public.participacoes (
  id, pessoa_id, encontro_id, equipe_id, participante, coordenador
)
VALUES
  ('5e000000-0000-0000-0000-000000000002', '4e000000-0000-0000-0000-000000000002', '2e000000-0000-0000-0000-000000000001', NULL, true, true),
  ('5e000000-0000-0000-0000-000000000003', '4e000000-0000-0000-0000-000000000003', '2e000000-0000-0000-0000-000000000001', '3e000000-0000-0000-0000-000000000002', false, false);

SELECT extensions.has_function(
  'public',
  'assign_team_preferences_batch',
  ARRAY['uuid', 'jsonb'],
  'RPC de atribuição em lote existe'
);

SELECT set_config('request.jwt.claim.sub', '1e000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.assign_team_preferences_batch(
    '2e000000-0000-0000-0000-000000000001',
    '[{"pessoa_id":"4e000000-0000-0000-0000-000000000001","equipe_id":"3e000000-0000-0000-0000-000000000001"}]'
  )$$,
  '42501',
  'Sem permissão para atribuir equipes.',
  'usuário sem permissão não atribui equipes'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '1e000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  public.assign_team_preferences_batch(
    '2e000000-0000-0000-0000-000000000001',
    '[
      {"pessoa_id":"4e000000-0000-0000-0000-000000000001","equipe_id":"3e000000-0000-0000-0000-000000000001"},
      {"pessoa_id":"4e000000-0000-0000-0000-000000000002","equipe_id":"3e000000-0000-0000-0000-000000000001"}
    ]'
  ),
  '{"total": 2, "created": 1, "updated": 1}'::jsonb,
  'lote informa vínculos criados e atualizados'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.participacoes
    WHERE pessoa_id = '4e000000-0000-0000-0000-000000000001'
      AND encontro_id = '2e000000-0000-0000-0000-000000000001'
      AND equipe_id = '3e000000-0000-0000-0000-000000000001'
      AND participante = false
  ),
  'pessoa sem vínculo recebe nova participação de equipe'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.participacoes
    WHERE pessoa_id = '4e000000-0000-0000-0000-000000000002'
      AND equipe_id = '3e000000-0000-0000-0000-000000000001'
      AND participante = true
      AND coordenador = true
  ),
  'vínculo sem equipe é completado sem alterar os demais dados'
);

SELECT extensions.throws_ok(
  $$SELECT public.assign_team_preferences_batch(
    '2e000000-0000-0000-0000-000000000001',
    '[
      {"pessoa_id":"4e000000-0000-0000-0000-000000000004","equipe_id":"3e000000-0000-0000-0000-000000000001"},
      {"pessoa_id":"4e000000-0000-0000-0000-000000000003","equipe_id":"3e000000-0000-0000-0000-000000000001"}
    ]'
  )$$,
  '23505',
  'Uma ou mais pessoas já possuem equipe no encontro atual.',
  'lote não move pessoa que já possui equipe'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.participacoes
   WHERE pessoa_id = '4e000000-0000-0000-0000-000000000004'),
  0,
  'falha em uma atribuição reverte todo o lote'
);

SELECT extensions.throws_ok(
  $$SELECT public.assign_team_preferences_batch(
    '2e000000-0000-0000-0000-000000000001',
    '[
      {"pessoa_id":"4e000000-0000-0000-0000-000000000004","equipe_id":"3e000000-0000-0000-0000-000000000001"},
      {"pessoa_id":"4e000000-0000-0000-0000-000000000004","equipe_id":"3e000000-0000-0000-0000-000000000002"}
    ]'
  )$$,
  '22023',
  'Cada pessoa pode aparecer apenas uma vez no lote.',
  'lote rejeita pessoa duplicada'
);

SELECT extensions.throws_ok(
  $$SELECT public.assign_team_preferences_batch(
    '2e000000-0000-0000-0000-000000000001',
    '[{"pessoa_id":"4e000000-0000-0000-0000-000000000004","equipe_id":"3e000000-0000-0000-0000-000000000003"}]'
  )$$,
  '22023',
  'Equipe não encontrada ou indisponível.',
  'equipe removida não recebe atribuições'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '1e000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.assign_team_preferences_batch(
    '2e000000-0000-0000-0000-000000000001',
    '[{"pessoa_id":"4e000000-0000-0000-0000-000000000005","equipe_id":"3e000000-0000-0000-0000-000000000001"}]'
  )$$,
  'usuário de cadastros pode atribuir equipes'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.participacoes
    WHERE pessoa_id = '4e000000-0000-0000-0000-000000000005'
      AND equipe_id = '3e000000-0000-0000-0000-000000000001'
  ),
  'atribuição autorizada é persistida'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
