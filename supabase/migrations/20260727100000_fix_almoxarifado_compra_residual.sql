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
    pendente.pedido_item_id,
    pendente.item_id,
    pendente.marca,
    pendente.quantidade_pendente,
    pendente.quantidade_pendente,
    NULL,
    'pendente'
  FROM (
    SELECT
      pi.id AS pedido_item_id,
      pi.item_id,
      NULLIF(btrim(COALESCE(pi.marca_preferida, '')), '') AS marca,
      GREATEST(
        pi.quantidade_a_comprar - COALESCE(SUM(ci.quantidade_comprada) FILTER (
          WHERE c.status = 'finalizada'
            AND ci.status = 'comprou'
        ), 0),
        0
      ) AS quantidade_pendente
    FROM public.almoxarifado_pedido_itens pi
    JOIN public.almoxarifado_pedidos p ON p.id = pi.pedido_id
    LEFT JOIN public.almoxarifado_compra_itens ci ON ci.pedido_item_id = pi.id
    LEFT JOIN public.almoxarifado_compras c ON c.id = ci.compra_id
    WHERE p.encontro_id = p_encontro_id
      AND p.status IN ('enviado', 'em_compra', 'parcial')
      AND pi.quantidade_a_comprar > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.almoxarifado_compra_itens ci_aberta
        JOIN public.almoxarifado_compras c_aberta ON c_aberta.id = ci_aberta.compra_id
        WHERE ci_aberta.pedido_item_id = pi.id
          AND c_aberta.status = 'aberta'
      )
    GROUP BY pi.id, pi.item_id, pi.marca_preferida, pi.quantidade_a_comprar
  ) pendente
  WHERE pendente.quantidade_pendente > 0;

  RETURN v_compra;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_compra_almoxarifado_de_pedidos(uuid) TO authenticated;
