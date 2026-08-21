BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(16);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES (
  '19200000-0000-0000-0000-000000000001',
  'active-visit-manager@example.test',
  'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')),
  now(), now(), now(), false, false
);

INSERT INTO public.grupos (id, nome, descricao)
VALUES ('69200000-0000-0000-0000-000000000001', 'Gestão ativa de duplas', 'Fixture transacional');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '69200000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_admin';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES ('19200000-0000-0000-0000-000000000001', '69200000-0000-0000-0000-000000000001', NULL);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES ('29200000-0000-0000-0000-000000000001', 'Teste gestão ativa', current_date, current_date + 2, true, 99502);

INSERT INTO public.pessoas (id, nome_completo, cpf)
VALUES
  ('39200000-0000-0000-0000-000000000001', 'Visitante Um', '99510000001'),
  ('39200000-0000-0000-0000-000000000002', 'Visitante Dois', '99510000002'),
  ('39200000-0000-0000-0000-000000000003', 'Visitante Três', '99510000003'),
  ('39200000-0000-0000-0000-000000000004', 'Visitante Quatro', '99510000004'),
  ('39200000-0000-0000-0000-000000000005', 'Visitante Livre', '99510000005'),
  ('39200000-0000-0000-0000-000000000006', 'Encontrista Um', '99510000006'),
  ('39200000-0000-0000-0000-000000000007', 'Encontrista Dois', '99510000007'),
  ('39200000-0000-0000-0000-000000000008', 'Encontrista Três', '99510000008'),
  ('39200000-0000-0000-0000-000000000009', 'Encontrista Quatro', '99510000009');

INSERT INTO public.participacoes (id, pessoa_id, encontro_id, participante, coordenador)
VALUES
  ('49200000-0000-0000-0000-000000000001', '39200000-0000-0000-0000-000000000001', '29200000-0000-0000-0000-000000000001', false, false),
  ('49200000-0000-0000-0000-000000000002', '39200000-0000-0000-0000-000000000002', '29200000-0000-0000-0000-000000000001', false, false),
  ('49200000-0000-0000-0000-000000000003', '39200000-0000-0000-0000-000000000003', '29200000-0000-0000-0000-000000000001', false, false),
  ('49200000-0000-0000-0000-000000000004', '39200000-0000-0000-0000-000000000004', '29200000-0000-0000-0000-000000000001', false, false),
  ('49200000-0000-0000-0000-000000000005', '39200000-0000-0000-0000-000000000005', '29200000-0000-0000-0000-000000000001', false, false),
  ('49200000-0000-0000-0000-000000000006', '39200000-0000-0000-0000-000000000006', '29200000-0000-0000-0000-000000000001', true, false),
  ('49200000-0000-0000-0000-000000000007', '39200000-0000-0000-0000-000000000007', '29200000-0000-0000-0000-000000000001', true, false),
  ('49200000-0000-0000-0000-000000000008', '39200000-0000-0000-0000-000000000008', '29200000-0000-0000-0000-000000000001', true, false),
  ('49200000-0000-0000-0000-000000000009', '39200000-0000-0000-0000-000000000009', '29200000-0000-0000-0000-000000000001', true, false);

INSERT INTO public.visita_grupos (id, encontro_id, nome, nome_automatico)
VALUES
  ('69200000-0000-0000-0000-000000000002', '29200000-0000-0000-0000-000000000001', 'Dupla A', false),
  ('69200000-0000-0000-0000-000000000003', '29200000-0000-0000-0000-000000000001', 'Dupla B', false);

INSERT INTO public.visita_participacao (id, grupo_id, participacao_id, visitante, ordem_visitante, status)
VALUES
  ('59200000-0000-0000-0000-000000000001', '69200000-0000-0000-0000-000000000002', '49200000-0000-0000-0000-000000000001', true, 1, 'pendente'),
  ('59200000-0000-0000-0000-000000000002', '69200000-0000-0000-0000-000000000002', '49200000-0000-0000-0000-000000000002', true, 2, 'pendente'),
  ('59200000-0000-0000-0000-000000000003', '69200000-0000-0000-0000-000000000003', '49200000-0000-0000-0000-000000000003', true, 1, 'pendente'),
  ('59200000-0000-0000-0000-000000000004', '69200000-0000-0000-0000-000000000003', '49200000-0000-0000-0000-000000000004', true, 2, 'pendente'),
  ('59200000-0000-0000-0000-000000000006', '69200000-0000-0000-0000-000000000002', '49200000-0000-0000-0000-000000000006', false, NULL, 'realizada'),
  ('59200000-0000-0000-0000-000000000007', '69200000-0000-0000-0000-000000000002', '49200000-0000-0000-0000-000000000007', false, NULL, 'pendente'),
  ('59200000-0000-0000-0000-000000000008', '69200000-0000-0000-0000-000000000003', '49200000-0000-0000-0000-000000000008', false, NULL, 'ausente');

UPDATE public.visita_participacao
SET foto_familia_url = 'r2://fixture/preservada.webp'
WHERE id = '59200000-0000-0000-0000-000000000006';

SELECT set_config('request.jwt.claim.sub', '19200000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.replace_visita_grupo_visitor(
    '69200000-0000-0000-0000-000000000002',
    '59200000-0000-0000-0000-000000000001',
    '49200000-0000-0000-0000-000000000003'
  )$$,
  '23505',
  'replacement already belongs to a group',
  'visitante ocupado não pode substituir outro'
);

SELECT extensions.lives_ok(
  $$SELECT public.replace_visita_grupo_visitor(
    '69200000-0000-0000-0000-000000000002',
    '59200000-0000-0000-0000-000000000001',
    '49200000-0000-0000-0000-000000000005'
  )$$,
  'visitante livre substitui em uma única transação'
);

