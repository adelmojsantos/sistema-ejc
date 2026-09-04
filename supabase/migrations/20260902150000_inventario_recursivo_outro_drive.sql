BEGIN;

ALTER TABLE public.biblioteca_google_importacoes
  DROP CONSTRAINT IF EXISTS biblioteca_google_importacoes_status_check;

ALTER TABLE public.biblioteca_google_importacoes
  ADD CONSTRAINT biblioteca_google_importacoes_status_check
  CHECK (status IN (
    'connecting',
    'connected',
    'folder_selected',
    'inventory_scanning',
    'inventory_ready',
    'inventory_confirmed',
    'revoked',
    'expired',
    'error'
  ));

ALTER TABLE public.biblioteca_google_importacoes
  ADD COLUMN inventory_started_at timestamptz,
  ADD COLUMN inventory_finished_at timestamptz,
  ADD COLUMN inventory_confirmed_at timestamptz;

CREATE TABLE public.biblioteca_google_importacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL
    REFERENCES public.biblioteca_google_importacoes(id) ON DELETE CASCADE,
  google_file_id text NOT NULL,
  parent_google_file_id text,
  nome text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint,
  modified_time timestamptz,
  caminho_relativo text NOT NULL DEFAULT '',
  scan_page_token text,
  scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (importacao_id, google_file_id)
);

COMMENT ON TABLE public.biblioteca_google_importacao_itens IS
  'Inventário temporário e retomável dos itens encontrados na pasta de origem.';

ALTER TABLE public.biblioteca_google_importacao_itens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.biblioteca_google_importacao_itens
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.biblioteca_google_importacao_itens TO service_role;

CREATE INDEX biblioteca_google_importacao_itens_scan_idx
  ON public.biblioteca_google_importacao_itens
  (importacao_id, scanned_at, created_at)
  WHERE mime_type = 'application/vnd.google-apps.folder';

CREATE FUNCTION public.biblioteca_google_importacao_resumo(p_importacao_id uuid)
RETURNS TABLE (
  pastas bigint,
  arquivos bigint,
  itens bigint,
  tamanho_bytes numeric,
  pastas_pendentes bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE mime_type = 'application/vnd.google-apps.folder') - 1,
    count(*) FILTER (WHERE mime_type <> 'application/vnd.google-apps.folder'),
    greatest(count(*) - 1, 0),
    coalesce(sum(tamanho_bytes) FILTER (WHERE mime_type <> 'application/vnd.google-apps.folder'), 0),
    count(*) FILTER (
      WHERE mime_type = 'application/vnd.google-apps.folder'
        AND scanned_at IS NULL
    )
  FROM public.biblioteca_google_importacao_itens
  WHERE importacao_id = p_importacao_id;
$$;

REVOKE ALL ON FUNCTION public.biblioteca_google_importacao_resumo(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.biblioteca_google_importacao_resumo(uuid)
  TO service_role;

COMMIT;
