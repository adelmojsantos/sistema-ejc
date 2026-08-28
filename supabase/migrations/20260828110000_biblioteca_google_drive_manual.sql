-- Biblioteca: referências manuais do Google Drive e autorização efetiva no banco.
-- Mantém os uploads existentes e não acessa nem remove conteúdo no Google.

BEGIN;

ALTER TABLE public.biblioteca_arquivos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS google_file_id text,
  ADD COLUMN IF NOT EXISTS google_tipo text,
  ADD COLUMN IF NOT EXISTS url_externa text;

ALTER TABLE public.biblioteca_arquivos
  ALTER COLUMN storage_path DROP NOT NULL;

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
      AND storage_path IS NULL
      AND google_file_id IS NOT NULL
      AND google_tipo IN ('document', 'spreadsheet', 'file')
      AND url_externa ~ '^https://(docs|drive)\.google\.com/'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS biblioteca_arquivos_google_file_id_unique_idx
  ON public.biblioteca_arquivos (google_file_id)
  WHERE origem = 'google_drive';

COMMENT ON COLUMN public.biblioteca_arquivos.origem IS
  'Origem do conteúdo: upload privado no Supabase ou referência manual do Google Drive.';
COMMENT ON COLUMN public.biblioteca_arquivos.url_externa IS
  'URL oficial normalizada. O Sistema EJC não concede nem revoga acesso no Google nesta fase.';

