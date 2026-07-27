CREATE OR REPLACE FUNCTION public.consolidar_saldos_automaticos_almoxarifado(
  p_check_permission boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source public.almoxarifado_saldos;
  v_target public.almoxarifado_saldos;
BEGIN
  IF p_check_permission AND NOT public.can_manage_almoxarifado() THEN
    RAISE EXCEPTION 'Usuário sem permissão para consolidar saldos do almoxarifado.';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.consolidar_saldos_automaticos_almoxarifado(boolean) TO authenticated;

SELECT public.consolidar_saldos_automaticos_almoxarifado(false);
