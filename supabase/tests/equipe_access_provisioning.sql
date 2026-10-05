BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(7);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('1d000000-0000-0000-0000-000000000001', 'access-rules-admin@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('1d000000-0000-0000-0000-000000000002', 'access-rules-user@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.grupos (id, nome, descricao)
VALUES
  ('2d000000-0000-0000-0000-000000000001', 'Admin matriz de acesso', 'Fixture administrativa'),
  ('2d000000-0000-0000-0000-000000000002', 'Perfil matriz coordenador', 'Fixture'),
  ('2d000000-0000-0000-0000-000000000003', 'Perfil matriz integrante', 'Fixture');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '2d000000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_admin';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES ('1d000000-0000-0000-0000-000000000001', '2d000000-0000-0000-0000-000000000001', NULL);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES ('3d000000-0000-0000-0000-000000000001', 'Encontro matriz', current_date, current_date + 2, true, 99102);

INSERT INTO public.equipes (id, nome)
VALUES ('4d000000-0000-0000-0000-000000000001', 'Equipe matriz');

INSERT INTO public.pessoas (id, nome_completo, email)
VALUES ('5d000000-0000-0000-0000-000000000001', 'Pessoa matriz', 'person-access-rules@example.test');

INSERT INTO public.participacoes (id, pessoa_id, encontro_id, equipe_id, participante, coordenador)
VALUES (
  '6d000000-0000-0000-0000-000000000001',
  '5d000000-0000-0000-0000-000000000001',
  '3d000000-0000-0000-0000-000000000001',
  '4d000000-0000-0000-0000-000000000001',
  false,
  false
);

SELECT set_config('request.jwt.claim.sub', '1d000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.substituir_regras_acesso_equipes('3d000000-0000-0000-0000-000000000001', '[]'::jsonb)$$,
  '42501',
  'Somente administradores podem configurar regras de acesso.',
  'usuário comum não altera a matriz'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.equipe_acesso_regras),
  0,
  'usuário comum não consulta regras administrativas'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '1d000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  public.substituir_regras_acesso_equipes(
    '3d000000-0000-0000-0000-000000000001',
    '[
      {"equipe_id":"4d000000-0000-0000-0000-000000000001","papel":"coordenador","grupo_id":"2d000000-0000-0000-0000-000000000002"},
      {"equipe_id":"4d000000-0000-0000-0000-000000000001","papel":"integrante","grupo_id":"2d000000-0000-0000-0000-000000000003"}
    ]'::jsonb
  ),
  2,
  'administrador salva regras para coordenadores e integrantes'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.equipe_acesso_regras WHERE encontro_id = '3d000000-0000-0000-0000-000000000001'),
  2,
  'matriz salva somente as regras informadas'
);

SELECT extensions.throws_ok(
  $$SELECT public.substituir_regras_acesso_equipes(
    '3d000000-0000-0000-0000-000000000001',
    '[{"equipe_id":"4d000000-0000-0000-0000-000000000001","papel":"coordenador","grupo_id":"2d000000-0000-0000-0000-000000000001"}]'::jsonb
  )$$,
  '22023',
  'Perfis administrativos não podem ser concedidos pela matriz de equipes.',
  'matriz não concede administração com base em participação'
);

SELECT extensions.is(
  public.substituir_regras_acesso_equipes(
    '3d000000-0000-0000-0000-000000000001',
    '[{"equipe_id":"4d000000-0000-0000-0000-000000000001","papel":"coordenador","grupo_id":"2d000000-0000-0000-0000-000000000002"}]'::jsonb
  ),
  1,
  'nova gravação substitui a matriz anterior'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.equipe_acesso_regras WHERE encontro_id = '3d000000-0000-0000-0000-000000000001'),
  1,
  'regra removida não permanece na matriz'
);

SELECT * FROM extensions.finish();
ROLLBACK;
