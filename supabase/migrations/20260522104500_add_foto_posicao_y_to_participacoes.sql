ALTER TABLE public.participacoes
ADD COLUMN IF NOT EXISTS foto_posicao_y INTEGER DEFAULT 50;
