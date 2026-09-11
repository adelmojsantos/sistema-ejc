BEGIN;

ALTER TABLE public.biblioteca_google_importacoes
  ADD COLUMN source_type text NOT NULL DEFAULT 'oauth'
    CHECK (source_type IN ('oauth', 'service_account'));

COMMENT ON COLUMN public.biblioteca_google_importacoes.source_type IS
  'Origem da credencial usada na importação. Novas importações usam somente a conta de serviço.';

COMMIT;
