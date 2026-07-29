BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(14);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  (
    '11000000-0000-0000-0000-000000000001',
    'p3.outgoing@example.test',
    'authenticated',
    'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    'p3.permanent@example.test',
    'authenticated',
    'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    'p3.incoming@example.test',
    'authenticated',
    'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '11000000-0000-0000-0000-000000000004',
    'p3.consensus@example.test',
    'authenticated',
    'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  );

INSERT INTO public.pessoas (id, nome_completo, email)
VALUES
  (
    '21000000-0000-0000-0000-000000000001',
    'Dirigente atual',
    'p3.outgoing@example.test'
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    'Administrador permanente',
    'p3.permanent@example.test'
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    'Novo dirigente',
    'p3.incoming@example.test'
  ),
  (
    '21000000-0000-0000-0000-000000000004',
    'Indicação por consenso',
    'p3.consensus@example.test'
  );

INSERT INTO public.dirigencias (id, nome, status, ativada_em)
VALUES (
  '31000000-0000-0000-0000-000000000001',
  'Dirigência atual fixture',
  'ativa',
  now()
);

INSERT INTO public.dirigencia_membros (
  id, dirigencia_id, pessoa_id, ativo
)
VALUES (
  '41000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001',
  true
);

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES
  (
    '11000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0002-000000000001',
    NULL
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0002-000000000001',
    NULL
  );

SELECT set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-000000000001',
  true
);

UPDATE public.profiles
SET role = 'admin'
WHERE id = '11000000-0000-0000-0000-000000000003';

SELECT extensions.ok(
  NOT public.is_admin('11000000-0000-0000-0000-000000000003'),
  'legacy role alone does not grant administration'
);

INSERT INTO public.dirigencias (
  id, nome, status, created_by
)
VALUES (
  '31000000-0000-0000-0000-000000000002',
  'Nova dirigência fixture',
  'indicacao',
  '11000000-0000-0000-0000-000000000001'
);

SELECT extensions.lives_ok(
  $$
    SELECT public.adicionar_indicacao_dirigencia(
      '31000000-0000-0000-0000-000000000002',
      NULL,
      '21000000-0000-0000-0000-000000000004',
      'adicional',
      'Consenso fixture'
    )
  $$,
  'consensus nomination accepts a null proposer'
);

SELECT extensions.throws_ok(
  $$
    INSERT INTO public.dirigencia_indicacoes (
      dirigencia_origem_id,
      dirigencia_destino_id,
      indicador_membro_id,
      indicado_pessoa_id,
      tipo,
      created_by
    )
    VALUES (
      '31000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000002',
      NULL,
      '21000000-0000-0000-0000-000000000003',
      'regular',
      '11000000-0000-0000-0000-000000000001'
    )
  $$,
  '23514',
  NULL,
  'regular nomination rejects a null proposer'
);

UPDATE public.dirigencia_indicacoes
SET status = 'descartada'
WHERE dirigencia_destino_id = '31000000-0000-0000-0000-000000000002';

INSERT INTO public.dirigencia_indicacoes (
  dirigencia_origem_id,
  dirigencia_destino_id,
  indicador_membro_id,
  indicado_pessoa_id,
  tipo,
  status,
  created_by
)
VALUES (
  '31000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000002',
  '41000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000003',
  'regular',
  'selecionada',
  '11000000-0000-0000-0000-000000000001'
);

UPDATE public.dirigencias
SET indicacoes_finalizadas_em = now()
WHERE id = '31000000-0000-0000-0000-000000000002';

SET LOCAL ROLE authenticated;
SELECT extensions.lives_ok(
  $$
    SELECT public.ativar_nova_dirigencia(
      '31000000-0000-0000-0000-000000000002'
    )
  $$,
  'an authorized outgoing leader can activate the new leadership'
);
RESET ROLE;

SELECT extensions.is(
  (
    SELECT status
    FROM public.dirigencias
    WHERE id = '31000000-0000-0000-0000-000000000001'
  ),
  'encerrada',
  'previous leadership is closed'
);
SELECT extensions.is(
  (
    SELECT status
    FROM public.dirigencias
    WHERE id = '31000000-0000-0000-0000-000000000002'
  ),
  'ativa',
  'new leadership is active'
);
SELECT extensions.is(
  (SELECT count(*) FROM public.dirigencias WHERE status = 'ativa'),
  1::bigint,
  'exactly one leadership remains active'
);
SELECT extensions.ok(
  NOT public.is_admin('11000000-0000-0000-0000-000000000001'),
  'outgoing leader loses backend administration'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.usuario_grupos
    WHERE usuario_id = '11000000-0000-0000-0000-000000000001'
      AND grupo_id = '00000000-0000-0000-0002-000000000001'
      AND encontro_id IS NULL
  ),
  'outgoing leader loses the global administrator group'
);
SELECT extensions.is(
  (
    SELECT role::text
    FROM public.profiles
    WHERE id = '11000000-0000-0000-0000-000000000001'
  ),
  'viewer',
  'outgoing leader loses the legacy admin role'
);
SELECT extensions.ok(
  public.is_admin('11000000-0000-0000-0000-000000000002'),
  'independent permanent administrator keeps access'
);
SELECT extensions.ok(
  public.is_admin('11000000-0000-0000-0000-000000000003'),
  'incoming leader receives backend administration'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.usuario_grupos
    WHERE usuario_id = '11000000-0000-0000-0000-000000000003'
      AND grupo_id = '00000000-0000-0000-0002-000000000001'
      AND encontro_id IS NULL
  ),
  'incoming leader receives the global administrator group'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.dirigencia_eventos
    WHERE dirigencia_id = '31000000-0000-0000-0000-000000000002'
      AND tipo = 'dirigencia_ativada'
  ),
  'leadership activation is recorded in the audit trail'
);

SELECT * FROM extensions.finish();
ROLLBACK;
