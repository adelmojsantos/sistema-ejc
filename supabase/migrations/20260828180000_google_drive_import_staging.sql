-- Permite preservar temporariamente o original de uma conversão até que a
-- criação e a sincronização do arquivo no Google Drive sejam concluídas.

BEGIN;

ALTER TABLE public.biblioteca_arquivos
  DROP CONSTRAINT IF EXISTS biblioteca_arquivos_origem_check;

ALTER TABLE public.biblioteca_arquivos
  ADD CONSTRAINT biblioteca_arquivos_origem_check CHECK (
    (
      origem = 'supabase'
      AND storage_path IS NOT NULL
      AND google_file_id IS NULL
      AND google_tipo IS NULL
      AND url_externa IS NULL
    )
    OR
    (
      origem = 'google_drive'
      AND (
        storage_path IS NULL
        OR (
          google_managed = true
          AND google_sync_status IN ('pending', 'syncing', 'error')
        )
      )
      AND google_file_id IS NOT NULL
      AND google_tipo IN ('document', 'spreadsheet', 'file')
      AND url_externa ~ '^https://(docs|drive)\.google\.com/'
    )
  );

COMMENT ON CONSTRAINT biblioteca_arquivos_origem_check
  ON public.biblioteca_arquivos IS
  'Arquivos Google manuais não mantêm objeto local; importações gerenciadas podem preservar o original apenas enquanto a sincronização está pendente.';

COMMIT;