SELECT extensions.throws_ok(
  $$SELECT public.move_visita_group_participants(
    '69200000-0000-0000-0000-000000000002',
    '69200000-0000-0000-0000-000000000003',
    'individual',
    ARRAY['59200000-0000-0000-0000-000000000006', '59200000-0000-0000-0000-000000000008']::uuid[]
  )$$,
  '22023',
  'A seleção contém vínculos que não pertencem à dupla de origem.',
  'seleção inválida é rejeitada antes de qualquer movimento'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT grupo_id FROM public.visita_participacao WHERE id = '59200000-0000-0000-0000-000000000006'),
  '69200000-0000-0000-0000-000000000002'::uuid,
  'falha de validação não move vínculos válidos parcialmente'
);

SET LOCAL ROLE authenticated;

SELECT extensions.is(
  ((public.move_visita_group_participants(
    '69200000-0000-0000-0000-000000000002',
    '69200000-0000-0000-0000-000000000003',
    'individual',
    ARRAY['59200000-0000-0000-0000-000000000006']::uuid[]
  )->>'movidos_a_para_b')::integer),
  1,
  'movimento individual informa a quantidade alterada'
);

RESET ROLE;

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.visita_participacao
    WHERE id = '59200000-0000-0000-0000-000000000006'
      AND grupo_id = '69200000-0000-0000-0000-000000000003'
      AND status = 'realizada'
      AND foto_familia_url = 'r2://fixture/preservada.webp'
  ),
  'movimento preserva status e dados operacionais da visita'
);

SET LOCAL ROLE authenticated;

SELECT extensions.is(
  ((public.move_visita_group_participants(
    '69200000-0000-0000-0000-000000000002',
    '69200000-0000-0000-0000-000000000003',
    'mover_todos',
    ARRAY[]::uuid[]
  )->>'movidos_a_para_b')::integer),
  1,
  'mover todos transfere os encontristas restantes da origem'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.visita_participacao WHERE grupo_id = '69200000-0000-0000-0000-000000000002' AND visitante = false),
  0,
  'dupla de origem fica sem encontristas após mover todos'
);

INSERT INTO public.visita_participacao (id, grupo_id, participacao_id, visitante, status)
VALUES ('59200000-0000-0000-0000-000000000009', '69200000-0000-0000-0000-000000000002', '49200000-0000-0000-0000-000000000009', false, 'pendente');

SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (
    SELECT ((result->>'movidos_a_para_b')::integer + (result->>'movidos_b_para_a')::integer)
    FROM public.move_visita_group_participants(
      '69200000-0000-0000-0000-000000000002',
      '69200000-0000-0000-0000-000000000003',
      'swap_completo',
      ARRAY[]::uuid[]
    ) AS moved(result)
  ),
  4,
  'troca completa movimenta os dois lados na mesma chamada'
);

RESET ROLE;

SELECT extensions.ok(
  (SELECT grupo_id = '69200000-0000-0000-0000-000000000003' FROM public.visita_participacao WHERE id = '59200000-0000-0000-0000-000000000009')
  AND (SELECT count(*) = 3 FROM public.visita_participacao WHERE grupo_id = '69200000-0000-0000-0000-000000000002' AND visitante = false),
  'troca completa inverte integralmente o conteúdo das duplas'
);

UPDATE public.encontros
SET ativo = false
WHERE id = '29200000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.replace_visita_grupo_visitor(
    '69200000-0000-0000-0000-000000000002',
    '59200000-0000-0000-0000-000000000002',
    '49200000-0000-0000-0000-000000000001'
  )$$,
  '55000',
  'Encontro encerrado: a composição das duplas está disponível apenas para consulta.',
  'encontro histórico bloqueia substituição de visitante'
);

SELECT extensions.throws_ok(
  $$SELECT public.move_visita_group_participants(
    '69200000-0000-0000-0000-000000000002',
    '69200000-0000-0000-0000-000000000003',
    'mover_todos',
    ARRAY[]::uuid[]
  )$$,
  '55000',
  'Encontro encerrado: a composição das duplas está disponível apenas para consulta.',
  'encontro histórico bloqueia troca entre duplas'
);

RESET ROLE;

SELECT extensions.throws_ok(
  $$UPDATE public.visita_grupos SET nome = 'Alteração indevida' WHERE id = '69200000-0000-0000-0000-000000000002'$$,
  '55000',
  'Encontro encerrado: a composição das duplas está disponível apenas para consulta.',
  'encontro histórico bloqueia alteração direta da dupla'
);

SELECT extensions.throws_ok(
  $$DELETE FROM public.visita_participacao WHERE id = '59200000-0000-0000-0000-000000000009'$$,
  '55000',
  'Encontro encerrado: a composição das duplas está disponível apenas para consulta.',
  'encontro histórico bloqueia desvinculação direta'
);

SELECT extensions.throws_ok(
  $$UPDATE public.visita_participacao SET ordem_roteiro = 99 WHERE id = '59200000-0000-0000-0000-000000000009'$$,
  '55000',
  'Encontro encerrado: a composição das duplas está disponível apenas para consulta.',
  'encontro histórico bloqueia reordenação do roteiro'
);

SELECT extensions.lives_ok(
  $$UPDATE public.pessoas SET nome_completo = 'Visitante Livre Corrigido' WHERE id = '39200000-0000-0000-0000-000000000005'$$,
  'correção do cadastro global não é bloqueada pelo histórico congelado'
);

SELECT * FROM extensions.finish();
ROLLBACK;
