-- Explicita o público de cada pagamento pendente para que o financeiro
-- separe encontreiros (equipes de trabalho) de encontristas (duplas de visitação).

CREATE OR REPLACE FUNCTION public.listar_financeiro_reconciliacao_pendencias_v2(
  p_encontro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base jsonb;
  v_taxas jsonb;
  v_camisetas jsonb;
BEGIN
  v_base := public.listar_financeiro_reconciliacao_pendencias(p_encontro_id);

  SELECT COALESCE(
    jsonb_agg(
      item || jsonb_build_object(
        'publico',
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM public.participacoes participacao
            WHERE participacao.id = (item ->> 'fonte_id')::uuid
              AND participacao.participante IS TRUE
          ) THEN 'encontrista'
          ELSE 'encontreiro'
        END
      )
    ),
    '[]'::jsonb
  )
  INTO v_taxas
  FROM jsonb_array_elements(COALESCE(v_base -> 'taxas', '[]'::jsonb)) item;

  SELECT COALESCE(
    jsonb_agg(
      item || jsonb_build_object(
        'publico',
        CASE
          WHEN item ->> 'fonte' = 'visita_camiseta' THEN 'encontrista'
          ELSE 'encontreiro'
        END
      )
    ),
    '[]'::jsonb
  )
  INTO v_camisetas
  FROM jsonb_array_elements(COALESCE(v_base -> 'camisetas', '[]'::jsonb)) item;

  RETURN jsonb_build_object(
    'taxas', v_taxas,
    'camisetas', v_camisetas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.listar_financeiro_reconciliacao_pendencias_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_financeiro_reconciliacao_pendencias_v2(uuid) TO authenticated;

COMMENT ON FUNCTION public.listar_financeiro_reconciliacao_pendencias_v2(uuid)
IS 'Lista pagamentos pendentes identificando explicitamente encontreiros e encontristas.';
