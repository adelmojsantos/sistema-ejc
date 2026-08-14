BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(12);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('17000000-0000-0000-0000-000000000001', 'delete-admin@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('17000000-0000-0000-0000-000000000002', 'delete-reader@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('17000000-0000-0000-0000-000000000003', 'linked-person@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.grupos (id, nome, descricao)
VALUES ('67000000-0000-0000-0000-000000000001', 'Teste exclusão pessoa', 'Fixture transacional');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '67000000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_admin';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES ('17000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000001', NULL);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES ('27000000-0000-0000-0000-000000000001', 'Teste exclusão pessoa', current_date, current_date + 2, true, 99201);

INSERT INTO public.equipes (id, nome)
VALUES ('37000000-0000-0000-0000-000000000001', 'Equipe exclusão');

INSERT INTO public.pessoas (id, nome_completo, email, cpf)
VALUES
  ('47000000-0000-0000-0000-000000000001', 'Pessoa Excluível', 'deletable-person@example.test', '99200000001'),
  ('47000000-0000-0000-0000-000000000002', 'Pessoa Protegida', 'linked-person@example.test', '99200000002'),
  ('47000000-0000-0000-0000-000000000003', 'Pessoa Sem Permissão', 'denied-person@example.test', '99200000003');

UPDATE public.profiles
SET pessoa_id = '47000000-0000-0000-0000-000000000002'
WHERE id = '17000000-0000-0000-0000-000000000003';

INSERT INTO public.participacoes (id, pessoa_id, encontro_id, equipe_id, participante, coordenador)
VALUES ('57000000-0000-0000-0000-000000000001', '47000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001', false, false);

INSERT INTO public.visita_grupos (id, encontro_id, nome)
VALUES ('58000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', 'Dupla exclusão');

INSERT INTO public.visita_participacao (id, grupo_id, participacao_id, visitante)
VALUES ('59000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000001', '57000000-0000-0000-0000-000000000001', true);

INSERT INTO public.participacoes_canceladas (
  id, pessoa_id, encontro_id, motivo_cancelamento, dados_snapshot
)
VALUES (
  '5a000000-0000-0000-0000-000000000001',
  '47000000-0000-0000-0000-000000000001',
  '27000000-0000-0000-0000-000000000001',
  'Fixture de exclusão',
  '{}'::jsonb
);

SELECT set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.get_exclusao_pessoa_impacto('47000000-0000-0000-0000-000000000003')$$,
  '42501',
  'Somente administradores podem excluir pessoas definitivamente',
  'usuário comum não consulta o impacto'
);

SELECT extensions.throws_ok(
  $$SELECT public.excluir_pessoa_definitivamente('47000000-0000-0000-0000-000000000003', 'Pessoa Sem Permissão')$$,
  '42501',
  'Somente administradores podem excluir pessoas definitivamente',
  'usuário comum não exclui uma pessoa'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (public.get_exclusao_pessoa_impacto('47000000-0000-0000-0000-000000000001')->>'participacoes')::integer,
  1,
  'diagnóstico contabiliza participação'
);

SELECT extensions.is(
  (public.get_exclusao_pessoa_impacto('47000000-0000-0000-0000-000000000001')->>'cancelamentos')::integer,
  1,
  'diagnóstico contabiliza cancelamento'
);

SELECT extensions.throws_ok(
  $$SELECT public.excluir_pessoa_definitivamente('47000000-0000-0000-0000-000000000001', 'nome incorreto')$$,
  '22023',
  'Digite o nome completo exatamente como exibido para confirmar a exclusão',
  'nome incorreto não confirma exclusão'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.pessoas WHERE id = '47000000-0000-0000-0000-000000000001'),
  1,
  'falha de confirmação preserva a pessoa'
);

SELECT extensions.throws_ok(
  $$SELECT public.excluir_pessoa_definitivamente('47000000-0000-0000-0000-000000000002', 'Pessoa Protegida')$$,
  '23503',
  'Esta pessoa possui uma conta de acesso vinculada. Desvincule ou exclua o usuário antes de continuar',
  'conta de acesso vinculada bloqueia exclusão'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.pessoas WHERE id = '47000000-0000-0000-0000-000000000002'),
  1,
  'bloqueio de conta vinculada preserva a pessoa'
);

SELECT extensions.lives_ok(
  $$SELECT public.excluir_pessoa_definitivamente('47000000-0000-0000-0000-000000000001', 'Pessoa Excluível')$$,
  'administrador exclui definitivamente a pessoa'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.pessoas WHERE id = '47000000-0000-0000-0000-000000000001'),
  0,
  'pessoa é excluída'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.participacoes WHERE pessoa_id = '47000000-0000-0000-0000-000000000001'),
  0,
  'participações são excluídas'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.participacoes_canceladas WHERE pessoa_id = '47000000-0000-0000-0000-000000000001'),
  0,
  'histórico de cancelamentos é excluído'
);

SELECT * FROM extensions.finish();
ROLLBACK;
