ALTER TABLE public.almoxarifado_compras
ADD COLUMN IF NOT EXISTS estoque_lancado_em timestamptz;

COMMENT ON COLUMN public.almoxarifado_compras.estoque_lancado_em IS
'Momento em que a compra gerou entrada automática no estoque.';

CREATE OR REPLACE FUNCTION public.finalizar_compra_almoxarifado(
  p_compra_id uuid,
  p_itens jsonb,
  p_comprovantes_urls jsonb DEFAULT '[]'::jsonb
)
RETURNS public.almoxarifado_compras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra public.almoxarifado_compras;
  v_item record;
  v_saldo public.almoxarifado_saldos;
  v_anterior numeric(12, 3);
  v_resultante numeric(12, 3);
  v_equipe_id uuid;
  v_pedido_id uuid;
BEGIN
  IF NOT public.can_operate_almoxarifado_compras() THEN
    RAISE EXCEPTION 'Usuário sem permissão para finalizar compras.';
  END IF;

  SELECT *
  INTO v_compra
  FROM public.almoxarifado_compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra não encontrada.';
  END IF;

  IF v_compra.estoque_lancado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Compra já teve entrada lançada no estoque.';
  END IF;

  FOR v_item IN
    SELECT *
    FROM jsonb_to_recordset(COALESCE(p_itens, '[]'::jsonb)) AS item(
      id uuid,
      status text,
      quantidade_comprada numeric,
      valor_unitario numeric,
      mercado_fornecedor text,
      observacoes text
    )
  LOOP
    UPDATE public.almoxarifado_compra_itens
    SET
      status = CASE WHEN v_item.status = 'comprou' THEN 'comprou' ELSE 'pendente' END,
      quantidade_comprada = CASE WHEN v_item.status = 'comprou' THEN COALESCE(v_item.quantidade_comprada, 0) ELSE 0 END,
      valor_unitario = CASE WHEN v_item.status = 'comprou' THEN COALESCE(v_item.valor_unitario, 0) ELSE 0 END,
      valor_total = CASE
        WHEN v_item.status = 'comprou' THEN ROUND((COALESCE(v_item.quantidade_comprada, 0) * COALESCE(v_item.valor_unitario, 0))::numeric, 2)
        ELSE 0
      END,
      mercado_fornecedor = NULLIF(btrim(COALESCE(v_item.mercado_fornecedor, '')), ''),
      observacoes = NULLIF(btrim(COALESCE(v_item.observacoes, '')), '')
    WHERE id = v_item.id
      AND compra_id = p_compra_id;
  END LOOP;

  PERFORM public.refresh_almoxarifado_compra_total(p_compra_id);

  FOR v_item IN
    SELECT
      ci.*,
      COALESCE(p.solicitante_equipe_id, i.equipe_padrao_id) AS destino_equipe_id,
      p.id AS pedido_id
    FROM public.almoxarifado_compra_itens ci
    JOIN public.almoxarifado_itens i ON i.id = ci.item_id
    LEFT JOIN public.almoxarifado_pedido_itens pi ON pi.id = ci.pedido_item_id
    LEFT JOIN public.almoxarifado_pedidos p ON p.id = pi.pedido_id
    WHERE ci.compra_id = p_compra_id
      AND ci.status = 'comprou'
      AND ci.quantidade_comprada > 0
  LOOP
    v_equipe_id := v_item.destino_equipe_id;

    SELECT *
    INTO v_saldo
    FROM public.almoxarifado_saldos
    WHERE encontro_id IS NOT DISTINCT FROM v_compra.encontro_id
      AND item_id = v_item.item_id
      AND equipe_id IS NOT DISTINCT FROM v_equipe_id
      AND marca IS NOT DISTINCT FROM NULLIF(btrim(COALESCE(v_item.marca, '')), '')
      AND fornecedor IS NULL
      AND data_validade IS NULL
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      v_anterior := v_saldo.quantidade;
      v_resultante := v_anterior + v_item.quantidade_comprada;

      UPDATE public.almoxarifado_saldos
      SET quantidade = v_resultante
      WHERE id = v_saldo.id
      RETURNING * INTO v_saldo;
    ELSE
      v_anterior := 0;
      v_resultante := v_item.quantidade_comprada;

      INSERT INTO public.almoxarifado_saldos (
        encontro_id,
        item_id,
        equipe_id,
        marca,
        fornecedor,
        quantidade,
        data_validade,
        observacoes
      )
      VALUES (
        v_compra.encontro_id,
        v_item.item_id,
        v_equipe_id,
        NULLIF(btrim(COALESCE(v_item.marca, '')), ''),
        NULL,
        v_resultante,
        NULL,
        'Entrada gerada pela finalização da compra'
      )
      RETURNING * INTO v_saldo;
    END IF;

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
      'entrada',
      v_item.quantidade_comprada,
      v_anterior,
      v_resultante,
      'Entrada automática pela compra finalizada',
      auth.uid()
    );
  END LOOP;

  UPDATE public.almoxarifado_pedidos p
  SET status = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.almoxarifado_pedido_itens pi
      WHERE pi.pedido_id = p.id
        AND pi.quantidade_a_comprar > COALESCE((
          SELECT SUM(ci.quantidade_comprada)
          FROM public.almoxarifado_compra_itens ci
          JOIN public.almoxarifado_compras c ON c.id = ci.compra_id
          WHERE ci.pedido_item_id = pi.id
            AND ci.status = 'comprou'
            AND (c.status = 'finalizada' OR c.id = p_compra_id)
        ), 0)
    ) THEN 'parcial'
    ELSE 'finalizado'
  END
  WHERE p.id IN (
    SELECT DISTINCT pi.pedido_id
    FROM public.almoxarifado_compra_itens ci
    JOIN public.almoxarifado_pedido_itens pi ON pi.id = ci.pedido_item_id
    WHERE ci.compra_id = p_compra_id
  );

  UPDATE public.almoxarifado_compras
  SET
    status = 'finalizada',
    data_compra = CURRENT_DATE,
    estoque_lancado_em = now(),
    comprovantes_urls = COALESCE(p_comprovantes_urls, '[]'::jsonb)
  WHERE id = p_compra_id
  RETURNING * INTO v_compra;

  RETURN v_compra;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_compra_almoxarifado(uuid, jsonb, jsonb) TO authenticated;

