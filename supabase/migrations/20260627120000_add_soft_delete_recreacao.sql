ALTER TABLE public.recreacao_dados
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recreacao_dados_ativos
ON public.recreacao_dados (participacao_id)
WHERE deleted_at IS NULL;
