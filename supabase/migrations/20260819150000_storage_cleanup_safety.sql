CREATE TABLE IF NOT EXISTS public.storage_object_quarantine (
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  object_bytes bigint NOT NULL CHECK (object_bytes >= 0),
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  quarantine_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'retained', 'deleted')),
  source_deleted_at timestamptz,
  last_error text,
  PRIMARY KEY (bucket_id, object_path),
  CHECK (quarantine_until >= first_detected_at),
  CHECK (
    (status = 'deleted' AND source_deleted_at IS NOT NULL)
    OR (status <> 'deleted' AND source_deleted_at IS NULL)
  )
);

ALTER TABLE public.storage_object_quarantine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins inspect storage object quarantine"
ON public.storage_object_quarantine;
CREATE POLICY "Admins inspect storage object quarantine"
ON public.storage_object_quarantine
FOR SELECT
TO authenticated
USING (public.is_admin());

COMMENT ON TABLE public.storage_object_quarantine IS
'Objetos sem referência aparente aguardam nova verificação antes de qualquer exclusão.';

CREATE OR REPLACE FUNCTION public.complete_public_image_r2_migration(
  p_source_url text,
  p_target_url text,
  p_source_path text,
  p_original_bytes bigint,
  p_expected_references integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_count integer := 0;
  v_source_json text;
  v_target_json text;
BEGIN
  IF p_source_url IS NULL OR p_target_url IS NULL OR p_source_url = p_target_url THEN
    RAISE EXCEPTION 'Referências de origem e destino inválidas.';
  END IF;

  IF p_source_path IS NULL OR p_source_path !~ '^fotos/' OR p_source_path ~ '(^|/)\.\.(/|$)' THEN
    RAISE EXCEPTION 'Caminho de origem inválido.';
  END IF;

  IF p_original_bytes IS NULL OR p_original_bytes < 0
     OR p_expected_references IS NULL OR p_expected_references < 1 THEN
    RAISE EXCEPTION 'Metadados da migração inválidos.';
  END IF;

  UPDATE public.participacoes SET foto_url = p_target_url WHERE foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.equipes SET foto_url = p_target_url WHERE foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.equipe_confirmacoes SET foto_url = p_target_url WHERE foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.equipe_confirmacoes
  SET criancas_recreacao_foto_url = p_target_url
  WHERE criancas_recreacao_foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.palestras SET palestrante_foto_url = p_target_url WHERE palestrante_foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.circulos SET imagem_url = p_target_url WHERE imagem_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.circulo_mediadores_fotos SET foto_url = p_target_url WHERE foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.visita_grupos SET foto_url = p_target_url WHERE foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.visita_participacao
  SET foto_familia_url = p_target_url
  WHERE foto_familia_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.encontros SET logo_url = p_target_url WHERE logo_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  UPDATE public.galeria SET url = p_target_url WHERE url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  -- A troca usa o valor JSON completo (incluindo aspas), evitando substituir
  -- trechos parecidos em observações. A contagem considera todas as ocorrências,
  -- inclusive arrays de snapshots mais novos.
  v_source_json := to_jsonb(p_source_url)::text;
  v_target_json := to_jsonb(p_target_url)::text;

  SELECT COALESCE(sum(
    (length(dados_snapshot::text) - length(replace(dados_snapshot::text, v_source_json, '')))
    / length(v_source_json)
  ), 0)::integer
  INTO v_count
  FROM public.participacoes_canceladas
  WHERE strpos(dados_snapshot::text, v_source_json) > 0;

  UPDATE public.participacoes_canceladas
  SET dados_snapshot = replace(dados_snapshot::text, v_source_json, v_target_json)::jsonb
  WHERE strpos(dados_snapshot::text, v_source_json) > 0;
  v_total := v_total + v_count;

  IF v_total <> p_expected_references THEN
    RAISE EXCEPTION
      'Concorrência detectada: esperadas % referências, atualizadas %.',
      p_expected_references,
      v_total;
  END IF;

  INSERT INTO public.public_image_r2_migracoes (
    source_bucket, source_path, target_provider, target_url, original_bytes,
    references_updated, migrated_at, source_deleted_at, last_error
  ) VALUES (
    'galeria', p_source_path, 'cloudflare-r2', p_target_url, p_original_bytes,
    v_total, now(), NULL, NULL
  )
  ON CONFLICT (source_path) DO UPDATE
  SET target_url = EXCLUDED.target_url,
      original_bytes = EXCLUDED.original_bytes,
      references_updated = EXCLUDED.references_updated,
      migrated_at = EXCLUDED.migrated_at,
      source_deleted_at = NULL,
      last_error = NULL;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_public_image_r2_migration(
  text, text, text, bigint, integer
)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_public_image_r2_migration(
  text, text, text, bigint, integer
)
TO service_role;

COMMENT ON FUNCTION public.complete_public_image_r2_migration(
  text, text, text, bigint, integer
) IS
'Atualiza referências ativas e históricas de imagens públicas migradas para R2 e registra auditoria na mesma transação.';
