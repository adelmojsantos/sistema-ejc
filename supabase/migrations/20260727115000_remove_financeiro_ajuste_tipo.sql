UPDATE public.financeiro_categorias
SET tipo = 'ambos'
WHERE tipo = 'ajuste';

INSERT INTO public.financeiro_categorias (encontro_id, nome, tipo, cor)
SELECT DISTINCT
  lancamentos.encontro_id,
  'Ajuste',
  'ambos',
  '#64748b'
FROM public.financeiro_lancamentos lancamentos
WHERE lancamentos.tipo = 'ajuste'
  AND lancamentos.categoria_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.financeiro_lancamentos lancamentos
SET categoria_id = categorias.id
FROM public.financeiro_categorias categorias
WHERE lancamentos.tipo = 'ajuste'
  AND lancamentos.categoria_id IS NULL
  AND categorias.nome = 'Ajuste'
  AND categorias.tipo = 'ambos'
  AND categorias.encontro_id = lancamentos.encontro_id;

ALTER TABLE public.financeiro_lancamentos
DROP CONSTRAINT IF EXISTS financeiro_lancamentos_tipo_check;

ALTER TABLE public.financeiro_lancamentos
DROP CONSTRAINT IF EXISTS financeiro_lancamentos_valor_check;

UPDATE public.financeiro_lancamentos
SET
  tipo = CASE WHEN valor < 0 THEN 'despesa' ELSE 'receita' END,
  valor = ABS(valor)
WHERE tipo = 'ajuste';

ALTER TABLE public.financeiro_lancamentos
ADD CONSTRAINT financeiro_lancamentos_tipo_check
CHECK (tipo IN ('receita', 'despesa'));

ALTER TABLE public.financeiro_lancamentos
ADD CONSTRAINT financeiro_lancamentos_valor_check
CHECK (valor > 0);

ALTER TABLE public.financeiro_categorias
DROP CONSTRAINT IF EXISTS financeiro_categorias_tipo_check;

ALTER TABLE public.financeiro_categorias
ADD CONSTRAINT financeiro_categorias_tipo_check
CHECK (tipo IN ('receita', 'despesa', 'ambos'));

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
    RAISE EXCEPTION 'Informe um valor maior que zero.';
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

CREATE OR REPLACE FUNCTION public.atualizar_financeiro_lancamento_manual(
  p_lancamento_id uuid,
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

  SELECT *
  INTO v_lancamento
  FROM public.financeiro_lancamentos
  WHERE id = p_lancamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado.';
  END IF;

  IF v_lancamento.origem <> 'manual' THEN
    RAISE EXCEPTION 'Somente lançamentos manuais podem ser editados no financeiro.';
  END IF;

  IF v_lancamento.status <> 'ativo' THEN
    RAISE EXCEPTION 'Somente lançamentos ativos podem ser editados.';
  END IF;

  IF p_tipo NOT IN ('receita', 'despesa') THEN
    RAISE EXCEPTION 'Tipo de lançamento inválido.';
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor maior que zero.';
  END IF;

  IF NULLIF(btrim(COALESCE(p_descricao, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a descrição do lançamento.';
  END IF;

  UPDATE public.financeiro_lancamentos
  SET
    categoria_id = p_categoria_id,
    tipo = p_tipo,
    descricao = NULLIF(btrim(p_descricao), ''),
    valor = p_valor,
    data_lancamento = COALESCE(p_data_lancamento, CURRENT_DATE),
    observacoes = NULLIF(btrim(COALESCE(p_observacoes, '')), '')
  WHERE id = p_lancamento_id
  RETURNING * INTO v_lancamento;

  RETURN v_lancamento;
END;
$$;

COMMENT ON TABLE public.financeiro_lancamentos IS
'Livro-caixa unificado do encontro, com entradas e saídas.';

COMMENT ON COLUMN public.financeiro_categorias.tipo IS
'Escopo da categoria: entrada, saída ou ambos para todos os tipos de lançamento.';

GRANT EXECUTE ON FUNCTION public.criar_financeiro_lancamento_manual(uuid, uuid, text, text, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_financeiro_lancamento_manual(uuid, uuid, text, text, numeric, date, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
