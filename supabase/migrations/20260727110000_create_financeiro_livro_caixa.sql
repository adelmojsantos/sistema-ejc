INSERT INTO public.permissoes (chave, descricao)
VALUES
  ('modulo_financeiro', 'Acesso ao módulo financeiro'),
  ('financeiro_gerenciar', 'Gerenciar lançamentos financeiros')
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_access_financeiro()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'modulo_financeiro')
    OR public.has_permission(auth.uid(), 'financeiro_gerenciar');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_financeiro()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'financeiro_gerenciar');
$$;

CREATE TABLE IF NOT EXISTS public.financeiro_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid REFERENCES public.encontros(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita', 'despesa', 'ambos')),
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_categorias_nome_tipo_encontro_idx
ON public.financeiro_categorias (
  lower(nome),
  tipo,
  COALESCE(encontro_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES public.financeiro_categorias(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'taxa', 'camiseta', 'almoxarifado_compra', 'minimercado')),
  origem_id uuid,
  descricao text NOT NULL,
  valor numeric(12, 2) NOT NULL CHECK (valor > 0),
  data_lancamento date NOT NULL DEFAULT CURRENT_DATE,
  comprovantes_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  criado_por_usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  cancelado_em timestamptz,
  cancelado_por_usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_encontro
ON public.financeiro_lancamentos(encontro_id);

CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_categoria
ON public.financeiro_lancamentos(categoria_id);

CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_origem
ON public.financeiro_lancamentos(origem, origem_id);

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_lancamentos_origem_ativa_idx
ON public.financeiro_lancamentos(origem, origem_id)
WHERE origem_id IS NOT NULL
  AND status = 'ativo';

DROP TRIGGER IF EXISTS financeiro_categorias_set_updated_at ON public.financeiro_categorias;
CREATE TRIGGER financeiro_categorias_set_updated_at
BEFORE UPDATE ON public.financeiro_categorias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS financeiro_lancamentos_set_updated_at ON public.financeiro_lancamentos;
CREATE TRIGGER financeiro_lancamentos_set_updated_at
BEFORE UPDATE ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financeiro_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financeiro_categorias_select" ON public.financeiro_categorias;
CREATE POLICY "financeiro_categorias_select"
ON public.financeiro_categorias FOR SELECT TO authenticated
USING (public.can_access_financeiro());

DROP POLICY IF EXISTS "financeiro_categorias_manage" ON public.financeiro_categorias;
CREATE POLICY "financeiro_categorias_manage"
ON public.financeiro_categorias FOR ALL TO authenticated
USING (public.can_manage_financeiro())
WITH CHECK (public.can_manage_financeiro());

DROP POLICY IF EXISTS "financeiro_lancamentos_select" ON public.financeiro_lancamentos;
CREATE POLICY "financeiro_lancamentos_select"
ON public.financeiro_lancamentos FOR SELECT TO authenticated
USING (public.can_access_financeiro());

DROP POLICY IF EXISTS "financeiro_lancamentos_manage" ON public.financeiro_lancamentos;
CREATE POLICY "financeiro_lancamentos_manage"
ON public.financeiro_lancamentos FOR ALL TO authenticated
USING (public.can_manage_financeiro())
WITH CHECK (public.can_manage_financeiro());

INSERT INTO public.financeiro_categorias (nome, tipo, cor)
VALUES
  ('Almoxarifado / Compras', 'despesa', '#f59e0b')
ON CONFLICT DO NOTHING;

ALTER TABLE public.almoxarifado_compras
ADD COLUMN IF NOT EXISTS financeiro_lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS financeiro_lancado_em timestamptz;

COMMENT ON TABLE public.financeiro_categorias IS
'Categorias usadas para classificar entradas e saídas do encontro.';

COMMENT ON TABLE public.financeiro_lancamentos IS
'Livro-caixa unificado do encontro, com entradas e saídas.';

COMMENT ON COLUMN public.financeiro_lancamentos.origem IS
'Origem funcional do lançamento para rastreabilidade e prevenção de duplicidade.';

COMMENT ON COLUMN public.almoxarifado_compras.financeiro_lancamento_id IS
'Lançamento financeiro gerado pela finalização desta compra.';

COMMENT ON COLUMN public.almoxarifado_compras.financeiro_lancado_em IS
'Momento em que a compra gerou saída no financeiro.';

GRANT EXECUTE ON FUNCTION public.can_access_financeiro() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_financeiro() TO authenticated;

NOTIFY pgrst, 'reload schema';
