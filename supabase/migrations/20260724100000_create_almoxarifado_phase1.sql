INSERT INTO public.permissoes (chave, descricao)
VALUES
  ('modulo_almoxarifado', 'Acesso ao módulo de almoxarifado/estoque'),
  ('almoxarifado_consultar', 'Visualizar estoque do almoxarifado'),
  ('almoxarifado_gerenciar', 'Cadastrar e editar itens, categorias e unidades do almoxarifado'),
  ('almoxarifado_movimentar', 'Lançar entradas, saídas e ajustes no almoxarifado')
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.almoxarifado_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.almoxarifado_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  sigla text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.almoxarifado_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria_id uuid REFERENCES public.almoxarifado_categorias(id) ON DELETE SET NULL,
  unidade_id uuid REFERENCES public.almoxarifado_unidades(id) ON DELETE SET NULL,
  equipe_padrao_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  marca_preferida text,
  fornecedor_padrao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome)
);

CREATE TABLE IF NOT EXISTS public.almoxarifado_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid REFERENCES public.encontros(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.almoxarifado_itens(id) ON DELETE RESTRICT,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  marca text,
  fornecedor text,
  quantidade numeric(12, 3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  data_validade date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_saldos_encontro
ON public.almoxarifado_saldos(encontro_id);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_saldos_item
ON public.almoxarifado_saldos(item_id);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_saldos_equipe
ON public.almoxarifado_saldos(equipe_id);

CREATE TABLE IF NOT EXISTS public.almoxarifado_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saldo_id uuid REFERENCES public.almoxarifado_saldos(id) ON DELETE SET NULL,
  encontro_id uuid REFERENCES public.encontros(id) ON DELETE SET NULL,
  item_id uuid NOT NULL REFERENCES public.almoxarifado_itens(id) ON DELETE RESTRICT,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  quantidade numeric(12, 3) NOT NULL CHECK (quantidade > 0),
  quantidade_anterior numeric(12, 3),
  quantidade_resultante numeric(12, 3),
  motivo text,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_movimentacoes_saldo
ON public.almoxarifado_movimentacoes(saldo_id);

CREATE INDEX IF NOT EXISTS idx_almoxarifado_movimentacoes_encontro
ON public.almoxarifado_movimentacoes(encontro_id);

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_almoxarifado(
  p_saldo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_motivo text DEFAULT NULL
)
RETURNS public.almoxarifado_saldos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo public.almoxarifado_saldos;
  v_anterior numeric(12, 3);
  v_resultante numeric(12, 3);
BEGIN
  IF NOT public.can_move_almoxarifado() AND NOT public.can_manage_almoxarifado() THEN
    RAISE EXCEPTION 'Usuário sem permissão para movimentar o almoxarifado.';
  END IF;

  IF p_tipo NOT IN ('entrada', 'saida', 'ajuste') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido.';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior que zero.';
  END IF;

  SELECT *
  INTO v_saldo
  FROM public.almoxarifado_saldos
  WHERE id = p_saldo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo não encontrado.';
  END IF;

  v_anterior := v_saldo.quantidade;

  IF p_tipo = 'entrada' THEN
    v_resultante := v_anterior + p_quantidade;
  ELSIF p_tipo = 'saida' THEN
    v_resultante := v_anterior - p_quantidade;
    IF v_resultante < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente para a saída solicitada.';
    END IF;
  ELSE
    v_resultante := p_quantidade;
  END IF;

  UPDATE public.almoxarifado_saldos
  SET quantidade = v_resultante
  WHERE id = p_saldo_id
  RETURNING * INTO v_saldo;

  INSERT INTO public.almoxarifado_movimentacoes (
    saldo_id,
    encontro_id,
    item_id,
    equipe_id,
    tipo,
    quantidade,
    quantidade_anterior,
    quantidade_resultante,
    motivo,
    usuario_id
  )
  VALUES (
    v_saldo.id,
    v_saldo.encontro_id,
    v_saldo.item_id,
    v_saldo.equipe_id,
    p_tipo,
    p_quantidade,
    v_anterior,
    v_resultante,
    p_motivo,
    auth.uid()
  );

  RETURN v_saldo;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_almoxarifado_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_almoxarifado_categorias_updated_at ON public.almoxarifado_categorias;
CREATE TRIGGER set_almoxarifado_categorias_updated_at
BEFORE UPDATE ON public.almoxarifado_categorias
FOR EACH ROW EXECUTE FUNCTION public.set_almoxarifado_updated_at();

DROP TRIGGER IF EXISTS set_almoxarifado_unidades_updated_at ON public.almoxarifado_unidades;
CREATE TRIGGER set_almoxarifado_unidades_updated_at
BEFORE UPDATE ON public.almoxarifado_unidades
FOR EACH ROW EXECUTE FUNCTION public.set_almoxarifado_updated_at();

DROP TRIGGER IF EXISTS set_almoxarifado_itens_updated_at ON public.almoxarifado_itens;
CREATE TRIGGER set_almoxarifado_itens_updated_at
BEFORE UPDATE ON public.almoxarifado_itens
FOR EACH ROW EXECUTE FUNCTION public.set_almoxarifado_updated_at();

DROP TRIGGER IF EXISTS set_almoxarifado_saldos_updated_at ON public.almoxarifado_saldos;
CREATE TRIGGER set_almoxarifado_saldos_updated_at
BEFORE UPDATE ON public.almoxarifado_saldos
FOR EACH ROW EXECUTE FUNCTION public.set_almoxarifado_updated_at();

CREATE OR REPLACE FUNCTION public.can_access_almoxarifado()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'modulo_almoxarifado')
    OR public.has_permission(auth.uid(), 'almoxarifado_consultar')
    OR public.has_permission(auth.uid(), 'almoxarifado_gerenciar')
    OR public.has_permission(auth.uid(), 'almoxarifado_movimentar')
    OR public.has_permission(auth.uid(), 'modulo_coordenador');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_almoxarifado()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'almoxarifado_gerenciar');
