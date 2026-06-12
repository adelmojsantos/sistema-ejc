-- Mantém o pagamento da taxa coerente entre a visita e a participação,
-- independentemente do módulo usado para registrar a alteração.

UPDATE public.participacoes p
SET pago_taxa = true
WHERE p.pago_taxa IS DISTINCT FROM true
  AND EXISTS (
      SELECT 1
      FROM public.visita_participacao v
      WHERE v.participacao_id = p.id
        AND v.taxa_paga = true
  );

UPDATE public.visita_participacao v
SET taxa_paga = COALESCE(p.pago_taxa, false)
FROM public.participacoes p
WHERE p.id = v.participacao_id
  AND v.taxa_paga IS DISTINCT FROM COALESCE(p.pago_taxa, false);

CREATE OR REPLACE FUNCTION public.sync_taxa_visita_para_participacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.participacoes
    SET pago_taxa = COALESCE(NEW.taxa_paga, false)
    WHERE id = NEW.participacao_id
      AND pago_taxa IS DISTINCT FROM COALESCE(NEW.taxa_paga, false);

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_taxa_participacao_para_visita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.visita_participacao
    SET taxa_paga = COALESCE(NEW.pago_taxa, false)
    WHERE participacao_id = NEW.id
      AND taxa_paga IS DISTINCT FROM COALESCE(NEW.pago_taxa, false);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_taxa_visita_para_participacao
    ON public.visita_participacao;

CREATE TRIGGER sync_taxa_visita_para_participacao
AFTER INSERT OR UPDATE OF taxa_paga
ON public.visita_participacao
FOR EACH ROW
EXECUTE FUNCTION public.sync_taxa_visita_para_participacao();

DROP TRIGGER IF EXISTS sync_taxa_participacao_para_visita
    ON public.participacoes;

CREATE TRIGGER sync_taxa_participacao_para_visita
AFTER INSERT OR UPDATE OF pago_taxa
ON public.participacoes
FOR EACH ROW
EXECUTE FUNCTION public.sync_taxa_participacao_para_visita();
