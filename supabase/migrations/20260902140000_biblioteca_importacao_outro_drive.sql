BEGIN;

CREATE TABLE public.biblioteca_google_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_account_email text,
  refresh_token_ciphertext text,
  selected_folder_id text,
  selected_folder_name text,
  status text NOT NULL DEFAULT 'connecting'
    CHECK (status IN ('connecting', 'connected', 'folder_selected', 'revoked', 'expired', 'error')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.biblioteca_google_importacoes IS
  'Conexões temporárias e administrativas usadas para importar acervos de outra conta Google Drive.';
COMMENT ON COLUMN public.biblioteca_google_importacoes.refresh_token_ciphertext IS
  'Refresh token temporário criptografado; acessível somente pela service_role.';

ALTER TABLE public.biblioteca_google_oauth_state
  ADD COLUMN purpose text NOT NULL DEFAULT 'central'
    CHECK (purpose IN ('central', 'import')),
  ADD COLUMN importacao_id uuid REFERENCES public.biblioteca_google_importacoes(id) ON DELETE CASCADE;

ALTER TABLE public.biblioteca_google_importacoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.biblioteca_google_importacoes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.biblioteca_google_importacoes TO service_role;

CREATE INDEX biblioteca_google_importacoes_requested_by_idx
  ON public.biblioteca_google_importacoes (requested_by, created_at DESC);

COMMIT;
