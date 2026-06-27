ALTER TABLE public.equipe_confirmacoes
ADD COLUMN IF NOT EXISTS criancas_recreacao_foto_url TEXT,
ADD COLUMN IF NOT EXISTS criancas_recreacao_foto_posicao_y INTEGER NOT NULL DEFAULT 50;

ALTER TABLE public.equipe_confirmacoes
DROP CONSTRAINT IF EXISTS equipe_confirmacoes_criancas_foto_posicao_check;

ALTER TABLE public.equipe_confirmacoes
ADD CONSTRAINT equipe_confirmacoes_criancas_foto_posicao_check
CHECK (criancas_recreacao_foto_posicao_y BETWEEN 0 AND 100);
