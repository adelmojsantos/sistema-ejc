BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(10);

SELECT extensions.has_function(
  'public',
  'aprovar_lista_espera',
  ARRAY['uuid', 'uuid'],
  'aprovar_lista_espera existe com suporte a nova pessoa ou pessoa existente'
);

SELECT extensions.ok(
  NOT has_function_privilege(
  'anon',
  'public.aprovar_lista_espera(uuid, uuid)',
  'EXECUTE'
  ),
  'usuários anônimos não podem aprovar inscrições online'
);

SELECT extensions.ok(
  has_function_privilege(
  'authenticated',
  'public.aprovar_lista_espera(uuid, uuid)',
  'EXECUTE'
  ),
  'a RPC está disponível somente para autorização interna'
);

-- Fixtures: inscrições sem CPF não podem colidir em pessoas_cpf_key.
INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES (
  'c1000000-0000-0000-0000-000000000001', 'waitlist-admin@example.test', 'authenticated', 'authenticated',
  crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false
);

INSERT INTO public.grupos (id, nome, descricao)
VALUES ('c2000000-0000-0000-0000-000000000001', 'Teste aprovação lista de espera', 'Fixture transacional');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT 'c2000000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_secretaria';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES ('c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', NULL);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES ('c3000000-0000-0000-0000-000000000001', 'Teste aprovação lista de espera', current_date, current_date + 2, true, 99901);

INSERT INTO public.pessoas (id, nome_completo, email, cpf)
VALUES
  ('c4000000-0000-0000-0000-000000000001', 'Pessoa Legada CPF Vazio', 'legacy-empty-cpf@example.test', ''),
  ('c4000000-0000-0000-0000-000000000002', 'Pessoa Existente Com CPF', 'existing-cpf@example.test', '99900000001');

INSERT INTO public.lista_espera (id, nome_completo, email, telefone, cpf, encontro_id, origem, status)
VALUES
  ('c5000000-0000-0000-0000-000000000001', 'Inscrita Sem CPF Um', 'no-cpf-1@example.test', '11999990001', '', 'c3000000-0000-0000-0000-000000000001', 'online', 'pendente'),
  ('c5000000-0000-0000-0000-000000000002', 'Inscrita Sem CPF Dois', 'no-cpf-2@example.test', '11999990002', NULL, 'c3000000-0000-0000-0000-000000000001', 'online', 'pendente'),
  ('c5000000-0000-0000-0000-000000000003', 'Inscrita CPF Formatado', 'formatted-cpf@example.test', '11999990003', '999.000.000-02', 'c3000000-0000-0000-0000-000000000001', 'online', 'pendente'),
  ('c5000000-0000-0000-0000-000000000004', 'Pessoa Existente Com CPF', 'existing-cpf@example.test', '11999990004', ' ', 'c3000000-0000-0000-0000-000000000001', 'online', 'pendente');

SELECT set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.aprovar_lista_espera('c5000000-0000-0000-0000-000000000001', NULL)$$,
  'inscrição com CPF vazio é aprovada mesmo havendo pessoa com CPF vazio'
);

SELECT extensions.lives_ok(
  $$SELECT public.aprovar_lista_espera('c5000000-0000-0000-0000-000000000002', NULL)$$,
  'segunda inscrição sem CPF também é aprovada'
);

SELECT extensions.lives_ok(
  $$SELECT public.aprovar_lista_espera('c5000000-0000-0000-0000-000000000003', NULL)$$,
  'inscrição com CPF formatado é aprovada'
);

SELECT extensions.lives_ok(
  $$SELECT public.aprovar_lista_espera('c5000000-0000-0000-0000-000000000004', 'c4000000-0000-0000-0000-000000000002')$$,
  'inscrição sem CPF pode ser vinculada a pessoa existente'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT count(*)::int FROM public.pessoas
   WHERE email IN ('no-cpf-1@example.test', 'no-cpf-2@example.test') AND cpf IS NULL),
  2,
  'pessoas criadas sem CPF ficam com cpf NULL'
);

SELECT extensions.is(
  (SELECT cpf FROM public.pessoas WHERE email = 'formatted-cpf@example.test'),
  '99900000002',
  'CPF da inscrição é gravado somente com dígitos'
);

SELECT extensions.is(
  (SELECT cpf FROM public.pessoas WHERE id = 'c4000000-0000-0000-0000-000000000002'),
  '99900000001',
  'inscrição sem CPF não apaga o CPF da pessoa existente'
);

SELECT * FROM finish();
ROLLBACK;
