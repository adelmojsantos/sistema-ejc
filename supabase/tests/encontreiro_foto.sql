BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(13);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('17000000-0000-0000-0000-000000000001', 'foto-manager@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('17000000-0000-0000-0000-000000000002', 'foto-coordinator@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('17000000-0000-0000-0000-000000000003', 'foto-other-coordinator@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.grupos (id, nome, descricao)
VALUES
  ('67000000-0000-0000-0000-000000000001', 'Teste foto secretaria', 'Fixture transacional'),
  ('67000000-0000-0000-0000-000000000002', 'Teste foto coordenação', 'Fixture transacional');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '67000000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_secretaria';

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '67000000-0000-0000-0000-000000000002'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_coordenador';

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES
  ('27000000-0000-0000-0000-000000000001', 'Teste foto ativo', current_date, current_date + 2, true, 99201),
  ('27000000-0000-0000-0000-000000000002', 'Teste foto histórico', current_date - 10, current_date - 8, false, 99202);

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES
  ('17000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000001', NULL),
  ('17000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000002', NULL),
  ('17000000-0000-0000-0000-000000000003', '67000000-0000-0000-0000-000000000002', NULL);

INSERT INTO public.equipes (id, nome)
VALUES
  ('37000000-0000-0000-0000-000000000001', 'Equipe foto A'),
  ('37000000-0000-0000-0000-000000000002', 'Equipe foto B');

INSERT INTO public.pessoas (id, nome_completo, email, cpf)
VALUES
  ('47000000-0000-0000-0000-000000000001', 'Coordenador Foto A', 'foto-coordinator@example.test', '99200000001'),
  ('47000000-0000-0000-0000-000000000002', 'Coordenador Foto B', 'foto-other-coordinator@example.test', '99200000002'),
  ('47000000-0000-0000-0000-000000000003', 'Integrante Foto A', 'foto-member@example.test', '99200000003'),
  ('47000000-0000-0000-0000-000000000004', 'Encontrista Foto', 'foto-participant@example.test', '99200000004'),
  ('47000000-0000-0000-0000-000000000005', 'Integrante Foto Histórico', 'foto-history@example.test', '99200000005');

UPDATE public.profiles
SET pessoa_id = '47000000-0000-0000-0000-000000000001'
WHERE id = '17000000-0000-0000-0000-000000000002';

UPDATE public.profiles
SET pessoa_id = '47000000-0000-0000-0000-000000000002'
WHERE id = '17000000-0000-0000-0000-000000000003';

INSERT INTO public.participacoes (id, pessoa_id, encontro_id, equipe_id, participante, coordenador)
VALUES
  ('57000000-0000-0000-0000-000000000001', '47000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001', false, true),
  ('57000000-0000-0000-0000-000000000002', '47000000-0000-0000-0000-000000000002', '27000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000002', false, true),
  ('57000000-0000-0000-0000-000000000003', '47000000-0000-0000-0000-000000000003', '27000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001', false, false),
  ('57000000-0000-0000-0000-000000000004', '47000000-0000-0000-0000-000000000004', '27000000-0000-0000-0000-000000000001', NULL, true, false),
  ('57000000-0000-0000-0000-000000000005', '47000000-0000-0000-0000-000000000005', '27000000-0000-0000-0000-000000000002', '37000000-0000-0000-0000-000000000001', false, false);

-- Coordenador da própria equipe
SELECT set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.definir_foto_encontreiro('57000000-0000-0000-0000-000000000003', 'https://arquivos.example.test/fotos/encontreiros/a.webp', 40)$$,
  'coordenador define foto de integrante da própria equipe'
);

RESET ROLE;

SELECT extensions.results_eq(
  $$SELECT foto_url, foto_posicao_y FROM public.participacoes WHERE id = '57000000-0000-0000-0000-000000000003'$$,
  $$VALUES ('https://arquivos.example.test/fotos/encontreiros/a.webp'::text, 40)$$,
  'foto e enquadramento são gravados'
);

SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.definir_foto_encontreiro('57000000-0000-0000-0000-000000000003', 'javascript:alert(1)', 50)$$,
  '22023',
  'Endereço da foto inválido',
  'URL fora do padrão https é recusada'
);

SELECT extensions.throws_ok(
  $$SELECT public.definir_foto_encontreiro('57000000-0000-0000-0000-000000000003', 'https://arquivos.example.test/fotos/a.webp', 101)$$,
  '22023',
  'Enquadramento da foto deve estar entre 0 e 100',
  'enquadramento fora do intervalo é recusado'
);

SELECT extensions.throws_ok(
  $$SELECT public.definir_foto_encontreiro('57000000-0000-0000-0000-000000000004', 'https://arquivos.example.test/fotos/b.webp', 50)$$,
  '22023',
  'A foto de encontristas é gerenciada pela Secretaria',
  'coordenador não altera foto de encontrista'
);

SELECT extensions.throws_ok(
  $$SELECT public.definir_foto_encontreiro('57000000-0000-0000-0000-000000000005', 'https://arquivos.example.test/fotos/c.webp', 50)$$,
  '42501',
  'Você não possui permissão para alterar a foto deste integrante',
  'coordenador não altera participação de encontro em que não coordena'
);

SELECT extensions.lives_ok(
  $$SELECT public.definir_foto_encontreiro('57000000-0000-0000-0000-000000000003', NULL, 80)$$,
  'coordenador remove a foto'
);

RESET ROLE;

SELECT extensions.results_eq(
  $$SELECT foto_url, foto_posicao_y FROM public.participacoes WHERE id = '57000000-0000-0000-0000-000000000003'$$,
  $$VALUES (NULL::text, 50)$$,
  'remoção limpa foto e restaura enquadramento padrão'
);

-- Coordenador de outra equipe
SELECT set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.definir_foto_encontreiro('57000000-0000-0000-0000-000000000003', 'https://arquivos.example.test/fotos/d.webp', 50)$$,
  '42501',
  'Você não possui permissão para alterar a foto deste integrante',
  'coordenador de outra equipe é recusado'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT foto_url FROM public.participacoes WHERE id = '57000000-0000-0000-0000-000000000003'),
  NULL,
  'falha de autorização preserva a participação'
);

-- Secretaria
SELECT set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.definir_foto_encontreiro('57000000-0000-0000-0000-000000000005', 'https://arquivos.example.test/fotos/e.webp', 50)$$,
  'secretaria ajusta foto de encontro histórico'
);

RESET ROLE;

-- Anônimo
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE anon;

SELECT extensions.throws_ok(
  $$SELECT public.definir_foto_encontreiro('57000000-0000-0000-0000-000000000003', 'https://arquivos.example.test/fotos/f.webp', 50)$$,
  '42501',
  NULL,
  'anônimo não executa a função'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT foto_url FROM public.participacoes WHERE id = '57000000-0000-0000-0000-000000000005'),
  'https://arquivos.example.test/fotos/e.webp',
  'alteração da secretaria é gravada'
);

SELECT * FROM extensions.finish();
RESET ROLE;
ROLLBACK;