$$;

CREATE OR REPLACE FUNCTION public.can_move_almoxarifado()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'almoxarifado_movimentar');
$$;

ALTER TABLE public.almoxarifado_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almoxarifado_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almoxarifado_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almoxarifado_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almoxarifado_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "almoxarifado_categorias_select" ON public.almoxarifado_categorias;
CREATE POLICY "almoxarifado_categorias_select"
ON public.almoxarifado_categorias FOR SELECT TO authenticated
USING (public.can_access_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_categorias_manage" ON public.almoxarifado_categorias;
CREATE POLICY "almoxarifado_categorias_manage"
ON public.almoxarifado_categorias FOR ALL TO authenticated
USING (public.can_manage_almoxarifado())
WITH CHECK (public.can_manage_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_unidades_select" ON public.almoxarifado_unidades;
CREATE POLICY "almoxarifado_unidades_select"
ON public.almoxarifado_unidades FOR SELECT TO authenticated
USING (public.can_access_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_unidades_manage" ON public.almoxarifado_unidades;
CREATE POLICY "almoxarifado_unidades_manage"
ON public.almoxarifado_unidades FOR ALL TO authenticated
USING (public.can_manage_almoxarifado())
WITH CHECK (public.can_manage_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_itens_select" ON public.almoxarifado_itens;
CREATE POLICY "almoxarifado_itens_select"
ON public.almoxarifado_itens FOR SELECT TO authenticated
USING (public.can_access_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_itens_manage" ON public.almoxarifado_itens;
CREATE POLICY "almoxarifado_itens_manage"
ON public.almoxarifado_itens FOR ALL TO authenticated
USING (public.can_manage_almoxarifado())
WITH CHECK (public.can_manage_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_saldos_select" ON public.almoxarifado_saldos;
CREATE POLICY "almoxarifado_saldos_select"
ON public.almoxarifado_saldos FOR SELECT TO authenticated
USING (public.can_access_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_saldos_manage" ON public.almoxarifado_saldos;
CREATE POLICY "almoxarifado_saldos_manage"
ON public.almoxarifado_saldos FOR ALL TO authenticated
USING (public.can_move_almoxarifado() OR public.can_manage_almoxarifado())
WITH CHECK (public.can_move_almoxarifado() OR public.can_manage_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_movimentacoes_select" ON public.almoxarifado_movimentacoes;
CREATE POLICY "almoxarifado_movimentacoes_select"
ON public.almoxarifado_movimentacoes FOR SELECT TO authenticated
USING (public.can_access_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_movimentacoes_insert" ON public.almoxarifado_movimentacoes;
CREATE POLICY "almoxarifado_movimentacoes_insert"
ON public.almoxarifado_movimentacoes FOR INSERT TO authenticated
WITH CHECK (public.can_move_almoxarifado() OR public.can_manage_almoxarifado());

DROP POLICY IF EXISTS "almoxarifado_movimentacoes_admin_delete" ON public.almoxarifado_movimentacoes;
CREATE POLICY "almoxarifado_movimentacoes_admin_delete"
ON public.almoxarifado_movimentacoes FOR DELETE TO authenticated
USING (public.is_admin() OR public.has_permission(auth.uid(), 'modulo_admin'));

INSERT INTO public.almoxarifado_categorias (nome, cor)
VALUES
  ('Comida', '#22c55e'),
  ('Higiene', '#3b82f6'),
  ('Papelaria', '#8b5cf6'),
  ('Limpeza', '#14b8a6'),
  ('Uso geral', '#f59e0b')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.almoxarifado_unidades (nome, sigla)
VALUES
  ('Unidade', 'un'),
  ('Pacote', 'pct'),
  ('Caixa', 'cx'),
  ('Quilograma', 'kg'),
  ('Grama', 'g'),
  ('Litro', 'l'),
  ('Mililitro', 'ml'),
  ('Rolo', 'rolo')
ON CONFLICT (sigla) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.can_access_almoxarifado() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_almoxarifado() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_move_almoxarifado() TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_almoxarifado(uuid, text, numeric, text) TO authenticated;
