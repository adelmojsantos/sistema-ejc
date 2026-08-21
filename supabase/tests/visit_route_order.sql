BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(4);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('19100000-0000-0000-0000-000000000001', 'route-manager@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('19100000-0000-0000-0000-000000000002', 'route-visitor@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.grupos (id, nome, descricao)
VALUES ('69100000-0000-0000-0000-000000000001', 'Gestão de roteiro teste', 'Fixture de roteiro');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '69100000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_visitacao_coordenar';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES ('19100000-0000-0000-0000-000000000001', '69100000-0000-0000-0000-000000000001', NULL);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES ('29100000-0000-0000-0000-000000000001', 'Teste roteiro ativo', current_date, current_date + 2, true, 99501);

INSERT INTO public.pessoas (id, nome_completo, telefone, cpf)
VALUES
  ('39100000-0000-0000-0000-000000000001', 'Parada Um', '16910000001', '99500000001'),
  ('39100000-0000-0000-0000-000000000002', 'Parada Dois', '16910000002', '99500000002'),
  ('39100000-0000-0000-0000-000000000003', 'Visitante Roteiro', '16910000003', '99500000003');

UPDATE public.profiles
SET pessoa_id = '39100000-0000-0000-0000-000000000003'
WHERE id = '19100000-0000-0000-0000-000000000002';

INSERT INTO public.participacoes (id, pessoa_id, encontro_id, participante, coordenador)
VALUES
  ('49100000-0000-0000-0000-000000000001', '39100000-0000-0000-0000-000000000001', '29100000-0000-0000-0000-000000000001', true, false),
  ('49100000-0000-0000-0000-000000000002', '39100000-0000-0000-0000-000000000002', '29100000-0000-0000-0000-000000000001', true, false),
  ('49100000-0000-0000-0000-000000000003', '39100000-0000-0000-0000-000000000003', '29100000-0000-0000-0000-000000000001', false, false);

INSERT INTO public.visita_grupos (id, encontro_id, nome)
VALUES ('69100000-0000-0000-0000-000000000002', '29100000-0000-0000-0000-000000000001', 'Dupla teste roteiro');

INSERT INTO public.visita_participacao (id, grupo_id, participacao_id, visitante, status)
VALUES
  ('59100000-0000-0000-0000-000000000001', '69100000-0000-0000-0000-000000000002', '49100000-0000-0000-0000-000000000001', false, 'pendente'),
  ('59100000-0000-0000-0000-000000000002', '69100000-0000-0000-0000-000000000002', '49100000-0000-0000-0000-000000000002', false, 'pendente'),
  ('59100000-0000-0000-0000-000000000003', '69100000-0000-0000-0000-000000000002', '49100000-0000-0000-0000-000000000003', true, 'pendente');

SELECT set_config('request.jwt.claim.sub', '19100000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.save_visita_route_order(
    '69100000-0000-0000-0000-000000000002',
    ARRAY['59100000-0000-0000-0000-000000000002', '59100000-0000-0000-0000-000000000001']::uuid[]
  )$$,
  'coordenação salva uma ordem completa do roteiro'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT ordem_roteiro FROM public.visita_participacao WHERE id = '59100000-0000-0000-0000-000000000002'),
  1,
  'ordem solicitada é persistida'
);

SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.save_visita_route_order(
    '69100000-0000-0000-0000-000000000002',
    ARRAY['59100000-0000-0000-0000-000000000001']::uuid[]
  )$$,
  '22023',
  'A ordem deve conter exatamente todos os encontristas ativos da dupla.',
  'roteiro incompleto é rejeitado'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '19100000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.save_visita_route_order(
    '69100000-0000-0000-0000-000000000002',
    ARRAY['59100000-0000-0000-0000-000000000001', '59100000-0000-0000-0000-000000000002']::uuid[]
  )$$,
  'integrante da própria dupla pode ajustar o roteiro compartilhado'
);

RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
