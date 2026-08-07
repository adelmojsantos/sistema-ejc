-- Recreação infantil é destinada aos filhos de encontreiros.
-- Impede que encontristas sejam gravados como responsáveis, inclusive por
-- chamadas diretas ao banco ou pelo fluxo externo.

CREATE OR REPLACE FUNCTION public.validate_recreacao_responsaveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_principal public.participacoes%ROWTYPE;
  v_outro public.participacoes%ROWTYPE;
BEGIN
  SELECT * INTO v_principal
  FROM public.participacoes
  WHERE id = NEW.participacao_id;

  IF NOT FOUND
     OR v_principal.participante IS DISTINCT FROM FALSE
     OR v_principal.equipe_id IS NULL THEN
    RAISE EXCEPTION 'O responsável principal da recreação deve ser um encontreiro vinculado a uma equipe.';
  END IF;

  IF NEW.outro_responsavel_id IS NOT NULL THEN
    SELECT * INTO v_outro
    FROM public.participacoes
    WHERE id = NEW.outro_responsavel_id;

    IF NOT FOUND
       OR v_outro.participante IS DISTINCT FROM FALSE
       OR v_outro.equipe_id IS NULL
       OR v_outro.encontro_id <> v_principal.encontro_id THEN
      RAISE EXCEPTION 'O segundo responsável deve ser um encontreiro da mesma edição.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_recreacao_responsaveis
  ON public.recreacao_dados;

CREATE TRIGGER validate_recreacao_responsaveis
  BEFORE INSERT OR UPDATE OF participacao_id, outro_responsavel_id
  ON public.recreacao_dados
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_recreacao_responsaveis();
