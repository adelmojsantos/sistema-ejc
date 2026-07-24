INSERT INTO public.permissoes (chave, descricao)
VALUES
  ('almoxarifado_pedidos_criar', 'Criar pedidos de compra do almoxarifado'),
  ('almoxarifado_pedidos_gerenciar', 'Gerenciar todos os pedidos de compra do almoxarifado')
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.almoxarifado_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid REFERENCES public.encontros(id) ON DELETE CASCADE,
  solicitante_equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  criado_por_usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  criado_em_nome_de_terceiro boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado', 'em_compra', 'parcial', 'finalizado', 'cancelado')),
  titulo text NOT NULL,
  observacoes text,
  observacao_origem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_pedidos_encontro
ON public.almoxarifado_pedidos(encontro_id);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_pedidos_equipe
ON public.almoxarifado_pedidos(solicitante_equipe_id);

CREATE TABLE IF NOT EXISTS public.almoxarifado_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.almoxarifado_pedidos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.almoxarifado_itens(id) ON DELETE RESTRICT,
  marca_preferida text,
  quantidade_necessaria numeric(12, 3) NOT NULL CHECK (quantidade_necessaria > 0),
  quantidade_disponivel numeric(12, 3) NOT NULL DEFAULT 0 CHECK (quantidade_disponivel >= 0),
  quantidade_a_comprar numeric(12, 3) NOT NULL DEFAULT 0 CHECK (quantidade_a_comprar >= 0),
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_pedido_itens_pedido
ON public.almoxarifado_pedido_itens(pedido_id);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_pedido_itens_item
ON public.almoxarifado_pedido_itens(item_id);

DROP TRIGGER IF EXISTS set_almoxarifado_pedidos_updated_at ON public.almoxarifado_pedidos;
CREATE TRIGGER set_almoxarifado_pedidos_updated_at
BEFORE UPDATE ON public.almoxarifado_pedidos
FOR EACH ROW EXECUTE FUNCTION public.set_almoxarifado_updated_at();

DROP TRIGGER IF EXISTS set_almoxarifado_pedido_itens_updated_at ON public.almoxarifado_pedido_itens;
CREATE TRIGGER set_almoxarifado_pedido_itens_updated_at
BEFORE UPDATE ON public.almoxarifado_pedido_itens
FOR EACH ROW EXECUTE FUNCTION public.set_almoxarifado_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_almoxarifado_pedidos()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'almoxarifado_pedidos_gerenciar');
$$;

CREATE OR REPLACE FUNCTION public.can_create_almoxarifado_pedidos()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.can_manage_almoxarifado_pedidos()
    OR public.has_permission(auth.uid(), 'modulo_coordenador')
    OR public.has_permission(auth.uid(), 'almoxarifado_pedidos_criar');
$$;

CREATE OR REPLACE FUNCTION public.can_access_almoxarifado_pedido(p_pedido_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.can_manage_almoxarifado_pedidos()
    OR EXISTS (
      SELECT 1
      FROM public.almoxarifado_pedidos p
      WHERE p.id = p_pedido_id
        AND (
          p.criado_por_usuario_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.participacoes part
            WHERE part.equipe_id = p.solicitante_equipe_id
              AND part.coordenador = true
              AND part.pessoa_id IN (
                SELECT pe.id
                FROM public.pessoas pe
                JOIN public.profiles pr ON lower(pr.email) = lower(pe.email)
                WHERE pr.id = auth.uid()
              )
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.recalcular_item_pedido_almoxarifado(p_pedido_item_id uuid)
RETURNS public.almoxarifado_pedido_itens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.almoxarifado_pedido_itens;
  v_pedido public.almoxarifado_pedidos;
  v_disponivel numeric(12, 3);
BEGIN
  SELECT * INTO v_item
  FROM public.almoxarifado_pedido_itens
  WHERE id = p_pedido_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item do pedido não encontrado.';
  END IF;

  SELECT * INTO v_pedido
  FROM public.almoxarifado_pedidos
  WHERE id = v_item.pedido_id;

  IF NOT public.can_access_almoxarifado_pedido(v_item.pedido_id) THEN
    RAISE EXCEPTION 'Usuário sem permissão para recalcular este pedido.';
  END IF;

  SELECT COALESCE(SUM(s.quantidade), 0)
  INTO v_disponivel
  FROM public.almoxarifado_saldos s
  WHERE s.item_id = v_item.item_id
    AND (v_pedido.encontro_id IS NULL OR s.encontro_id = v_pedido.encontro_id OR s.encontro_id IS NULL)
    AND (v_item.marca_preferida IS NULL OR btrim(v_item.marca_preferida) = '' OR lower(COALESCE(s.marca, '')) = lower(v_item.marca_preferida));

  UPDATE public.almoxarifado_pedido_itens
  SET quantidade_disponivel = v_disponivel,
      quantidade_a_comprar = GREATEST(quantidade_necessaria - v_disponivel, 0)
  WHERE id = p_pedido_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

ALTER TABLE public.almoxarifado_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almoxarifado_pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "almoxarifado_pedidos_select" ON public.almoxarifado_pedidos;
CREATE POLICY "almoxarifado_pedidos_select"
ON public.almoxarifado_pedidos FOR SELECT TO authenticated
USING (public.can_manage_almoxarifado_pedidos() OR public.can_access_almoxarifado_pedido(id));

DROP POLICY IF EXISTS "almoxarifado_pedidos_insert" ON public.almoxarifado_pedidos;
CREATE POLICY "almoxarifado_pedidos_insert"
ON public.almoxarifado_pedidos FOR INSERT TO authenticated
WITH CHECK (public.can_create_almoxarifado_pedidos());

DROP POLICY IF EXISTS "almoxarifado_pedidos_update" ON public.almoxarifado_pedidos;
CREATE POLICY "almoxarifado_pedidos_update"
ON public.almoxarifado_pedidos FOR UPDATE TO authenticated
USING (public.can_manage_almoxarifado_pedidos() OR public.can_access_almoxarifado_pedido(id))
WITH CHECK (public.can_manage_almoxarifado_pedidos() OR public.can_access_almoxarifado_pedido(id));

DROP POLICY IF EXISTS "almoxarifado_pedido_itens_select" ON public.almoxarifado_pedido_itens;
CREATE POLICY "almoxarifado_pedido_itens_select"
ON public.almoxarifado_pedido_itens FOR SELECT TO authenticated
USING (public.can_access_almoxarifado_pedido(pedido_id));

DROP POLICY IF EXISTS "almoxarifado_pedido_itens_manage" ON public.almoxarifado_pedido_itens;
CREATE POLICY "almoxarifado_pedido_itens_manage"
ON public.almoxarifado_pedido_itens FOR ALL TO authenticated
USING (public.can_access_almoxarifado_pedido(pedido_id))
WITH CHECK (public.can_access_almoxarifado_pedido(pedido_id));

GRANT EXECUTE ON FUNCTION public.can_manage_almoxarifado_pedidos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_almoxarifado_pedidos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_almoxarifado_pedido(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_item_pedido_almoxarifado(uuid) TO authenticated;
