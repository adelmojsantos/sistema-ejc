BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(22);

SELECT extensions.has_table(
  'public',
  'biblioteca_google_importacoes',
  'a tabela privada de importações temporárias existe'
);

SELECT extensions.has_column(
  'public',
  'biblioteca_google_oauth_state',
  'purpose',
  'o estado OAuth diferencia conexão central e importação'
);

SELECT extensions.has_column(
  'public',
  'biblioteca_google_oauth_state',
  'importacao_id',
  'o estado OAuth pode apontar para a sessão temporária'
);

SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.biblioteca_google_importacoes', 'SELECT'),
  'usuários autenticados não leem tokens ou sessões de importação'
);

SELECT extensions.has_column('public', 'biblioteca_pastas', 'origem', 'pastas registram sua origem');
SELECT extensions.has_column('public', 'biblioteca_pastas', 'google_folder_id', 'pastas podem apontar para o Drive oficial');
SELECT extensions.has_column('public', 'biblioteca_pastas', 'url_externa', 'pastas Google possuem link externo');
SELECT extensions.has_column('public', 'biblioteca_pastas', 'google_managed', 'pastas Google são sinalizadas como gerenciadas');
SELECT extensions.has_trigger(
  'public', 'biblioteca_pastas', 'biblioteca_pastas_validar_destino_google',
  'a árvore impede misturar pastas Google e pastas do Sistema EJC'
);
SELECT extensions.has_trigger(
  'public', 'biblioteca_arquivos', 'biblioteca_arquivos_validar_destino_google',
  'pastas Google rejeitam arquivos do Storage'
);

SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.biblioteca_google_importacoes', 'INSERT'),
  'usuários autenticados não criam sessões sem passar pela Edge Function'
);

SELECT extensions.ok(
  has_table_privilege('service_role', 'public.biblioteca_google_importacoes', 'SELECT'),
  'a Edge Function pode consultar as sessões temporárias'
);

SELECT extensions.has_table(
  'public',
  'biblioteca_google_importacao_itens',
  'a tabela privada do inventário recursivo existe'
);

SELECT extensions.has_column(
  'public',
  'biblioteca_google_importacao_itens',
  'scan_page_token',
  'o inventário pode retomar a paginação de uma pasta'
);

SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.biblioteca_google_importacao_itens', 'SELECT'),
  'usuários autenticados não leem diretamente o inventário temporário'
);

SELECT extensions.ok(
  has_table_privilege('service_role', 'public.biblioteca_google_importacao_itens', 'SELECT'),
  'a Edge Function pode processar o inventário temporário'
);

SELECT extensions.has_function(
  'public',
  'biblioteca_google_importacao_resumo',
  ARRAY['uuid'],
  'a função agregadora do inventário existe'
);

SELECT extensions.ok(
  NOT has_function_privilege(
    'authenticated',
    'public.biblioteca_google_importacao_resumo(uuid)',
    'EXECUTE'
  ),
  'usuários autenticados não agregam inventários diretamente'
);

SELECT extensions.has_column(
  'public',
  'biblioteca_google_importacao_itens',
  'copy_status',
  'cada item possui estado de cópia retomável'
);

SELECT extensions.has_column(
  'public',
  'biblioteca_google_importacoes',
  'destination_root_folder_id',
  'a importação registra a pasta criada na raiz da Biblioteca'
);

SELECT extensions.ok(
  NOT has_function_privilege(
    'authenticated',
    'public.biblioteca_google_importacao_copia_resumo(uuid)',
    'EXECUTE'
  ),
  'usuários autenticados não consultam diretamente o progresso da cópia'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'biblioteca_arquivos'
  ),
  'alterações dos arquivos da Biblioteca são publicadas no Realtime'
);

SELECT * FROM extensions.finish();
ROLLBACK;
