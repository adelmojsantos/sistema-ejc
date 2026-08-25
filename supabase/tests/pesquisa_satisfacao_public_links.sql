BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(4);

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

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
