ALTER TABLE public.financeiro_categorias
DROP CONSTRAINT IF EXISTS financeiro_categorias_tipo_check;

ALTER TABLE public.financeiro_categorias
ADD CONSTRAINT financeiro_categorias_tipo_check
CHECK (tipo IN ('receita', 'despesa', 'ajuste', 'ambos'));

COMMENT ON COLUMN public.financeiro_categorias.tipo IS
'Escopo da categoria: receita, despesa, ajuste ou ambos para todos os tipos de lançamento.';
