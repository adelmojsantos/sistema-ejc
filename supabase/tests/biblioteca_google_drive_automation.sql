BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(15);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  (
    '1a000000-0000-0000-0000-000000000001',
    'grupo.automacao@example.test',
    'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '1a000000-0000-0000-0000-000000000002',
    'equipe.automacao@example.test',
    'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '1a000000-0000-0000-0000-000000000003',
    'historico.automacao@example.test',
    'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '1a000000-0000-0000-0000-000000000004',
    'gestor.biblioteca@example.test',
    'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '1a000000-0000-0000-0000-000000000005',
    'administrador.biblioteca@example.test',
    'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  );

UPDATE public.profiles
SET google_email = 'google.grupo@example.test'
WHERE id = '1a000000-0000-0000-0000-000000000001';

INSERT INTO public.grupos (id, nome, descricao)
VALUES
  (
    '2a000000-0000-0000-0000-000000000001',
    'Grupo automação Biblioteca',
    'Fixture de teste'
  ),
  (
    '2a000000-0000-0000-0000-000000000002',
    'Gestores automação Biblioteca',
    'Fixture de teste'
  ),
  (
    '2a000000-0000-0000-0000-000000000003',
    'Administradores automação Biblioteca',
    'Fixture de teste'
  );

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES
  (
    '1a000000-0000-0000-0000-000000000001',
    '2a000000-0000-0000-0000-000000000001',
    NULL
  ),
  (
    '1a000000-0000-0000-0000-000000000004',
    '2a000000-0000-0000-0000-000000000002',
    NULL
  ),
  (
    '1a000000-0000-0000-0000-000000000005',
    '2a000000-0000-0000-0000-000000000003',
    NULL
  );

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '2a000000-0000-0000-0000-000000000002', permissao.id
FROM public.permissoes permissao
WHERE permissao.chave = 'modulo_biblioteca';

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '2a000000-0000-0000-0000-000000000003', permissao.id
FROM public.permissoes permissao
WHERE permissao.chave = 'modulo_admin';

INSERT INTO public.equipes (id, nome)
VALUES (
  '3a000000-0000-0000-0000-000000000001',
  'Equipe automação Biblioteca'
);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES
  (
    '4a000000-0000-0000-0000-000000000001',
    'Encontro ativo automação', current_date, current_date + 2, true, 999904
  ),
  (
    '4a000000-0000-0000-0000-000000000002',
    'Encontro histórico automação', current_date - 365, current_date - 363, false, 999905
  );

INSERT INTO public.pessoas (id, nome_completo, email)
VALUES
  (
    '5a000000-0000-0000-0000-000000000001',
    'Pessoa equipe automação', 'EQUIPE.AUTOMACAO@example.test'
  ),
  (
    '5a000000-0000-0000-0000-000000000002',
    'Pessoa histórica automação', 'historico.automacao@example.test'
  );

INSERT INTO public.participacoes (
  id, pessoa_id, encontro_id, equipe_id, participante, coordenador
)
VALUES
  (
    '6a000000-0000-0000-0000-000000000001',
    '5a000000-0000-0000-0000-000000000001',
    '4a000000-0000-0000-0000-000000000001',
    '3a000000-0000-0000-0000-000000000001', false, false
  ),
  (
    '6a000000-0000-0000-0000-000000000002',
    '5a000000-0000-0000-0000-000000000002',
    '4a000000-0000-0000-0000-000000000002',
    '3a000000-0000-0000-0000-000000000001', false, false
  );

INSERT INTO public.biblioteca_pastas (id, nome)
VALUES ('7a000000-0000-0000-0000-000000000001', 'Pasta automação');

INSERT INTO public.biblioteca_arquivos (
  id, nome_exibicao, pasta_id, storage_path, tamanho_bytes, tipo_mime,
  origem, google_file_id, google_tipo, url_externa, google_managed
)
VALUES
  (
    '8a000000-0000-0000-0000-000000000001',
    'Documento gerenciado', '7a000000-0000-0000-0000-000000000001',
    NULL, 0, 'application/vnd.google-apps.document',
    'google_drive', '1ManagedAutomationIdentifier', 'document',
    'https://docs.google.com/document/d/1ManagedAutomationIdentifier/edit', true
  ),
  (
    '8a000000-0000-0000-0000-000000000002',
    'Documento manual', '7a000000-0000-0000-0000-000000000001',
    NULL, 0, 'application/vnd.google-apps.document',
    'google_drive', '1ManualAutomationIdentifier', 'document',
    'https://docs.google.com/document/d/1ManualAutomationIdentifier/edit', false
  );

INSERT INTO public.biblioteca_compartilhamento (
  pasta_id, grupo_id, google_role
)
VALUES (
  '7a000000-0000-0000-0000-000000000001',
  '2a000000-0000-0000-0000-000000000001',
  'reader'
);

INSERT INTO public.biblioteca_compartilhamento (
  arquivo_id, grupo_id, google_role
)
VALUES (
  '8a000000-0000-0000-0000-000000000001',
  '2a000000-0000-0000-0000-000000000001',
  'writer'
);

INSERT INTO public.biblioteca_compartilhamento (
  pasta_id, equipe_id, google_role
)
VALUES (
  '7a000000-0000-0000-0000-000000000001',
  '3a000000-0000-0000-0000-000000000001',
  'reader'
);

SELECT extensions.is(
  (
    SELECT google_role
    FROM public.biblioteca_google_usuarios_desejados(
      '8a000000-0000-0000-0000-000000000001'
    )
    WHERE profile_id = '1a000000-0000-0000-0000-000000000001'
  ),
  'writer'::text,
  'a maior permissao entre pasta e arquivo prevalece para o grupo'
);

SELECT extensions.is(
  (
    SELECT google_email
    FROM public.biblioteca_google_usuarios_desejados(
      '8a000000-0000-0000-0000-000000000001'
    )
    WHERE profile_id = '1a000000-0000-0000-0000-000000000001'
  ),
  'google.grupo@example.test'::text,
  'google_email explicito prevalece sobre o email de login'
);

SELECT extensions.is(
  (
    SELECT google_email
    FROM public.biblioteca_google_usuarios_desejados(
      '8a000000-0000-0000-0000-000000000001'
    )
    WHERE profile_id = '1a000000-0000-0000-0000-000000000002'
  ),
  'equipe.automacao@example.test'::text,
  'integrante da equipe ativa usa o email de login como fallback'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.biblioteca_google_usuarios_desejados(
      '8a000000-0000-0000-0000-000000000001'
    )
    WHERE profile_id = '1a000000-0000-0000-0000-000000000003'
  ),
  'integrante apenas de encontro historico nao recebe permissao'
);