-- Estes objetos existem no frontend e em parte dos ambientes legados, mas não
-- estavam materializados no histórico versionado de migrations.
CREATE TABLE IF NOT EXISTS public.biblioteca_compartilhamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id uuid REFERENCES public.biblioteca_pastas(id) ON DELETE CASCADE,
  arquivo_id uuid REFERENCES public.biblioteca_arquivos(id) ON DELETE CASCADE,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biblioteca_compartilhamento_item_check
    CHECK (num_nonnulls(pasta_id, arquivo_id) = 1),
  CONSTRAINT biblioteca_compartilhamento_destino_check
    CHECK (num_nonnulls(equipe_id, grupo_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS biblioteca_compartilhamento_pasta_grupo_idx
  ON public.biblioteca_compartilhamento (pasta_id, grupo_id)
  WHERE pasta_id IS NOT NULL AND grupo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS biblioteca_compartilhamento_pasta_equipe_idx
  ON public.biblioteca_compartilhamento (pasta_id, equipe_id)
  WHERE pasta_id IS NOT NULL AND equipe_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS biblioteca_compartilhamento_arquivo_grupo_idx
  ON public.biblioteca_compartilhamento (arquivo_id, grupo_id)
  WHERE arquivo_id IS NOT NULL AND grupo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS biblioteca_compartilhamento_arquivo_equipe_idx
  ON public.biblioteca_compartilhamento (arquivo_id, equipe_id)
  WHERE arquivo_id IS NOT NULL AND equipe_id IS NOT NULL;

ALTER TABLE public.biblioteca_compartilhamento ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.biblioteca_compartilhamento FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.biblioteca_compartilhamento TO authenticated;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_biblioteca(
  check_user uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    check_user IS NOT NULL
    AND check_user = auth.uid()
    AND (
      public.is_admin(check_user)
      OR public.has_permission(check_user, 'modulo_biblioteca')
    );
$$;

CREATE OR REPLACE FUNCTION public.destino_biblioteca_pertence_ao_usuario(
  check_grupo_id uuid,
  check_equipe_id uuid,
  check_user uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    check_user IS NOT NULL
    AND check_user = auth.uid()
    AND (
      (
        check_grupo_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.usuario_grupos ug
          WHERE ug.usuario_id = check_user
            AND ug.grupo_id = check_grupo_id
            AND (
              ug.encontro_id IS NULL
              OR EXISTS (
                SELECT 1
                FROM public.encontros e
                WHERE e.id = ug.encontro_id
                  AND e.ativo = true
              )
            )
        )
      )
      OR
      (
        check_equipe_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.profiles profile
          JOIN public.participacoes participacao
            ON participacao.pessoa_id = profile.pessoa_id
          JOIN public.encontros encontro
            ON encontro.id = participacao.encontro_id
           AND encontro.ativo = true
          WHERE profile.id = check_user
            AND participacao.equipe_id = check_equipe_id
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.pode_acessar_arquivo_biblioteca(
  check_arquivo_id uuid,
  check_user uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    check_user IS NOT NULL
    AND check_user = auth.uid()
    AND (
      public.pode_gerenciar_biblioteca(check_user)
      OR EXISTS (
      WITH RECURSIVE pastas_acessiveis AS (
        SELECT compartilhamento.pasta_id AS id
        FROM public.biblioteca_compartilhamento compartilhamento
        WHERE compartilhamento.pasta_id IS NOT NULL
          AND public.destino_biblioteca_pertence_ao_usuario(
            compartilhamento.grupo_id,
            compartilhamento.equipe_id,
            check_user
          )

        UNION

        SELECT pasta.id
        FROM public.biblioteca_pastas pasta
        JOIN pastas_acessiveis parent ON parent.id = pasta.parent_id
      )
      SELECT 1
      FROM public.biblioteca_arquivos arquivo
      WHERE arquivo.id = check_arquivo_id
        AND (
          arquivo.pasta_id IN (SELECT id FROM pastas_acessiveis)
          OR EXISTS (
            SELECT 1
            FROM public.biblioteca_compartilhamento compartilhamento
            WHERE compartilhamento.arquivo_id = arquivo.id
              AND public.destino_biblioteca_pertence_ao_usuario(
                compartilhamento.grupo_id,
                compartilhamento.equipe_id,
                check_user
              )
          )
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.pode_acessar_objeto_biblioteca(
  check_storage_path text,
  check_user uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    check_user IS NOT NULL
    AND check_user = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.biblioteca_arquivos arquivo
      WHERE arquivo.origem = 'supabase'
        AND arquivo.storage_path = check_storage_path
        AND public.pode_acessar_arquivo_biblioteca(arquivo.id, check_user)
    );
$$;

-- Substitui policies amplas do legado: a interface nunca foi uma fronteira de segurança.
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'biblioteca_pastas',
        'biblioteca_arquivos',
        'biblioteca_compartilhamento'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Permitir leitura de pastas para logados" ON public.biblioteca_pastas;
DROP POLICY IF EXISTS "Permitir edicao de pastas para logados" ON public.biblioteca_pastas;
DROP POLICY IF EXISTS "Gerenciadores podem consultar pastas da biblioteca" ON public.biblioteca_pastas;
DROP POLICY IF EXISTS "Gerenciadores podem alterar pastas da biblioteca" ON public.biblioteca_pastas;
CREATE POLICY "Gerenciadores podem consultar pastas da biblioteca"
  ON public.biblioteca_pastas FOR SELECT TO authenticated
  USING (public.pode_gerenciar_biblioteca(auth.uid()));
CREATE POLICY "Gerenciadores podem alterar pastas da biblioteca"
  ON public.biblioteca_pastas FOR ALL TO authenticated
  USING (public.pode_gerenciar_biblioteca(auth.uid()))
  WITH CHECK (public.pode_gerenciar_biblioteca(auth.uid()));

DROP POLICY IF EXISTS "Permitir leitura de arquivos para logados" ON public.biblioteca_arquivos;
DROP POLICY IF EXISTS "Permitir edicao de arquivos para logados" ON public.biblioteca_arquivos;
DROP POLICY IF EXISTS "Gerenciadores podem consultar arquivos da biblioteca" ON public.biblioteca_arquivos;
DROP POLICY IF EXISTS "Gerenciadores podem alterar arquivos da biblioteca" ON public.biblioteca_arquivos;
CREATE POLICY "Gerenciadores podem consultar arquivos da biblioteca"
  ON public.biblioteca_arquivos FOR SELECT TO authenticated
  USING (public.pode_gerenciar_biblioteca(auth.uid()));
CREATE POLICY "Gerenciadores podem alterar arquivos da biblioteca"
  ON public.biblioteca_arquivos FOR ALL TO authenticated
  USING (public.pode_gerenciar_biblioteca(auth.uid()))
  WITH CHECK (public.pode_gerenciar_biblioteca(auth.uid()));

DROP POLICY IF EXISTS "Gerenciadores podem consultar compartilhamentos da biblioteca"
  ON public.biblioteca_compartilhamento;
DROP POLICY IF EXISTS "Gerenciadores podem alterar compartilhamentos da biblioteca"
  ON public.biblioteca_compartilhamento;
CREATE POLICY "Gerenciadores podem consultar compartilhamentos da biblioteca"
  ON public.biblioteca_compartilhamento FOR SELECT TO authenticated
  USING (public.pode_gerenciar_biblioteca(auth.uid()));
CREATE POLICY "Gerenciadores podem alterar compartilhamentos da biblioteca"
  ON public.biblioteca_compartilhamento FOR ALL TO authenticated
  USING (public.pode_gerenciar_biblioteca(auth.uid()))
  WITH CHECK (public.pode_gerenciar_biblioteca(auth.uid()));

-- Mantém a assinatura consumida pelo frontend, porém ignora os três parâmetros
-- de autorização: grupos, equipe e status administrativo são derivados no banco.
DROP FUNCTION IF EXISTS public.listar_itens_biblioteca_compartilhados(uuid[], uuid, boolean);
CREATE OR REPLACE FUNCTION public.listar_itens_biblioteca_compartilhados(
  p_grupo_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_equipe_id uuid DEFAULT NULL,
  p_is_admin boolean DEFAULT false
)
RETURNS TABLE (
  res_tipo text,
  res_id uuid,
  res_nome text,
  res_pasta_id uuid,
  res_storage_path text,
  res_tamanho_bytes bigint,
  res_tipo_mime text,
  res_origem text,
  res_google_file_id text,
  res_google_tipo text,
  res_url_externa text,
  res_criado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH RECURSIVE pastas_acessiveis AS (
    SELECT pasta.id
    FROM public.biblioteca_pastas pasta
    WHERE public.pode_gerenciar_biblioteca(auth.uid())

    UNION

    SELECT compartilhamento.pasta_id
    FROM public.biblioteca_compartilhamento compartilhamento
    WHERE compartilhamento.pasta_id IS NOT NULL
      AND public.destino_biblioteca_pertence_ao_usuario(
        compartilhamento.grupo_id,
        compartilhamento.equipe_id,
        auth.uid()
      )

    UNION

    SELECT pasta.id
    FROM public.biblioteca_pastas pasta
    JOIN pastas_acessiveis parent ON parent.id = pasta.parent_id
  ),
  arquivos_acessiveis AS (
    SELECT arquivo.id
    FROM public.biblioteca_arquivos arquivo
    WHERE public.pode_gerenciar_biblioteca(auth.uid())
       OR arquivo.pasta_id IN (SELECT id FROM pastas_acessiveis)
       OR EXISTS (
         SELECT 1
         FROM public.biblioteca_compartilhamento compartilhamento
         WHERE compartilhamento.arquivo_id = arquivo.id
           AND public.destino_biblioteca_pertence_ao_usuario(
             compartilhamento.grupo_id,
             compartilhamento.equipe_id,
             auth.uid()
           )
       )
  )
  SELECT
    'pasta'::text,
    pasta.id,
    pasta.nome,
    pasta.parent_id,
    NULL::text,
    0::bigint,
    'inode/directory'::text,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    pasta.created_at
  FROM public.biblioteca_pastas pasta
  WHERE pasta.id IN (SELECT id FROM pastas_acessiveis)

  UNION ALL

  SELECT
    'arquivo'::text,
    arquivo.id,
    arquivo.nome_exibicao,
    arquivo.pasta_id,
    arquivo.storage_path,
    arquivo.tamanho_bytes,
    arquivo.tipo_mime,
    arquivo.origem,
    arquivo.google_file_id,
    arquivo.google_tipo,
    arquivo.url_externa,
    arquivo.created_at
  FROM public.biblioteca_arquivos arquivo
  WHERE arquivo.id IN (SELECT id FROM arquivos_acessiveis);
$$;

-- O bucket continua privado. Usuários compartilhados só podem assinar objetos
-- cujo registro lógico esteja acessível para sua identidade real.
DROP POLICY IF EXISTS "Acesso autenticado aos arquivos da biblioteca" ON storage.objects;
DROP POLICY IF EXISTS "Leitura autorizada dos arquivos da biblioteca" ON storage.objects;
DROP POLICY IF EXISTS "Gerenciamento autorizado dos arquivos da biblioteca" ON storage.objects;
CREATE POLICY "Leitura autorizada dos arquivos da biblioteca"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'biblioteca'
    AND public.pode_acessar_objeto_biblioteca(storage.objects.name, auth.uid())
  );
CREATE POLICY "Gerenciamento autorizado dos arquivos da biblioteca"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'biblioteca'
    AND public.pode_gerenciar_biblioteca(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'biblioteca'
    AND public.pode_gerenciar_biblioteca(auth.uid())
  );

REVOKE ALL ON FUNCTION public.pode_gerenciar_biblioteca(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_gerenciar_biblioteca(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pode_gerenciar_biblioteca(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.destino_biblioteca_pertence_ao_usuario(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.destino_biblioteca_pertence_ao_usuario(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.destino_biblioteca_pertence_ao_usuario(uuid, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pode_acessar_arquivo_biblioteca(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_acessar_arquivo_biblioteca(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pode_acessar_arquivo_biblioteca(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pode_acessar_objeto_biblioteca(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_acessar_objeto_biblioteca(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pode_acessar_objeto_biblioteca(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.listar_itens_biblioteca_compartilhados(uuid[], uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_itens_biblioteca_compartilhados(uuid[], uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_itens_biblioteca_compartilhados(uuid[], uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
