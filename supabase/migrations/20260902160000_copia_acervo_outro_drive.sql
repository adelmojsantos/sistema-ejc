BEGIN;

ALTER TABLE public.biblioteca_google_importacoes
  DROP CONSTRAINT IF EXISTS biblioteca_google_importacoes_status_check;

ALTER TABLE public.biblioteca_google_importacoes
  ADD CONSTRAINT biblioteca_google_importacoes_status_check
  CHECK (status IN (
    'connecting', 'connected', 'folder_selected', 'inventory_scanning',
    'inventory_ready', 'inventory_confirmed', 'copying', 'completed',
    'completed_with_errors', 'revoked', 'expired', 'error'
  ));

ALTER TABLE public.biblioteca_google_importacoes
  ADD COLUMN destination_root_folder_id uuid
    REFERENCES public.biblioteca_pastas(id) ON DELETE SET NULL,
  ADD COLUMN copy_started_at timestamptz,
  ADD COLUMN copy_finished_at timestamptz;

ALTER TABLE public.biblioteca_google_importacao_itens
  ADD COLUMN copy_status text NOT NULL DEFAULT 'pending'
    CHECK (copy_status IN ('pending', 'processing', 'copied', 'error', 'skipped')),
  ADD COLUMN copy_attempts integer NOT NULL DEFAULT 0 CHECK (copy_attempts >= 0),
  ADD COLUMN copy_last_error text,
  ADD COLUMN biblioteca_pasta_id uuid
    REFERENCES public.biblioteca_pastas(id) ON DELETE SET NULL,
  ADD COLUMN biblioteca_arquivo_id uuid
    REFERENCES public.biblioteca_arquivos(id) ON DELETE SET NULL,
  ADD COLUMN copy_locked_at timestamptz,
  ADD COLUMN copied_at timestamptz;

CREATE INDEX biblioteca_google_importacao_itens_copy_idx
  ON public.biblioteca_google_importacao_itens
  (importacao_id, copy_status, created_at);

CREATE FUNCTION public.biblioteca_google_importacao_copia_resumo(p_importacao_id uuid)
RETURNS TABLE (
  pendentes bigint,
  processando bigint,
  copiados bigint,
  erros bigint,
  ignorados bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE copy_status = 'pending'),
    count(*) FILTER (WHERE copy_status = 'processing'),
    count(*) FILTER (WHERE copy_status = 'copied'),
    count(*) FILTER (WHERE copy_status = 'error'),
    count(*) FILTER (WHERE copy_status = 'skipped')
  FROM public.biblioteca_google_importacao_itens
  WHERE importacao_id = p_importacao_id
    AND parent_google_file_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.biblioteca_google_importacao_copia_resumo(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.biblioteca_google_importacao_copia_resumo(uuid)
  TO service_role;

COMMIT;
