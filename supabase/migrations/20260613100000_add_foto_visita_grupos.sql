ALTER TABLE public.visita_grupos
    ADD COLUMN IF NOT EXISTS foto_url text;

COMMENT ON COLUMN public.visita_grupos.foto_url IS
    'Foto da dupla de visitação usada no painel e nas placas impressas.';
