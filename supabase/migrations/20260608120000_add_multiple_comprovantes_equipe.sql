ALTER TABLE public.equipe_confirmacoes
ADD COLUMN IF NOT EXISTS comprovantes_taxas_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS comprovantes_camisetas_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.equipe_confirmacoes
SET comprovantes_taxas_urls = jsonb_build_array(comprovante_taxas_url)
WHERE comprovante_taxas_url IS NOT NULL
  AND comprovantes_taxas_urls = '[]'::jsonb;

UPDATE public.equipe_confirmacoes
SET comprovantes_camisetas_urls = jsonb_build_array(comprovante_camisetas_url)
WHERE comprovante_camisetas_url IS NOT NULL
  AND comprovantes_camisetas_urls = '[]'::jsonb;

COMMENT ON COLUMN public.equipe_confirmacoes.comprovantes_taxas_urls IS
'Lista de URLs dos comprovantes enviados para taxas da equipe.';

COMMENT ON COLUMN public.equipe_confirmacoes.comprovantes_camisetas_urls IS
'Lista de URLs dos comprovantes enviados para camisetas da equipe.';

NOTIFY pgrst, 'reload schema';