SELECT extensions.is(
  (
    SELECT google_role
    FROM public.biblioteca_google_usuarios_desejados(
      '8a000000-0000-0000-0000-000000000001'
    )
    WHERE profile_id = '1a000000-0000-0000-0000-000000000004'
  ),
  'writer'::text,
  'usuario com modulo_biblioteca recebe acesso de editor'
);

SELECT extensions.is(
  (
    SELECT google_role
    FROM public.biblioteca_google_usuarios_desejados(
      '8a000000-0000-0000-0000-000000000001'
    )
    WHERE profile_id = '1a000000-0000-0000-0000-000000000005'
  ),
  'writer'::text,
  'usuario administrador recebe acesso de editor'
);

SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.biblioteca_google_usuarios_desejados(
      '8a000000-0000-0000-0000-000000000001'
    )
  ),
  4::bigint,
  'grupo, equipe e gestores sao expandidos sem duplicar usuarios'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.biblioteca_google_sync_fila
    WHERE arquivo_id = '8a000000-0000-0000-0000-000000000001'
  ),
  'arquivo gerenciado e enfileirado automaticamente'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.biblioteca_google_sync_fila
    WHERE arquivo_id = '8a000000-0000-0000-0000-000000000002'
  ),
  'link manual nao entra na fila da automacao'
);

SELECT extensions.is(
  (
    SELECT google_sync_status FROM public.biblioteca_arquivos
    WHERE id = '8a000000-0000-0000-0000-000000000002'
  ),
  'manual'::text,
  'link manual preserva o estado manual'
);

SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.biblioteca_google_integracao', 'SELECT'),
  'usuarios autenticados nao podem ler o token central'
);

INSERT INTO public.biblioteca_google_permissoes (
  arquivo_id, profile_id, google_email, permission_id, desired_role,
  previous_role, management_type, status, last_error
)
VALUES (
  '8a000000-0000-0000-0000-000000000001',
  '1a000000-0000-0000-0000-000000000004',
  'gestor.biblioteca@example.test',
  NULL, 'writer', NULL, 'observed', 'skipped', NULL
);

SELECT set_config(
  'request.jwt.claim.sub',
  '1a000000-0000-0000-0000-000000000004',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (
    SELECT access_status
    FROM public.obter_meu_acesso_google_biblioteca(
      '8a000000-0000-0000-0000-000000000001'
    )
  ),
  'google_account_required'::text,
  'o proprio usuario recebe o motivo seguro da falta de acesso no Google'
);

SELECT extensions.is(
  (
    SELECT google_email
    FROM public.obter_meu_acesso_google_biblioteca(
      '8a000000-0000-0000-0000-000000000001'
    )
  ),
  'gestor.biblioteca@example.test'::text,
  'a consulta de acesso retorna somente o email Google efetivo do usuario'
);

RESET ROLE;

SELECT extensions.lives_ok(
  $$
    INSERT INTO public.biblioteca_arquivos (
      id, nome_exibicao, pasta_id, storage_path, tamanho_bytes, tipo_mime,
      origem, google_file_id, google_tipo, url_externa, google_managed,
      google_sync_status
    )
    VALUES (
      '8a000000-0000-0000-0000-000000000003',
      'Importação em andamento',
      '7a000000-0000-0000-0000-000000000001',
      'google-imports/usuario/original.docx',
      128,
      'application/vnd.google-apps.document',
      'google_drive',
      '1ImportInProgressIdentifier',
      'document',
      'https://docs.google.com/document/d/1ImportInProgressIdentifier/edit',
      true,
      'pending'
    )
  $$,
  'importacao gerenciada preserva o original enquanto a sincronizacao esta pendente'
);

DELETE FROM public.biblioteca_google_sync_fila
WHERE arquivo_id = '8a000000-0000-0000-0000-000000000001';

DELETE FROM public.participacoes
WHERE id = '6a000000-0000-0000-0000-000000000001';

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.biblioteca_google_sync_fila
    WHERE arquivo_id = '8a000000-0000-0000-0000-000000000001'
  ),
  'alteracao de vinculo com equipe reenfileira arquivos gerenciados'
);

SELECT * FROM extensions.finish();
ROLLBACK;
