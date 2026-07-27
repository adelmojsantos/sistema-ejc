ALTER TABLE public.almoxarifado_compras
ADD COLUMN IF NOT EXISTS comprovantes_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'almoxarifado_compras'
      AND column_name = 'comprovante_url'
  ) THEN
    UPDATE public.almoxarifado_compras
    SET comprovantes_urls = jsonb_build_array(comprovante_url)
    WHERE comprovante_url IS NOT NULL
      AND comprovantes_urls = '[]'::jsonb;
  END IF;
END;
$$;

COMMENT ON COLUMN public.almoxarifado_compras.comprovantes_urls IS
'Lista de URLs dos comprovantes anexados à compra no armazenamento R2.';
