CREATE TABLE IF NOT EXISTS public.biblioteca_google_itens_ignorados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id uuid NOT NULL REFERENCES public.biblioteca_pastas(id) ON DELETE CASCADE,
  google_file_id text NOT NULL,
  nome text NOT NULL,
  mime_type text NOT NULL,
  ignorado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pasta_id, google_file_id)
);

ALTER TABLE public.biblioteca_google_itens_ignorados ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.biblioteca_google_itens_ignorados
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.biblioteca_google_itens_ignorados TO service_role;

COMMENT ON TABLE public.biblioteca_google_itens_ignorados IS
  'Itens encontrados em pastas do Drive oficial que um administrador decidiu manter fora da Biblioteca.';