DO $$
DECLARE
  v_source public.almoxarifado_saldos;
  v_target public.almoxarifado_saldos;
BEGIN
  FOR v_source IN
    SELECT *
    FROM public.almoxarifado_saldos
    WHERE fornecedor IS NOT NULL
      AND observacoes = 'Entrada gerada pela finalização da compra'
    ORDER BY created_at
  LOOP
    SELECT *
    INTO v_target
    FROM public.almoxarifado_saldos
    WHERE id <> v_source.id
      AND encontro_id IS NOT DISTINCT FROM v_source.encontro_id
      AND item_id = v_source.item_id
      AND equipe_id IS NOT DISTINCT FROM v_source.equipe_id
      AND marca IS NOT DISTINCT FROM v_source.marca
      AND fornecedor IS NULL
      AND data_validade IS NOT DISTINCT FROM v_source.data_validade
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.almoxarifado_saldos
      SET
        quantidade = quantidade + v_source.quantidade,
        updated_at = now()
      WHERE id = v_target.id;

      UPDATE public.almoxarifado_movimentacoes
      SET saldo_id = v_target.id
      WHERE saldo_id = v_source.id;

      DELETE FROM public.almoxarifado_saldos
      WHERE id = v_source.id;
    ELSE
      UPDATE public.almoxarifado_saldos
      SET
        fornecedor = NULL,
        updated_at = now()
      WHERE id = v_source.id;
    END IF;
  END LOOP;
END;
$$;
