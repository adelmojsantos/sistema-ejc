ALTER TABLE public.biblioteca_pastas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS google_folder_id text,
  ADD COLUMN IF NOT EXISTS url_externa text,
  ADD COLUMN IF NOT EXISTS google_managed boolean NOT NULL DEFAULT false;

ALTER TABLE public.biblioteca_pastas
  DROP CONSTRAINT IF EXISTS biblioteca_pastas_origem_check;
ALTER TABLE public.biblioteca_pastas
  ADD CONSTRAINT biblioteca_pastas_origem_check
  CHECK (origem IN ('supabase', 'google_drive'));

ALTER TABLE public.biblioteca_pastas
  DROP CONSTRAINT IF EXISTS biblioteca_pastas_google_consistency_check;
ALTER TABLE public.biblioteca_pastas
  ADD CONSTRAINT biblioteca_pastas_google_consistency_check CHECK (
    (origem = 'supabase' AND google_managed = false AND google_folder_id IS NULL)
    OR
    (origem = 'google_drive' AND google_managed = true AND google_folder_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS biblioteca_pastas_google_folder_id_unique_idx
  ON public.biblioteca_pastas (google_folder_id)
  WHERE google_folder_id IS NOT NULL;

COMMENT ON COLUMN public.biblioteca_pastas.origem IS
  'Define se a pasta pertence ao Storage do Sistema EJC ou ao Google Drive oficial.';
COMMENT ON COLUMN public.biblioteca_pastas.google_folder_id IS
  'Identificador da pasta real no Google Drive oficial quando gerenciada pelo sistema.';

CREATE OR REPLACE FUNCTION public.validar_destino_biblioteca_google()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  destino_google boolean;
BEGIN
  IF TG_TABLE_NAME = 'biblioteca_pastas' THEN
    IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
    SELECT pasta.google_managed INTO destino_google
    FROM public.biblioteca_pastas pasta WHERE pasta.id = NEW.parent_id;
    IF coalesce(destino_google, false) <> NEW.google_managed THEN
      RAISE EXCEPTION 'Pastas do Google Drive e pastas do Sistema EJC não podem ser misturadas.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.pasta_id IS NULL THEN RETURN NEW; END IF;
    SELECT pasta.google_managed INTO destino_google
    FROM public.biblioteca_pastas pasta WHERE pasta.id = NEW.pasta_id;
    IF coalesce(destino_google, false) AND NEW.origem <> 'google_drive' THEN
      RAISE EXCEPTION 'Uma pasta do Google Drive não aceita arquivos do armazenamento do Sistema EJC.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS biblioteca_pastas_validar_destino_google ON public.biblioteca_pastas;
CREATE TRIGGER biblioteca_pastas_validar_destino_google
BEFORE INSERT OR UPDATE OF parent_id, origem, google_managed ON public.biblioteca_pastas
FOR EACH ROW EXECUTE FUNCTION public.validar_destino_biblioteca_google();

DROP TRIGGER IF EXISTS biblioteca_arquivos_validar_destino_google ON public.biblioteca_arquivos;
CREATE TRIGGER biblioteca_arquivos_validar_destino_google
BEFORE INSERT OR UPDATE OF pasta_id, origem ON public.biblioteca_arquivos
FOR EACH ROW EXECUTE FUNCTION public.validar_destino_biblioteca_google();

-- Reutiliza as colunas já existentes do contrato compartilhado para também
-- transportar os metadados das pastas Google, sem quebrar clientes atuais.
CREATE OR REPLACE FUNCTION public.listar_itens_biblioteca_compartilhados(
  p_grupo_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_equipe_id uuid DEFAULT NULL,
  p_is_admin boolean DEFAULT false
)
RETURNS TABLE (
  res_tipo text, res_id uuid, res_nome text, res_pasta_id uuid,
  res_storage_path text, res_tamanho_bytes bigint, res_tipo_mime text,
  res_origem text, res_google_file_id text, res_google_tipo text,
  res_url_externa text, res_criado_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH RECURSIVE pastas_acessiveis AS (
    SELECT pasta.id FROM public.biblioteca_pastas pasta
    WHERE public.pode_gerenciar_biblioteca(auth.uid())
    UNION
    SELECT compartilhamento.pasta_id
    FROM public.biblioteca_compartilhamento compartilhamento
    WHERE compartilhamento.pasta_id IS NOT NULL
      AND public.destino_biblioteca_pertence_ao_usuario(
        compartilhamento.grupo_id, compartilhamento.equipe_id, auth.uid()
      )
    UNION
    SELECT pasta.id FROM public.biblioteca_pastas pasta
    JOIN pastas_acessiveis parent ON parent.id = pasta.parent_id
  ),
  arquivos_acessiveis AS (
    SELECT arquivo.id FROM public.biblioteca_arquivos arquivo
    WHERE public.pode_gerenciar_biblioteca(auth.uid())
       OR arquivo.pasta_id IN (SELECT id FROM pastas_acessiveis)
       OR EXISTS (
         SELECT 1 FROM public.biblioteca_compartilhamento compartilhamento
         WHERE compartilhamento.arquivo_id = arquivo.id
           AND public.destino_biblioteca_pertence_ao_usuario(
             compartilhamento.grupo_id, compartilhamento.equipe_id, auth.uid()
           )
       )
  )
  SELECT 'pasta'::text, pasta.id, pasta.nome, pasta.parent_id,
    NULL::text, 0::bigint, 'inode/directory'::text,
    pasta.origem, pasta.google_folder_id, 'folder'::text,
    pasta.url_externa, pasta.created_at
  FROM public.biblioteca_pastas pasta
  WHERE pasta.id IN (SELECT id FROM pastas_acessiveis)
  UNION ALL
  SELECT 'arquivo'::text, arquivo.id, arquivo.nome_exibicao, arquivo.pasta_id,
    arquivo.storage_path, arquivo.tamanho_bytes, arquivo.tipo_mime,
    arquivo.origem, arquivo.google_file_id, arquivo.google_tipo,
    arquivo.url_externa, arquivo.created_at
  FROM public.biblioteca_arquivos arquivo
  WHERE arquivo.id IN (SELECT id FROM arquivos_acessiveis);
$$;
