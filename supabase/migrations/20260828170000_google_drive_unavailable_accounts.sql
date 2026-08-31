-- Trata destinatários sem Conta Google como indisponíveis, sem transformar a
-- sincronização inteira do arquivo em erro.

BEGIN;

ALTER TABLE public.biblioteca_google_permissoes
  DROP CONSTRAINT IF EXISTS biblioteca_google_permissoes_status_check;
ALTER TABLE public.biblioteca_google_permissoes
  ADD CONSTRAINT biblioteca_google_permissoes_status_check
  CHECK (status IN ('active', 'error', 'revoked', 'skipped'));

CREATE OR REPLACE FUNCTION public.obter_meu_acesso_google_biblioteca(
  p_arquivo_id uuid
)
RETURNS TABLE (
  access_status text,
  google_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH usuario AS (
    SELECT
      profile.id,
      lower(btrim(COALESCE(NULLIF(profile.google_email, ''), profile.email))) AS google_email
    FROM public.profiles profile
    WHERE profile.id = auth.uid()
  )
  SELECT
    CASE
      WHEN arquivo.origem <> 'google_drive' OR arquivo.google_managed = false
        THEN 'not_managed'
      WHEN permissao.status = 'active'
        THEN 'granted'
      WHEN permissao.status = 'skipped'
        THEN 'google_account_required'
      WHEN arquivo.google_sync_status = 'error'
        THEN 'sync_error'
      ELSE 'pending'
    END AS access_status,
    usuario.google_email
  FROM public.biblioteca_arquivos arquivo
  CROSS JOIN usuario
  LEFT JOIN public.biblioteca_google_permissoes permissao
    ON permissao.arquivo_id = arquivo.id
   AND permissao.google_email = usuario.google_email
  WHERE arquivo.id = p_arquivo_id
    AND public.pode_acessar_arquivo_biblioteca(arquivo.id, auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.obter_meu_acesso_google_biblioteca(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_meu_acesso_google_biblioteca(uuid)
  TO authenticated;

SELECT public.enfileirar_biblioteca_google_todos();

NOTIFY pgrst, 'reload schema';

COMMIT;
