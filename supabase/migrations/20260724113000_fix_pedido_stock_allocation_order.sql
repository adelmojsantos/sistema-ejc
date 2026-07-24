CREATE OR REPLACE FUNCTION public.recalcular_item_pedido_almoxarifado(p_pedido_item_id uuid)
RETURNS public.almoxarifado_pedido_itens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.almoxarifado_pedido_itens;
  v_pedido public.almoxarifado_pedidos;
  v_disponivel_bruto numeric(12, 3);
  v_reservado_anteriores numeric(12, 3);
  v_disponivel_liquido numeric(12, 3);
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
  INTO v_disponivel_bruto
  FROM public.almoxarifado_saldos s
  WHERE s.item_id = v_item.item_id
    AND (v_pedido.encontro_id IS NULL OR s.encontro_id = v_pedido.encontro_id OR s.encontro_id IS NULL)
    AND (
      v_item.marca_preferida IS NULL
      OR btrim(v_item.marca_preferida) = ''
      OR lower(COALESCE(s.marca, '')) = lower(v_item.marca_preferida)
    );

  SELECT COALESCE(SUM(pi.quantidade_necessaria), 0)
  INTO v_reservado_anteriores
  FROM public.almoxarifado_pedido_itens pi
  JOIN public.almoxarifado_pedidos p ON p.id = pi.pedido_id
  WHERE pi.id <> v_item.id
    AND pi.item_id = v_item.item_id
    AND p.status IN ('rascunho', 'enviado', 'em_compra', 'parcial')
    AND (v_pedido.encontro_id IS NULL OR p.encontro_id = v_pedido.encontro_id)
    AND (
      p.created_at < v_pedido.created_at
      OR (p.created_at = v_pedido.created_at AND pi.created_at < v_item.created_at)
      OR (p.created_at = v_pedido.created_at AND pi.created_at = v_item.created_at AND pi.id < v_item.id)
    )
    AND (
      COALESCE(NULLIF(btrim(v_item.marca_preferida), ''), '') = ''
      OR COALESCE(NULLIF(btrim(pi.marca_preferida), ''), '') = ''
      OR lower(pi.marca_preferida) = lower(v_item.marca_preferida)
    );

  v_disponivel_liquido := GREATEST(v_disponivel_bruto - v_reservado_anteriores, 0);

  UPDATE public.almoxarifado_pedido_itens
  SET quantidade_disponivel = LEAST(quantidade_necessaria, v_disponivel_liquido),
      quantidade_a_comprar = GREATEST(quantidade_necessaria - v_disponivel_liquido, 0)
  WHERE id = p_pedido_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalcular_pedidos_relacionados_almoxarifado(p_pedido_item_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.almoxarifado_pedido_itens;
  v_pedido public.almoxarifado_pedidos;
  v_related record;
  v_total integer := 0;
BEGIN
  SELECT * INTO v_item
  FROM public.almoxarifado_pedido_itens
  WHERE id = p_pedido_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item do pedido não encontrado.';
  END IF;

  SELECT * INTO v_pedido
  FROM public.almoxarifado_pedidos
  WHERE id = v_item.pedido_id;

  IF NOT public.can_access_almoxarifado_pedido(v_item.pedido_id) THEN
    RAISE EXCEPTION 'Usuário sem permissão para recalcular este pedido.';
  END IF;

  FOR v_related IN
    SELECT pi.id
    FROM public.almoxarifado_pedido_itens pi
    JOIN public.almoxarifado_pedidos p ON p.id = pi.pedido_id
    WHERE pi.item_id = v_item.item_id
      AND p.status IN ('rascunho', 'enviado', 'em_compra', 'parcial')
      AND (v_pedido.encontro_id IS NULL OR p.encontro_id = v_pedido.encontro_id)
      AND (
        COALESCE(NULLIF(btrim(v_item.marca_preferida), ''), '') = ''
        OR COALESCE(NULLIF(btrim(pi.marca_preferida), ''), '') = ''
        OR lower(pi.marca_preferida) = lower(v_item.marca_preferida)
      )
    ORDER BY p.created_at, pi.created_at, pi.id
  LOOP
    PERFORM public.recalcular_item_pedido_almoxarifado(v_related.id);
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalcular_item_pedido_almoxarifado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_pedidos_relacionados_almoxarifado(uuid) TO authenticated;
