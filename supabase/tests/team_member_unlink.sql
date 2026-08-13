BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(10);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('16000000-0000-0000-0000-000000000001', 'unlink-manager@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('16000000-0000-0000-0000-000000000002', 'unlink-coordinator@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('16000000-0000-0000-0000-000000000003', 'unlink-reader@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.grupos (id, nome, descricao)
VALUES
  ('66000000-0000-0000-0000-000000000001', 'Teste desvinculação administrativa', 'Fixture transacional'),
  ('66000000-0000-0000-0000-000000000002', 'Teste desvinculação coordenação', 'Fixture transacional');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '66000000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_cadastros';

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '66000000-0000-0000-0000-000000000002'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_coordenador';

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES
  ('26000000-0000-0000-0000-000000000001', 'Teste desvinculação ativa', current_date, current_date + 2, true, 99101),
  ('26000000-0000-0000-0000-000000000002', 'Teste desvinculação histórica', current_date - 10, current_date - 8, false, 99102);

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES
  ('16000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000001', NULL),
  ('16000000-0000-0000-0000-000000000002', '66000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000001');

INSERT INTO public.equipes (id, nome)
VALUES ('36000000-0000-0000-0000-000000000001', 'Equipe de teste');

INSERT INTO public.pessoas (id, nome_completo, email, cpf)
VALUES
  ('46000000-0000-0000-0000-000000000001', 'Coordenador Teste', 'unlink-coordinator@example.test', '99100000001'),
  ('46000000-0000-0000-0000-000000000002', 'Integrante com dupla', 'member-visit@example.test', '99100000002'),
  ('46000000-0000-0000-0000-000000000003', 'Integrante coordenado', 'member-team@example.test', '99100000003'),
  ('46000000-0000-0000-0000-000000000004', 'Integrante não autorizado', 'member-denied@example.test', '99100000004'),
  ('46000000-0000-0000-0000-000000000005', 'Encontrista protegido', 'participant-protected@example.test', '99100000005'),
  ('46000000-0000-0000-0000-000000000006', 'Integrante histórico', 'member-history@example.test', '99100000006');

UPDATE public.profiles
SET pessoa_id = '46000000-0000-0000-0000-000000000001'
WHERE id = '16000000-0000-0000-0000-000000000002';

INSERT INTO public.participacoes (id, pessoa_id, encontro_id, equipe_id, participante, coordenador)
VALUES
  ('56000000-0000-0000-0000-000000000001', '46000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', false, true),
  ('56000000-0000-0000-0000-000000000002', '46000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', false, false),
  ('56000000-0000-0000-0000-000000000003', '46000000-0000-0000-0000-000000000003', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', false, false),
  ('56000000-0000-0000-0000-000000000004', '46000000-0000-0000-0000-000000000004', '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', false, false),
  ('56000000-0000-0000-0000-000000000005', '46000000-0000-0000-0000-000000000005', '26000000-0000-0000-0000-000000000001', NULL, true, false),
  ('56000000-0000-0000-0000-000000000006', '46000000-0000-0000-0000-000000000006', '26000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', false, false);

INSERT INTO public.visita_grupos (id, encontro_id, nome)
VALUES ('57000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', 'Dupla fixture');

INSERT INTO public.visita_participacao (id, grupo_id, participacao_id, visitante)
VALUES ('58000000-0000-0000-0000-000000000001', '57000000-0000-0000-0000-000000000001', '56000000-0000-0000-0000-000000000002', true);

SELECT set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.desvincular_integrante_encontro('56000000-0000-0000-0000-000000000002')$$,
  'gestor desvincula integrante com vínculo de visitação'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.participacoes WHERE id = '56000000-0000-0000-0000-000000000002'),
  0,
  'participação é removida'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.visita_participacao WHERE participacao_id = '56000000-0000-0000-0000-000000000002'),
  0,
  'vínculo de visitação é removido antes da participação'
);

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.visita_grupos WHERE id = '57000000-0000-0000-0000-000000000001'),
  'grupo de visitação permanece disponível para recomposição'
);

SELECT set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.desvincular_integrante_encontro('56000000-0000-0000-0000-000000000003')$$,
  'coordenador desvincula integrante da própria equipe'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.participacoes WHERE id = '56000000-0000-0000-0000-000000000003'),
  0,
  'participação coordenada é removida'
);

SELECT set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.desvincular_integrante_encontro('56000000-0000-0000-0000-000000000004')$$,
  '42501',
  'Você não possui permissão para desvincular este integrante',
  'usuário sem permissão não desvincula integrante'
);

RESET ROLE;

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.participacoes WHERE id = '56000000-0000-0000-0000-000000000004'),
  'falha de autorização preserva a participação'
);

SELECT set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.desvincular_integrante_encontro('56000000-0000-0000-0000-000000000005')$$,
  '22023',
  'Encontristas devem ser cancelados pelo fluxo de cancelamento de participação',
  'encontrista não pode ser removido pelo fluxo de equipes'
);

SELECT extensions.throws_ok(
  $$SELECT public.desvincular_integrante_encontro('56000000-0000-0000-0000-000000000006')$$,
  '22023',
  'Integrantes só podem ser desvinculados do encontro ativo',
  'encontro histórico permanece imutável'
);

SELECT * FROM extensions.finish();
RESET ROLE;
ROLLBACK;
