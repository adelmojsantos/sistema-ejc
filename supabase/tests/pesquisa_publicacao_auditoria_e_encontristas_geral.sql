BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(9);

INSERT INTO auth.users (id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, is_sso_user, is_anonymous)
VALUES
  ('17000000-0000-0000-0000-000000000001', 'audit.admin@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('17000000-0000-0000-0000-000000000002', 'audit.viewer@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

UPDATE public.profiles SET role = 'admin' WHERE id = '17000000-0000-0000-0000-000000000001';
INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES ('17000000-0000-0000-0000-000000000001', '00000000-0000-0000-0002-000000000001', NULL);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES ('27000000-0000-0000-0000-000000000001', 'Pesquisa encontristas geral', current_date, current_date + 2, false, 99701);
INSERT INTO public.pessoas (id, nome_completo, cpf)
VALUES ('37000000-0000-0000-0000-000000000001', 'Encontrista do círculo', '99701000001');
INSERT INTO public.participacoes (id, pessoa_id, encontro_id, participante, coordenador)
VALUES ('47000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', true, false);
INSERT INTO public.circulos (id, nome) VALUES (99701, 'Círculo teste');
INSERT INTO public.circulo_participacao (circulo_id, participacao, mediador)
VALUES (99701, '47000000-0000-0000-0000-000000000001', false);
INSERT INTO public.pesquisa_encontrista_perguntas (encontro_id, ordem, section_id, section_title, title, type, active)
VALUES ('27000000-0000-0000-0000-000000000001', 1, 'geral', 'Geral', 'Pergunta?', 'texto', true);

SELECT set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
INSERT INTO public.pesquisa_encontrista_config (encontro_id, publicada, publicada_em)
VALUES ('27000000-0000-0000-0000-000000000001', true, now());

SELECT extensions.has_function('public', 'get_pesquisa_encontrista_general_info', ARRAY['uuid'], 'RPC geral existe');
SELECT extensions.has_function('public', 'get_pesquisa_encontrista_circulo_info', ARRAY['uuid', 'bigint'], 'RPC do círculo existe');

SET LOCAL ROLE anon;
SELECT extensions.is(
  jsonb_array_length(public.get_pesquisa_encontrista_general_info('27000000-0000-0000-0000-000000000001')->'circulos'),
  1,
  'link geral lista o círculo do encontro publicado'
);
SELECT extensions.is(
  jsonb_array_length(public.get_pesquisa_encontrista_circulo_info('27000000-0000-0000-0000-000000000001', 99701)->'participantes'),
  1,
  'círculo escolhido retorna apenas seus encontristas'
);
RESET ROLE;

UPDATE public.pesquisa_encontrista_config SET publicada = false, publicada_em = NULL
WHERE encontro_id = '27000000-0000-0000-0000-000000000001';

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.pesquisa_publicacao_auditoria WHERE encontro_id = '27000000-0000-0000-0000-000000000001'),
  2,
  'publicação e despublicação geram dois eventos'
);
SELECT extensions.is(
  (SELECT realizado_por FROM public.pesquisa_publicacao_auditoria WHERE encontro_id = '27000000-0000-0000-0000-000000000001' ORDER BY realizado_em DESC LIMIT 1),
  '17000000-0000-0000-0000-000000000001'::uuid,
  'auditoria registra o administrador responsável'
);

UPDATE public.pesquisa_encontrista_config SET publicada = false
WHERE encontro_id = '27000000-0000-0000-0000-000000000001';
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.pesquisa_publicacao_auditoria WHERE encontro_id = '27000000-0000-0000-0000-000000000001'),
  2,
  'atualização sem mudança de estado não duplica auditoria'
);

SET LOCAL ROLE anon;
SELECT extensions.throws_ok(
  $$SELECT public.get_pesquisa_encontrista_general_info('27000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Pesquisa ainda não publicada.', 'link geral bloqueia pesquisa despublicada'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.pesquisa_publicacao_auditoria),
  0,
  'usuário comum não consulta a auditoria'
);
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
