CREATE OR REPLACE FUNCTION public.lancar_financeiro_almoxarifado_compra(p_compra_id uuid)
RETURNS public.almoxarifado_compras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra public.almoxarifado_compras;
  v_categoria_id uuid;
  v_lancamento public.financeiro_lancamentos;
BEGIN
  IF NOT public.can_operate_almoxarifado_compras() AND NOT public.can_manage_financeiro() THEN
    RAISE EXCEPTION 'Usuário sem permissão para lançar financeiro da compra.';
  END IF;

  SELECT *
  INTO v_compra
  FROM public.almoxarifado_compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra não encontrada.';
  END IF;

  IF v_compra.encontro_id IS NULL THEN
    RAISE EXCEPTION 'Compra sem encontro vinculado não pode gerar lançamento financeiro.';
  END IF;

  IF v_compra.valor_total_calculado IS NULL OR v_compra.valor_total_calculado <= 0 THEN
    RAISE EXCEPTION 'Compra sem valor calculado não pode gerar lançamento financeiro.';
  END IF;

  SELECT id
  INTO v_categoria_id
  FROM public.financeiro_categorias
  WHERE encontro_id IS NULL
    AND lower(nome) = lower('Almoxarifado / Compras')
    AND tipo = 'despesa'
  LIMIT 1;

  IF v_categoria_id IS NULL THEN
    INSERT INTO public.financeiro_categorias (nome, tipo, cor)
    VALUES ('Almoxarifado / Compras', 'despesa', '#f59e0b')
    RETURNING id INTO v_categoria_id;
  END IF;

  IF v_compra.financeiro_lancamento_id IS NOT NULL THEN
    SELECT *
    INTO v_lancamento
    FROM public.financeiro_lancamentos
    WHERE id = v_compra.financeiro_lancamento_id
      AND status = 'ativo'
    FOR UPDATE;
  END IF;

  IF v_lancamento.id IS NULL THEN
    SELECT *
    INTO v_lancamento
    FROM public.financeiro_lancamentos
    WHERE origem = 'almoxarifado_compra'
      AND origem_id = v_compra.id
      AND status = 'ativo'
    FOR UPDATE;
  END IF;

  IF v_lancamento.id IS NULL THEN
    INSERT INTO public.financeiro_lancamentos (
      encontro_id,
      categoria_id,
      tipo,
      origem,
      origem_id,
      descricao,
      valor,
      data_lancamento,
      comprovantes_urls,
      observacoes,
      criado_por_usuario_id
    )
    VALUES (
      v_compra.encontro_id,
      v_categoria_id,
      'despesa',
      'almoxarifado_compra',
      v_compra.id,
      'Compra do almoxarifado - ' || to_char(COALESCE(v_compra.data_compra, CURRENT_DATE), 'DD/MM/YYYY'),
      v_compra.valor_total_calculado,
      COALESCE(v_compra.data_compra, CURRENT_DATE),
      COALESCE(v_compra.comprovantes_urls, '[]'::jsonb),
      v_compra.observacoes,
      auth.uid()
    )
    RETURNING * INTO v_lancamento;
  ELSE
    UPDATE public.financeiro_lancamentos
    SET
      encontro_id = v_compra.encontro_id,
      categoria_id = v_categoria_id,
      tipo = 'despesa',
      origem = 'almoxarifado_compra',
      origem_id = v_compra.id,
      descricao = 'Compra do almoxarifado - ' || to_char(COALESCE(v_compra.data_compra, CURRENT_DATE), 'DD/MM/YYYY'),
      valor = v_compra.valor_total_calculado,
      data_lancamento = COALESCE(v_compra.data_compra, CURRENT_DATE),
      comprovantes_urls = COALESCE(v_compra.comprovantes_urls, '[]'::jsonb),
      observacoes = v_compra.observacoes
    WHERE id = v_lancamento.id
    RETURNING * INTO v_lancamento;
  END IF;

  UPDATE public.almoxarifado_compras
  SET
    financeiro_lancamento_id = v_lancamento.id,
    financeiro_lancado_em = COALESCE(financeiro_lancado_em, now())
  WHERE id = v_compra.id
  RETURNING * INTO v_compra;

  RETURN v_compra;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lancar_financeiro_almoxarifado_compra(uuid) TO authenticated;

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
      COALESCE(p.solicitante_equipe_id, i.equipe_padrao_id) AS destino_equipe_id
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

  SELECT *
  INTO v_compra
  FROM public.lancar_financeiro_almoxarifado_compra(p_compra_id);

  RETURN v_compra;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_compra_almoxarifado(uuid, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
