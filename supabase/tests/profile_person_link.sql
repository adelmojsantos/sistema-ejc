BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(7);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('16000000-0000-0000-0000-000000000001', 'identity.admin@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('16000000-0000-0000-0000-000000000002', 'identity.explicit.old@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('16000000-0000-0000-0000-000000000003', 'identity.fallback@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('16000000-0000-0000-0000-000000000004', 'identity.ambiguous@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.pessoas (id, nome_completo, email)
VALUES
  ('26000000-0000-0000-0000-000000000001', 'Pessoa administradora', 'identity.admin@example.test'),
  ('26000000-0000-0000-0000-000000000002', 'Pessoa com vínculo explícito', 'identity.explicit.new@example.test'),
  ('26000000-0000-0000-0000-000000000003', 'Pessoa com fallback único', 'IDENTITY.FALLBACK@example.test'),
  ('26000000-0000-0000-0000-000000000004', 'Primeira pessoa ambígua', 'identity.ambiguous@example.test'),
  ('26000000-0000-0000-0000-000000000005', 'Segunda pessoa ambígua', 'IDENTITY.AMBIGUOUS@example.test'),
  ('26000000-0000-0000-0000-000000000006', 'Pessoa disponível para vínculo manual', 'identity.manual@example.test');

UPDATE public.profiles
SET role = 'admin', pessoa_id = '26000000-0000-0000-0000-000000000001'
WHERE id = '16000000-0000-0000-0000-000000000001';

UPDATE public.profiles
SET pessoa_id = '26000000-0000-0000-0000-000000000002'
WHERE id = '16000000-0000-0000-0000-000000000002';

SELECT extensions.is(
  public.resolve_profile_person_id('16000000-0000-0000-0000-000000000002'),
  '26000000-0000-0000-0000-000000000002'::uuid,
  'o vínculo explícito prevalece mesmo quando os e-mails são diferentes'
);

SELECT extensions.is(
  public.resolve_profile_person_id('16000000-0000-0000-0000-000000000003'),
  '26000000-0000-0000-0000-000000000003'::uuid,
  'a compatibilidade encontra um único e-mail normalizado'
);

SELECT extensions.is(
  public.resolve_profile_person_id('16000000-0000-0000-0000-000000000004'),
  NULL::uuid,
  'a compatibilidade não escolhe entre pessoas com e-mail ambíguo'
);

SELECT extensions.throws_ok(
  $$UPDATE public.profiles
      SET pessoa_id = '26000000-0000-0000-0000-000000000002'
    WHERE id = '16000000-0000-0000-0000-000000000003'$$,
  '23505',
  NULL,
  'uma pessoa não pode ser vinculada a dois usuários'
);

SELECT set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT extensions.lives_ok(
  $$SELECT public.vincular_profile_pessoa(
      '16000000-0000-0000-0000-000000000004',
      '26000000-0000-0000-0000-000000000006'
  )$$,
  'administrador pode revisar e criar o vínculo manual'
);

SELECT extensions.is(
  (SELECT pessoa_id FROM public.profiles WHERE id = '16000000-0000-0000-0000-000000000004'),
  '26000000-0000-0000-0000-000000000006'::uuid,
  'o vínculo manual é persistido no perfil'
);

SELECT extensions.is(
  (
    SELECT count(*)::integer
    FROM public.profile_pessoa_vinculo_auditoria
    WHERE profile_id = '16000000-0000-0000-0000-000000000004'
      AND pessoa_id_novo = '26000000-0000-0000-0000-000000000006'
      AND alterado_por = '16000000-0000-0000-0000-000000000001'
  ),
  1,
  'o vínculo manual registra auditoria com o administrador responsável'
);

SELECT * FROM extensions.finish();
ROLLBACK;
