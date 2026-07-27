INSERT INTO public.permissoes (chave, descricao)
VALUES
  ('almoxarifado_compras_operar', 'Operar checklist de compras do almoxarifado')
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.almoxarifado_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid REFERENCES public.encontros(id) ON DELETE CASCADE,
  mercado_fornecedor text,
  data_compra date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'finalizada', 'cancelada')),
  valor_total_calculado numeric(12, 2) NOT NULL DEFAULT 0,
  valor_total_informado numeric(12, 2),
  comprovante_url text,
  observacoes text,
  criado_por_usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_compras_encontro
ON public.almoxarifado_compras(encontro_id);

CREATE TABLE IF NOT EXISTS public.almoxarifado_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES public.almoxarifado_compras(id) ON DELETE CASCADE,
  pedido_item_id uuid REFERENCES public.almoxarifado_pedido_itens(id) ON DELETE SET NULL,
  item_id uuid NOT NULL REFERENCES public.almoxarifado_itens(id) ON DELETE RESTRICT,
  marca text,
  quantidade_a_comprar numeric(12, 3) NOT NULL DEFAULT 0 CHECK (quantidade_a_comprar >= 0),
  quantidade_comprada numeric(12, 3) NOT NULL DEFAULT 0 CHECK (quantidade_comprada >= 0),
  valor_unitario numeric(12, 2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  valor_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  mercado_fornecedor text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'comprou', 'nao_comprou')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_compra_itens_compra
ON public.almoxarifado_compra_itens(compra_id);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_compra_itens_pedido_item
ON public.almoxarifado_compra_itens(pedido_item_id);

DROP TRIGGER IF EXISTS set_almoxarifado_compras_updated_at ON public.almoxarifado_compras;
CREATE TRIGGER set_almoxarifado_compras_updated_at
BEFORE UPDATE ON public.almoxarifado_compras
FOR EACH ROW EXECUTE FUNCTION public.set_almoxarifado_updated_at();

DROP TRIGGER IF EXISTS set_almoxarifado_compra_itens_updated_at ON public.almoxarifado_compra_itens;
CREATE TRIGGER set_almoxarifado_compra_itens_updated_at
BEFORE UPDATE ON public.almoxarifado_compra_itens
FOR EACH ROW EXECUTE FUNCTION public.set_almoxarifado_updated_at();

CREATE OR REPLACE FUNCTION public.can_operate_almoxarifado_compras()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'almoxarifado_compras_operar');
$$;

CREATE OR REPLACE FUNCTION public.refresh_almoxarifado_compra_total(p_compra_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(12, 2);
BEGIN
  IF NOT public.can_operate_almoxarifado_compras() THEN
    RAISE EXCEPTION 'Usuário sem permissão para operar compras.';
  END IF;

  SELECT COALESCE(SUM(valor_total), 0)
  INTO v_total
  FROM public.almoxarifado_compra_itens
  WHERE compra_id = p_compra_id
    AND status = 'comprou';

  UPDATE public.almoxarifado_compras
  SET valor_total_calculado = v_total
  WHERE id = p_compra_id;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_compra_almoxarifado_de_pedidos(p_encontro_id uuid)
RETURNS public.almoxarifado_compras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra public.almoxarifado_compras;
BEGIN
  IF NOT public.can_operate_almoxarifado_compras() THEN
    RAISE EXCEPTION 'Usuário sem permissão para operar compras.';
  END IF;

  INSERT INTO public.almoxarifado_compras (encontro_id, status)
  VALUES (p_encontro_id, 'aberta')
  RETURNING * INTO v_compra;

  INSERT INTO public.almoxarifado_compra_itens (
    compra_id,
    pedido_item_id,
    item_id,
    marca,
    quantidade_a_comprar,
    quantidade_comprada,
    mercado_fornecedor,
    status
  )
  SELECT
    v_compra.id,
    pi.id,
    pi.item_id,
    NULLIF(btrim(COALESCE(pi.marca_preferida, '')), ''),
    pi.quantidade_a_comprar,
    pi.quantidade_a_comprar,
    NULL,
    'pendente'
  FROM public.almoxarifado_pedido_itens pi
  JOIN public.almoxarifado_pedidos p ON p.id = pi.pedido_id
  WHERE p.encontro_id = p_encontro_id
    AND p.status IN ('enviado', 'em_compra', 'parcial')
    AND pi.quantidade_a_comprar > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.almoxarifado_compra_itens ci
      JOIN public.almoxarifado_compras c ON c.id = ci.compra_id
      WHERE ci.pedido_item_id = pi.id
        AND c.status <> 'cancelada'
    );

  RETURN v_compra;
END;
$$;

ALTER TABLE public.almoxarifado_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almoxarifado_compra_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "almoxarifado_compras_select" ON public.almoxarifado_compras;
CREATE POLICY "almoxarifado_compras_select"
ON public.almoxarifado_compras FOR SELECT TO authenticated
USING (public.can_access_almoxarifado() OR public.can_operate_almoxarifado_compras());

DROP POLICY IF EXISTS "almoxarifado_compras_manage" ON public.almoxarifado_compras;
CREATE POLICY "almoxarifado_compras_manage"
ON public.almoxarifado_compras FOR ALL TO authenticated
USING (public.can_operate_almoxarifado_compras())
WITH CHECK (public.can_operate_almoxarifado_compras());

DROP POLICY IF EXISTS "almoxarifado_compra_itens_select" ON public.almoxarifado_compra_itens;
CREATE POLICY "almoxarifado_compra_itens_select"
ON public.almoxarifado_compra_itens FOR SELECT TO authenticated
USING (
  public.can_access_almoxarifado()
  OR public.can_operate_almoxarifado_compras()
);

DROP POLICY IF EXISTS "almoxarifado_compra_itens_manage" ON public.almoxarifado_compra_itens;
CREATE POLICY "almoxarifado_compra_itens_manage"
ON public.almoxarifado_compra_itens FOR ALL TO authenticated
USING (public.can_operate_almoxarifado_compras())
WITH CHECK (public.can_operate_almoxarifado_compras());

GRANT EXECUTE ON FUNCTION public.can_operate_almoxarifado_compras() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_almoxarifado_compra_total(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_compra_almoxarifado_de_pedidos(uuid) TO authenticated;
