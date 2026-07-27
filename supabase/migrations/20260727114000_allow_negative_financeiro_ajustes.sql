ALTER TABLE public.financeiro_lancamentos
DROP CONSTRAINT IF EXISTS financeiro_lancamentos_valor_check;

ALTER TABLE public.financeiro_lancamentos
ADD CONSTRAINT financeiro_lancamentos_valor_check
CHECK (valor > 0);

CREATE OR REPLACE FUNCTION public.criar_financeiro_lancamento_manual(
  p_encontro_id uuid,
  p_categoria_id uuid,
  p_tipo text,
  p_descricao text,
  p_valor numeric,
  p_data_lancamento date DEFAULT CURRENT_DATE,
  p_observacoes text DEFAULT NULL
)
RETURNS public.financeiro_lancamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lancamento public.financeiro_lancamentos;
BEGIN
  IF NOT public.can_manage_financeiro() THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar o financeiro.';
  END IF;

  IF p_tipo NOT IN ('receita', 'despesa') THEN
    RAISE EXCEPTION 'Tipo de lançamento inválido.';
  END IF;

  IF p_encontro_id IS NULL THEN
    RAISE EXCEPTION 'Informe o encontro do lançamento.';
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor válido para o tipo de lançamento.';
  END IF;

  IF NULLIF(btrim(COALESCE(p_descricao, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a descrição do lançamento.';
  END IF;

  INSERT INTO public.financeiro_lancamentos (
    encontro_id,
    categoria_id,
    tipo,
    origem,
    descricao,
    valor,
    data_lancamento,
    observacoes,
    criado_por_usuario_id
  )
  VALUES (
    p_encontro_id,
    p_categoria_id,
    p_tipo,
    'manual',
    NULLIF(btrim(p_descricao), ''),
    p_valor,
    COALESCE(p_data_lancamento, CURRENT_DATE),
    NULLIF(btrim(COALESCE(p_observacoes, '')), ''),
    auth.uid()
  )
  RETURNING * INTO v_lancamento;

  RETURN v_lancamento;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_financeiro_lancamento_manual(uuid, uuid, text, text, numeric, date, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
