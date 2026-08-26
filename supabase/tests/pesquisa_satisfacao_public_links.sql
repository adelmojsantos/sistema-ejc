BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(13);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES
  ('2a000000-0000-0000-0000-000000000001', 'Pesquisa pública A', current_date - 5, current_date - 3, false, 99801),
  ('2a000000-0000-0000-0000-000000000002', 'Pesquisa pública B', current_date - 10, current_date - 8, false, 99802);

INSERT INTO public.equipes (id, nome)
VALUES
  ('3a000000-0000-0000-0000-000000000001', 'Equipe do encontro A'),
  ('3a000000-0000-0000-0000-000000000002', 'Equipe do encontro B');

INSERT INTO public.pessoas (id, nome_completo, cpf)
VALUES
  ('4a000000-0000-0000-0000-000000000001', 'Integrante A', '99801000001'),
  ('4a000000-0000-0000-0000-000000000002', 'Integrante B', '99801000002');

INSERT INTO public.participacoes (id, pessoa_id, encontro_id, equipe_id, participante, coordenador)
VALUES
  ('5a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', false, false),
  ('5a000000-0000-0000-0000-000000000002', '4a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000002', '3a000000-0000-0000-0000-000000000002', false, false);

INSERT INTO public.pesquisa_satisfacao_perguntas (
  encontro_id, ordem, section_id, section_title, title, type, required, active
)
VALUES (
  '2a000000-0000-0000-0000-000000000001', 1, 'geral', 'Geral', 'Pergunta pública?', 'texto', true, true
);

INSERT INTO public.pesquisa_satisfacao_config (encontro_id, publicada, publicada_em)
VALUES
  ('2a000000-0000-0000-0000-000000000001', true, now()),
  ('2a000000-0000-0000-0000-000000000002', true, now())
ON CONFLICT (encontro_id) DO UPDATE
SET publicada = EXCLUDED.publicada,
    publicada_em = EXCLUDED.publicada_em;

SELECT extensions.has_function(
  'public',
  'get_pesquisa_satisfacao_public_info',
  ARRAY['uuid', 'uuid'],
  'RPC público da pesquisa está disponível'
);

SELECT extensions.has_function(
  'public',
  'get_pesquisa_satisfacao_general_info',
  ARRAY['uuid'],
  'RPC do acesso geral está disponível'
);

SELECT extensions.has_function(
  'public',
  'get_pesquisa_satisfacao_public_questions',
  ARRAY['uuid'],
  'RPC de perguntas públicas está disponível'
);

SET LOCAL ROLE anon;

SELECT extensions.lives_ok(
  $$SELECT public.get_pesquisa_satisfacao_public_info(
    '2a000000-0000-0000-0000-000000000001',
    '3a000000-0000-0000-0000-000000000001'
  )$$,
  'link com equipe pertencente ao encontro é aceito'
);

SELECT extensions.is(
  jsonb_array_length(public.get_pesquisa_satisfacao_public_info(
    '2a000000-0000-0000-0000-000000000001',
    '3a000000-0000-0000-0000-000000000001'
  )->'participantes'),
  1,
  'link válido retorna somente os participantes da equipe no encontro'
);

SELECT extensions.throws_ok(
  $$SELECT public.get_pesquisa_satisfacao_public_info(
    '2a000000-0000-0000-0000-000000000001',
    '3a000000-0000-0000-0000-000000000002'
  )$$,
  'P0001',
  'Equipe não encontrada neste encontro.',
  'link que combina encontro e equipe diferentes é rejeitado'
);

SELECT extensions.lives_ok(
  $$SELECT public.get_pesquisa_satisfacao_general_info(
    '2a000000-0000-0000-0000-000000000001'
  )$$,
  'acesso geral de uma pesquisa publicada é aceito'
);

SELECT extensions.is(
  jsonb_array_length(public.get_pesquisa_satisfacao_general_info(
    '2a000000-0000-0000-0000-000000000001'
  )->'equipes'),
  1,
  'acesso geral retorna somente equipes vinculadas ao encontro'
);

SELECT extensions.is(
  (SELECT count(*)::integer
   FROM public.get_pesquisa_satisfacao_public_questions(
     '2a000000-0000-0000-0000-000000000001'
   )),
  1,
  'RPC pública retorna somente as perguntas ativas do encontro publicado'
);

RESET ROLE;

UPDATE public.pesquisa_satisfacao_config
SET publicada = false,
    publicada_em = NULL
WHERE encontro_id = '2a000000-0000-0000-0000-000000000001';

SET LOCAL ROLE anon;

SELECT extensions.throws_ok(
  $$SELECT public.get_pesquisa_satisfacao_general_info(
    '2a000000-0000-0000-0000-000000000001'
  )$$,
  'P0001',
  'Pesquisa ainda não publicada.',
  'acesso geral é bloqueado quando a pesquisa não está publicada'
);

SELECT extensions.throws_ok(
  $$SELECT * FROM public.get_pesquisa_satisfacao_public_questions(
    '2a000000-0000-0000-0000-000000000001'
  )$$,
  'P0001',
  'Pesquisa ainda não publicada.',
  'perguntas públicas são bloqueadas quando a pesquisa não está publicada'
);

RESET ROLE;

UPDATE public.pesquisa_satisfacao_config
SET publicada = true,
    publicada_em = now()
WHERE encontro_id = '2a000000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.get_pesquisa_satisfacao_general_info(
    '2a000000-0000-0000-0000-000000000001'
  )$$,
  'usuário autenticado também acessa o link da pesquisa'
);

SELECT extensions.lives_ok(
  $$SELECT * FROM public.get_pesquisa_satisfacao_public_questions(
    '2a000000-0000-0000-0000-000000000001'
  )$$,
  'usuário autenticado também carrega as perguntas públicas'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
