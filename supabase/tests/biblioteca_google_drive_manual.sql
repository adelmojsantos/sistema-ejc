BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(8);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  (
    '18000000-0000-0000-0000-000000000001',
    'biblioteca.admin@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '18000000-0000-0000-0000-000000000002',
    'biblioteca.viewer@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  );

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES
  (
    '18000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0002-000000000001',
    NULL
  ),
  (
    '18000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0002-000000000005',
    NULL
  );

INSERT INTO public.biblioteca_arquivos (
  id, nome_exibicao, storage_path, tamanho_bytes, tipo_mime,
  origem, google_file_id, google_tipo, url_externa
)
VALUES
  (
    '58000000-0000-0000-0000-000000000001',
    'Documento compartilhado',
    NULL, 0, 'application/vnd.google-apps.document',
    'google_drive', '1SharedGoogleIdentifier123', 'document',
    'https://docs.google.com/document/d/1SharedGoogleIdentifier123/edit'
  ),
  (
    '58000000-0000-0000-0000-000000000002',
    'Documento privado',
    NULL, 0, 'application/vnd.google-apps.spreadsheet',
    'google_drive', '1PrivateGoogleIdentifier123', 'spreadsheet',
    'https://docs.google.com/spreadsheets/d/1PrivateGoogleIdentifier123/edit'
  );

INSERT INTO public.biblioteca_compartilhamento (
  arquivo_id, grupo_id
)
VALUES (
  '58000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0002-000000000005'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '18000000-0000-0000-0000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  public.pode_gerenciar_biblioteca(auth.uid()),
  'administrator can manage the library'
);
SELECT extensions.is(
  (SELECT count(*) FROM public.biblioteca_arquivos),
  2::bigint,
  'administrator can query every library item through RLS'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '18000000-0000-0000-0000-000000000002',
  true
);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  NOT public.pode_gerenciar_biblioteca(auth.uid()),
  'shared-library viewer cannot manage the library'
);
SELECT extensions.is(
  (SELECT count(*) FROM public.biblioteca_arquivos),
  0::bigint,
  'shared-library viewer cannot bypass the RPC with a direct table query'
);
SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.listar_itens_biblioteca_compartilhados(
      ARRAY['00000000-0000-0000-0002-000000000001']::uuid[],
      NULL,
      true
    )
    WHERE res_tipo = 'arquivo'
  ),
  1::bigint,
  'RPC ignores forged group and administrator parameters'
);
SELECT extensions.is(
  (
    SELECT res_url_externa
    FROM public.listar_itens_biblioteca_compartilhados(
      ARRAY[]::uuid[],
      NULL,
      false
    )
    WHERE res_id = '58000000-0000-0000-0000-000000000001'
  ),
  'https://docs.google.com/document/d/1SharedGoogleIdentifier123/edit'::text,
  'RPC returns the normalized Google URL for an authorized item'
);
SELECT extensions.ok(
  public.pode_acessar_arquivo_biblioteca(
    '58000000-0000-0000-0000-000000000001',
    auth.uid()
  ),
  'viewer can access a document shared with their real group'
);
SELECT extensions.ok(
  NOT public.pode_acessar_arquivo_biblioteca(
    '58000000-0000-0000-0000-000000000002',
    auth.uid()
  ),
  'viewer cannot access an unshared document'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
