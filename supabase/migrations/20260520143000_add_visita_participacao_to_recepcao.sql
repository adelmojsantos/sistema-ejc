-- Link recepcao vehicle records to the visitation assignment responsible for the found participant.
-- Existing records remain valid because the new column is nullable.
ALTER TABLE public.recepcao_dados
ADD COLUMN IF NOT EXISTS visita_participacao_id UUID NULL
REFERENCES public.visita_participacao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recepcao_dados_visita_participacao
ON public.recepcao_dados(visita_participacao_id);
