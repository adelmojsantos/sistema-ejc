BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(3);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES (
  '19000000-0000-0000-0000-000000000001',
  'biblioteca.equipe@example.test',
  'authenticated', 'authenticated',
  crypt('fixture-password', gen_salt('bf')),
  now(), now(), now(), false, false
);

INSERT INTO public.encontros (
  id, nome, data_inicio, data_fim, ativo, edicao
)
VALUES (
  '39000000-0000-0000-0000-000000000001',
  'Biblioteca equipe fixture',
  current_date,
  current_date + 2,
  true,
  999903
);

INSERT INTO public.equipes (id, nome)
VALUES (
  '49000000-0000-0000-0000-000000000001',
  'Equipe Biblioteca Fixture'
);

INSERT INTO public.pessoas (id, nome_completo, email)
VALUES (
  '29000000-0000-0000-0000-000000000001',
  'Pessoa da equipe da biblioteca',
  'BIBLIOTECA.EQUIPE@example.test'
);

INSERT INTO public.participacoes (
  id, pessoa_id, encontro_id, equipe_id, participante, coordenador
)
VALUES (
  '59000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000001',
  '39000000-0000-0000-0000-000000000001',
  '49000000-0000-0000-0000-000000000001',
  false,
  false
);

SELECT set_config(
  'request.jwt.claim.sub',
  '19000000-0000-0000-0000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  public.resolve_profile_person_id(auth.uid()),
  '29000000-0000-0000-0000-000000000001'::uuid,
  'o fluxo padrão resolve a pessoa pelo e-mail enquanto o vínculo explícito não existe'
);

SELECT extensions.ok(
  public.destino_biblioteca_pertence_ao_usuario(
    NULL,
    '49000000-0000-0000-0000-000000000001',
    auth.uid()
  ),
  'o integrante com usuário no sistema recebe o compartilhamento da equipe'
);

SELECT extensions.ok(
  NOT public.destino_biblioteca_pertence_ao_usuario(
    NULL,
    '49000000-0000-0000-0000-000000000002',
    auth.uid()
  ),
  'o compartilhamento não concede acesso a outra equipe'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
