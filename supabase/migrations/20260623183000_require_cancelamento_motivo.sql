UPDATE public.participacoes_canceladas
SET motivo_cancelamento = NULLIF(BTRIM(COALESCE(motivo_cancelamento, observacoes)), '')
WHERE motivo_cancelamento IS NULL
   OR BTRIM(motivo_cancelamento) = '';

ALTER TABLE public.participacoes_canceladas
DROP CONSTRAINT IF EXISTS participacoes_canceladas_motivo_cancelamento_required;

ALTER TABLE public.participacoes_canceladas
ADD CONSTRAINT participacoes_canceladas_motivo_cancelamento_required
CHECK (
  motivo_cancelamento IS NOT NULL
  AND BTRIM(motivo_cancelamento) <> ''
) NOT VALID;
