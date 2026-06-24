ALTER TABLE public.visita_participacao
    ADD COLUMN IF NOT EXISTS foto_familia_url text;

COMMENT ON COLUMN public.visita_participacao.foto_familia_url IS
    'URL pública da foto da família registrada durante a visita.';
