ALTER TABLE public.encontros
ADD COLUMN IF NOT EXISTS quadrante_visibilidade JSONB NOT NULL DEFAULT '{
    "simbologia": true,
    "tematica": true,
    "musica": true,
    "encontristas": true,
    "encontreiros": true,
    "palestras": true
}'::jsonb;
