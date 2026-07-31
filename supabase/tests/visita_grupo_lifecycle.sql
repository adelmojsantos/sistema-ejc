BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(16);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('15000000-0000-0000-0000-000000000001', 'visit-manager@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('15000000-0000-0000-0000-000000000002', 'visit-reader@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.grupos (id, nome, descricao)
VALUES ('65000000-0000-0000-0000-000000000001', 'Teste gestão de visitação', 'Fixture transacional');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '65000000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_admin';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES ('15000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000001', NULL);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES ('25000000-0000-0000-0000-000000000001', 'Teste ciclo dupla', current_date, current_date + 2, true, 99001);

INSERT INTO public.pessoas (id, nome_completo, cpf)
VALUES
  ('35000000-0000-0000-0000-000000000001', 'Ana Silva', '99000000001'),
  ('35000000-0000-0000-0000-000000000002', 'Bruno Souza', '99000000002'),
  ('35000000-0000-0000-0000-000000000003', 'Carlos Lima', '99000000003'),
  ('35000000-0000-0000-0000-000000000004', 'Encontrista Teste', '99000000004');

INSERT INTO public.participacoes (id, pessoa_id, encontro_id, participante, coordenador)
VALUES
  ('45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', false, false),
  ('45000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000001', false, false),
  ('45000000-0000-0000-0000-000000000003', '35000000-0000-0000-0000-000000000003', '25000000-0000-0000-0000-000000000001', false, false),
  ('45000000-0000-0000-0000-000000000004', '35000000-0000-0000-0000-000000000004', '25000000-0000-0000-0000-000000000001', true, false);

SELECT set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.get_visita_grupo_delete_impact('55000000-0000-0000-0000-000000000001')$$,
  '42501',
  'permission denied to manage visitation groups',
  'usuário sem permissão não consulta impacto'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.create_visita_grupo(
    '25000000-0000-0000-0000-000000000001',
    '45000000-0000-0000-0000-000000000001',
    '45000000-0000-0000-0000-000000000002'
  )$$,
  'criação transacional da dupla funciona'
);

SELECT extensions.is(
  (SELECT nome FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001'),
  'Ana & Bruno',
  'nome inicial é gerado pelos visitantes'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.visita_participacao WHERE visitante = true),
  2,
  'criação inclui exatamente dois visitantes'
);

SELECT extensions.lives_ok(
  $$SELECT public.rename_visita_grupo(
    (SELECT id FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001'),
    'Missionários'
  )$$,
  'renomeação manual funciona'
);

UPDATE public.pessoas SET nome_completo = 'Ana Paula Silva'
WHERE id = '35000000-0000-0000-0000-000000000001';

SELECT extensions.is(
  (SELECT nome FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001'),
  'Missionários',
  'nome personalizado não é sobrescrito ao corrigir a pessoa'
);

SELECT extensions.lives_ok(
  $$SELECT public.replace_visita_grupo_visitor(
    (SELECT id FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001'),
    (SELECT id FROM public.visita_participacao WHERE participacao_id = '45000000-0000-0000-0000-000000000001' AND visitante = true),
    '45000000-0000-0000-0000-000000000003'
  )$$,
  'substituição transacional funciona'
);

SELECT extensions.is(
  (SELECT nome FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001'),
  'Carlos & Bruno',
  'substituição regenera até um nome antes personalizado'
);

UPDATE public.pessoas SET nome_completo = 'Daniel Lima'
WHERE id = '35000000-0000-0000-0000-000000000003';

SELECT extensions.is(
  (SELECT nome FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001'),
  'Daniel & Bruno',
  'correção da pessoa atualiza um nome automático'
);

SELECT extensions.lives_ok(
  $$SELECT public.assign_visita_participant(
    (SELECT id FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001'),
    '45000000-0000-0000-0000-000000000004'
  )$$,
  'encontrista é vinculado à dupla'
);

UPDATE public.visita_participacao
SET status = 'realizada', foto_familia_url = 'r2://fixture/familia.webp'
WHERE participacao_id = '45000000-0000-0000-0000-000000000004';

SELECT extensions.is(
  ((public.get_visita_grupo_delete_impact(
    (SELECT id FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001')
  )->>'realizadas_total')::integer),
  1,
  'diagnóstico informa visita realizada'
);

SELECT extensions.lives_ok(
  $$SELECT public.dissolve_visita_grupo(
    (SELECT id FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001')
  )$$,
  'dissolução transacional funciona'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.visita_grupos WHERE encontro_id = '25000000-0000-0000-0000-000000000001'),
  0,
  'grupo é removido'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.visita_participacao WHERE visitante = true),
  0,
  'visitantes são liberados'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.visita_participacao
    WHERE participacao_id = '45000000-0000-0000-0000-000000000004'
      AND visitante = false
      AND grupo_id IS NULL
      AND status = 'realizada'
      AND foto_familia_url = 'r2://fixture/familia.webp'
  ),
  'histórico do encontrista é preservado sem dupla'
);

SELECT extensions.lives_ok(
  $$
    INSERT INTO public.visita_grupos (id, encontro_id, nome)
    VALUES ('55000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000001', 'Nova dupla');
    SELECT public.assign_visita_participant(
      '55000000-0000-0000-0000-000000000002',
      '45000000-0000-0000-0000-000000000004'
    );
  $$,
  'registro preservado pode ser reatribuído sem duplicação'
);

SELECT * FROM extensions.finish();
RESET ROLE;
ROLLBACK;
