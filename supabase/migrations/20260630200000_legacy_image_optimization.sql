CREATE TABLE IF NOT EXISTS public.imagem_storage_migracoes (
  source_bucket text NOT NULL,
  source_path text PRIMARY KEY,
  target_bucket text NOT NULL,
  target_path text NOT NULL,
  original_bytes bigint NOT NULL,
  optimized_bytes bigint NOT NULL,
  references_updated integer NOT NULL DEFAULT 0,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  source_deleted_at timestamptz,
  last_error text
);

ALTER TABLE public.imagem_storage_migracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins inspect image storage migrations"
ON public.imagem_storage_migracoes;
CREATE POLICY "Admins inspect image storage migrations"
ON public.imagem_storage_migracoes
FOR SELECT
TO authenticated
USING (public.is_admin());

COMMENT ON TABLE public.imagem_storage_migracoes IS
'Auditoria da conversão de imagens legadas para arquivos WebP otimizados.';

CREATE OR REPLACE FUNCTION public.complete_storage_image_migration(
  p_source_url text,
  p_target_url text,
  p_source_path text,
  p_target_path text,
  p_original_bytes bigint,
  p_optimized_bytes bigint,
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
BEGIN
  IF p_source_url IS NULL OR p_target_url IS NULL OR p_source_url = p_target_url THEN
    RAISE EXCEPTION 'Referências de origem e destino inválidas.';
  END IF;

  UPDATE public.participacoes
  SET foto_url = p_target_url
  WHERE foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.equipe_confirmacoes
  SET foto_url = p_target_url
  WHERE foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.equipe_confirmacoes
  SET criancas_recreacao_foto_url = p_target_url
  WHERE criancas_recreacao_foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.palestras
  SET palestrante_foto_url = p_target_url
  WHERE palestrante_foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.circulos
  SET imagem_url = p_target_url
  WHERE imagem_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.circulo_mediadores_fotos
  SET foto_url = p_target_url
  WHERE foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.visita_grupos
  SET foto_url = p_target_url
  WHERE foto_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.visita_participacao
  SET foto_familia_url = p_target_url
  WHERE foto_familia_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.encontros
  SET logo_url = p_target_url
  WHERE logo_url = p_source_url;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  IF v_total <> p_expected_references THEN
    RAISE EXCEPTION
      'Concorrência detectada: esperadas % referências, atualizadas %.',
      p_expected_references,
      v_total;
  END IF;

  INSERT INTO public.imagem_storage_migracoes (
    source_bucket,
    source_path,
    target_bucket,
    target_path,
    original_bytes,
    optimized_bytes,
    references_updated,
    migrated_at,
    source_deleted_at,
    last_error
  )
  VALUES (
    'galeria',
    p_source_path,
    'galeria',
    p_target_path,
    p_original_bytes,
    p_optimized_bytes,
    v_total,
    now(),
    NULL,
    NULL
  )
  ON CONFLICT (source_path) DO UPDATE
  SET target_path = EXCLUDED.target_path,
      original_bytes = EXCLUDED.original_bytes,
      optimized_bytes = EXCLUDED.optimized_bytes,
      references_updated = EXCLUDED.references_updated,
      migrated_at = EXCLUDED.migrated_at,
      source_deleted_at = NULL,
      last_error = NULL;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_storage_image_migration(
  text, text, text, text, bigint, bigint, integer
)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_storage_image_migration(
  text, text, text, text, bigint, bigint, integer
)
TO service_role;

COMMENT ON FUNCTION public.complete_storage_image_migration(
  text, text, text, text, bigint, bigint, integer
) IS
'Atualiza referências e registra a auditoria da imagem na mesma transação.';
