-- Registra pagamento e comprovante por intenção de camiseta do encontrista.

ALTER TABLE public.visita_intencao_camiseta
    ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS comprovante_url text,
    ADD COLUMN IF NOT EXISTS pago_em timestamptz,
    ADD COLUMN IF NOT EXISTS pago_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_visita_intencao_camiseta_pago
    ON public.visita_intencao_camiseta(pago);

COMMENT ON COLUMN public.visita_intencao_camiseta.pago IS
    'Indica se esta intenção de camiseta já foi paga pelo encontrista.';

COMMENT ON COLUMN public.visita_intencao_camiseta.comprovante_url IS
    'URL pública do comprovante anexado para esta intenção.';
