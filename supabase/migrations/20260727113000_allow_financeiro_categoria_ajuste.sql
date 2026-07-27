ALTER TABLE public.financeiro_categorias
DROP CONSTRAINT IF EXISTS financeiro_categorias_tipo_check;

ALTER TABLE public.financeiro_categorias
ADD CONSTRAINT financeiro_categorias_tipo_check
CHECK (tipo IN ('receita', 'despesa', 'ambos'));

COMMENT ON COLUMN public.financeiro_categorias.tipo IS
'Escopo da categoria: entrada, saída ou ambos para todos os tipos de lançamento.';
