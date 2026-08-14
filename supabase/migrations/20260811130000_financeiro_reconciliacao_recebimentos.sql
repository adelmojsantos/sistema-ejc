-- Concilia pagamentos de taxas e camisetas com o livro-caixa.
-- Os valores esperados são sempre recalculados no servidor e preservados como snapshot.

CREATE TABLE public.financeiro_reconciliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('taxa', 'camiseta')),
  valor_esperado numeric(12, 2) NOT NULL CHECK (valor_esperado > 0),
  valor_recebido numeric(12, 2) NOT NULL CHECK (valor_recebido > 0),
  data_recebimento date NOT NULL DEFAULT CURRENT_DATE,
  justificativa text,
  comprovantes_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  financeiro_lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  criado_por_usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  cancelado_em timestamptz,
  cancelado_por_usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_reconciliacoes_diferenca_justificada_check CHECK (
    abs(valor_recebido - valor_esperado) < 0.01
    OR NULLIF(btrim(COALESCE(justificativa, '')), '') IS NOT NULL
  )
);

CREATE TABLE public.financeiro_reconciliacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliacao_id uuid NOT NULL REFERENCES public.financeiro_reconciliacoes(id) ON DELETE CASCADE,
  fonte text NOT NULL CHECK (fonte IN ('participacao_taxa', 'camiseta_pedido', 'visita_camiseta')),
  fonte_id uuid NOT NULL,
  descricao text NOT NULL,
  grupo_nome text,
  valor_esperado numeric(12, 2) NOT NULL CHECK (valor_esperado > 0),
  comprovantes_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX financeiro_reconciliacoes_encontro_idx
ON public.financeiro_reconciliacoes(encontro_id, tipo, created_at DESC);

CREATE INDEX financeiro_reconciliacao_itens_lote_idx
ON public.financeiro_reconciliacao_itens(reconciliacao_id);

CREATE UNIQUE INDEX financeiro_reconciliacao_itens_fonte_ativa_idx
ON public.financeiro_reconciliacao_itens(fonte, fonte_id)
WHERE status = 'ativo';

CREATE TRIGGER financeiro_reconciliacoes_set_updated_at
BEFORE UPDATE ON public.financeiro_reconciliacoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financeiro_reconciliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_reconciliacao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro_reconciliacoes_select"
ON public.financeiro_reconciliacoes FOR SELECT TO authenticated
USING (public.can_access_financeiro());

CREATE POLICY "financeiro_reconciliacao_itens_select"
ON public.financeiro_reconciliacao_itens FOR SELECT TO authenticated
USING (public.can_access_financeiro());

-- Escritas são permitidas exclusivamente pelas RPCs transacionais abaixo.
-- Isso impede que um cliente contorne o recálculo dos valores e a auditoria.
REVOKE INSERT, UPDATE, DELETE ON public.financeiro_reconciliacoes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.financeiro_reconciliacao_itens FROM anon, authenticated;
GRANT SELECT ON public.financeiro_reconciliacoes TO authenticated;
GRANT SELECT ON public.financeiro_reconciliacao_itens TO authenticated;

INSERT INTO public.financeiro_categorias (nome, tipo, cor)
VALUES
  ('Taxas', 'receita', '#10b981'),
  ('Camisetas', 'receita', '#6366f1')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.listar_financeiro_reconciliacao_pendencias(
  p_encontro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT public.can_access_financeiro() THEN
    RAISE EXCEPTION 'Usuário sem permissão para consultar o financeiro.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.encontros WHERE id = p_encontro_id) THEN
    RAISE EXCEPTION 'Encontro não encontrado.';
  END IF;

  WITH pendencias AS (
    SELECT
      'taxa'::text AS tipo,
      'participacao_taxa'::text AS fonte,
      p.id AS fonte_id,
      pessoa.nome_completo AS pessoa_nome,
      COALESCE(equipe.nome, dupla.nome, 'Sem agrupamento') AS grupo_nome,
      COALESCE(encontro.valor_taxa, 0)::numeric(12, 2) AS valor_esperado,
      CASE
        WHEN equipe.id IS NULL THEN '[]'::jsonb
        ELSE (
          COALESCE(confirmacao.comprovantes_taxas_urls, '[]'::jsonb)
          || CASE
            WHEN confirmacao.comprovante_taxas_url IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(confirmacao.comprovante_taxas_url)
          END
        )
      END AS comprovantes_urls,
      NULL::timestamptz AS pago_em
    FROM public.participacoes p
    JOIN public.pessoas pessoa ON pessoa.id = p.pessoa_id
    JOIN public.encontros encontro ON encontro.id = p.encontro_id
    LEFT JOIN public.equipes equipe ON equipe.id = p.equipe_id
    LEFT JOIN public.equipe_confirmacoes confirmacao
      ON confirmacao.encontro_id = p.encontro_id
     AND confirmacao.equipe_id = p.equipe_id
    LEFT JOIN LATERAL (
      SELECT grupo.nome
      FROM public.visita_participacao visita
      JOIN public.visita_grupos grupo ON grupo.id = visita.grupo_id
      WHERE visita.participacao_id = p.id
        AND visita.visitante = false
      ORDER BY visita.created_at DESC
      LIMIT 1
    ) dupla ON true
    WHERE p.encontro_id = p_encontro_id
      AND COALESCE(p.pago_taxa, false) = true
      AND COALESCE(encontro.valor_taxa, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.financeiro_reconciliacao_itens item
        WHERE item.fonte = 'participacao_taxa'
          AND item.fonte_id = p.id
          AND item.status = 'ativo'
      )

    UNION ALL

    SELECT
      'camiseta'::text,
      'camiseta_pedido'::text,
      pedido.id,
      pessoa.nome_completo,
      COALESCE(equipe.nome, 'Sem equipe'),
      (pedido.quantidade * COALESCE(config.valor, modelo.valor, 0))::numeric(12, 2),
      (
        COALESCE(confirmacao.comprovantes_camisetas_urls, '[]'::jsonb)
        || CASE
          WHEN confirmacao.comprovante_camisetas_url IS NULL THEN '[]'::jsonb
          ELSE jsonb_build_array(confirmacao.comprovante_camisetas_url)
        END
      ),
      pedido.updated_at
    FROM public.camiseta_pedidos pedido
    JOIN public.participacoes p ON p.id = pedido.participacao_id
    JOIN public.pessoas pessoa ON pessoa.id = p.pessoa_id
    JOIN public.camiseta_modelos modelo ON modelo.id = pedido.modelo_id
    LEFT JOIN public.camiseta_config_encontro config
      ON config.encontro_id = p.encontro_id
     AND config.modelo_id = pedido.modelo_id
    LEFT JOIN public.equipes equipe ON equipe.id = p.equipe_id
    LEFT JOIN public.equipe_confirmacoes confirmacao
      ON confirmacao.encontro_id = p.encontro_id
     AND confirmacao.equipe_id = p.equipe_id
    WHERE p.encontro_id = p_encontro_id
      AND p.participante IS NOT TRUE
      AND COALESCE(p.pago_camiseta, false) = true
      AND pedido.quantidade * COALESCE(config.valor, modelo.valor, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.financeiro_reconciliacao_itens item
        WHERE item.fonte = 'camiseta_pedido'
          AND item.fonte_id = pedido.id
          AND item.status = 'ativo'
      )

    UNION ALL

    SELECT
      'camiseta'::text,
      'visita_camiseta'::text,
      intencao.id,
      pessoa.nome_completo,
      COALESCE(grupo.nome, 'Sem dupla'),
      (intencao.quantidade * COALESCE(config.valor, modelo.valor, 0))::numeric(12, 2),
      CASE
        WHEN intencao.comprovante_url IS NULL THEN '[]'::jsonb
        ELSE jsonb_build_array(intencao.comprovante_url)
      END,
      intencao.pago_em
    FROM public.visita_intencao_camiseta intencao
    JOIN public.visita_participacao visita ON visita.id = intencao.visita_id
    JOIN public.participacoes p ON p.id = visita.participacao_id
    JOIN public.pessoas pessoa ON pessoa.id = p.pessoa_id
    JOIN public.camiseta_modelos modelo ON modelo.id = intencao.modelo_id
    LEFT JOIN public.camiseta_config_encontro config
      ON config.encontro_id = p.encontro_id
     AND config.modelo_id = intencao.modelo_id
    LEFT JOIN public.visita_grupos grupo ON grupo.id = visita.grupo_id
    WHERE p.encontro_id = p_encontro_id
      AND visita.visitante = false
      AND COALESCE(intencao.pago, false) = true
      AND intencao.quantidade * COALESCE(config.valor, modelo.valor, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.financeiro_reconciliacao_itens item
        WHERE item.fonte = 'visita_camiseta'
          AND item.fonte_id = intencao.id
          AND item.status = 'ativo'
      )
  ), normalizadas AS (
    SELECT
      tipo,
      fonte,
      fonte_id,
      pessoa_nome,
      grupo_nome,
      valor_esperado,
      COALESCE((
        SELECT jsonb_agg(valor ORDER BY valor)
        FROM (
          SELECT DISTINCT ref.valor
          FROM jsonb_array_elements_text(comprovantes_urls) ref(valor)
          WHERE NULLIF(btrim(ref.valor), '') IS NOT NULL
        ) refs
      ), '[]'::jsonb) AS comprovantes_urls,
      pago_em
    FROM pendencias
  )
  SELECT jsonb_build_object(
    'taxas', COALESCE(jsonb_agg(to_jsonb(normalizadas) ORDER BY grupo_nome, pessoa_nome)
      FILTER (WHERE tipo = 'taxa'), '[]'::jsonb),
    'camisetas', COALESCE(jsonb_agg(to_jsonb(normalizadas) ORDER BY grupo_nome, pessoa_nome)
      FILTER (WHERE tipo = 'camiseta'), '[]'::jsonb)
  )
  INTO v_resultado
  FROM normalizadas;

  RETURN COALESCE(v_resultado, jsonb_build_object('taxas', '[]'::jsonb, 'camisetas', '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_financeiro_reconciliacao(
  p_encontro_id uuid,
  p_tipo text,
  p_itens jsonb,
  p_valor_recebido numeric,
  p_data_recebimento date DEFAULT CURRENT_DATE,
  p_justificativa text DEFAULT NULL
)
RETURNS public.financeiro_reconciliacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reconciliacao public.financeiro_reconciliacoes;
  v_lancamento public.financeiro_lancamentos;
  v_item jsonb;
  v_fonte text;
  v_fonte_id uuid;
  v_descricao text;
  v_grupo_nome text;
  v_valor numeric(12, 2);
  v_valor_esperado numeric(12, 2) := 0;
  v_comprovantes jsonb := '[]'::jsonb;
  v_item_comprovantes jsonb;
  v_itens_resolvidos jsonb := '[]'::jsonb;
  v_chaves_resolvidas text[] := ARRAY[]::text[];
  v_categoria_id uuid;
BEGIN
  IF NOT public.can_manage_financeiro() THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar o financeiro.';
  END IF;

  IF p_tipo NOT IN ('taxa', 'camiseta') THEN
    RAISE EXCEPTION 'Tipo de reconciliação inválido.';
  END IF;

  IF p_valor_recebido IS NULL OR p_valor_recebido <= 0 THEN
    RAISE EXCEPTION 'Informe o valor efetivamente recebido.';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um pagamento para reconciliar.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.encontros WHERE id = p_encontro_id) THEN
    RAISE EXCEPTION 'Encontro não encontrado.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
  LOOP
    v_fonte := NULLIF(v_item ->> 'fonte', '');
    BEGIN
      v_fonte_id := (v_item ->> 'fonte_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Identificador de pagamento inválido.';
    END;

    v_descricao := NULL;
    v_grupo_nome := NULL;
    v_valor := NULL;
    v_item_comprovantes := '[]'::jsonb;

    IF (v_fonte || ':' || v_fonte_id::text) = ANY(v_chaves_resolvidas) THEN
      RAISE EXCEPTION 'O mesmo pagamento foi informado mais de uma vez no lote.';
    END IF;

    IF p_tipo = 'taxa' AND v_fonte = 'participacao_taxa' THEN
      SELECT
        'Taxa de ' || pessoa.nome_completo,
        COALESCE(equipe.nome, dupla.nome, 'Sem agrupamento'),
        encontro.valor_taxa::numeric(12, 2),
        CASE
          WHEN equipe.id IS NULL THEN '[]'::jsonb
          ELSE (
            COALESCE(confirmacao.comprovantes_taxas_urls, '[]'::jsonb)
            || CASE
              WHEN confirmacao.comprovante_taxas_url IS NULL THEN '[]'::jsonb
              ELSE jsonb_build_array(confirmacao.comprovante_taxas_url)
            END
          )
        END
      INTO v_descricao, v_grupo_nome, v_valor, v_item_comprovantes
      FROM public.participacoes p
      JOIN public.pessoas pessoa ON pessoa.id = p.pessoa_id
      JOIN public.encontros encontro ON encontro.id = p.encontro_id
      LEFT JOIN public.equipes equipe ON equipe.id = p.equipe_id
      LEFT JOIN public.equipe_confirmacoes confirmacao
        ON confirmacao.encontro_id = p.encontro_id
       AND confirmacao.equipe_id = p.equipe_id
      LEFT JOIN LATERAL (
        SELECT grupo.nome
        FROM public.visita_participacao visita
        JOIN public.visita_grupos grupo ON grupo.id = visita.grupo_id
        WHERE visita.participacao_id = p.id
          AND visita.visitante = false
        ORDER BY visita.created_at DESC
        LIMIT 1
      ) dupla ON true
      WHERE p.id = v_fonte_id
        AND p.encontro_id = p_encontro_id
        AND COALESCE(p.pago_taxa, false) = true
      FOR UPDATE OF p;

    ELSIF p_tipo = 'camiseta' AND v_fonte = 'camiseta_pedido' THEN
      SELECT
        'Camiseta de ' || pessoa.nome_completo,
        COALESCE(equipe.nome, 'Sem equipe'),
        (pedido.quantidade * COALESCE(config.valor, modelo.valor, 0))::numeric(12, 2),
        (
          COALESCE(confirmacao.comprovantes_camisetas_urls, '[]'::jsonb)
          || CASE
            WHEN confirmacao.comprovante_camisetas_url IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(confirmacao.comprovante_camisetas_url)
          END
        )
      INTO v_descricao, v_grupo_nome, v_valor, v_item_comprovantes
      FROM public.camiseta_pedidos pedido
      JOIN public.participacoes p ON p.id = pedido.participacao_id
      JOIN public.pessoas pessoa ON pessoa.id = p.pessoa_id
      JOIN public.camiseta_modelos modelo ON modelo.id = pedido.modelo_id
      LEFT JOIN public.camiseta_config_encontro config
        ON config.encontro_id = p.encontro_id
       AND config.modelo_id = pedido.modelo_id
      LEFT JOIN public.equipes equipe ON equipe.id = p.equipe_id
      LEFT JOIN public.equipe_confirmacoes confirmacao
        ON confirmacao.encontro_id = p.encontro_id
       AND confirmacao.equipe_id = p.equipe_id
      WHERE pedido.id = v_fonte_id
        AND p.encontro_id = p_encontro_id
        AND p.participante IS NOT TRUE
        AND COALESCE(p.pago_camiseta, false) = true
      FOR UPDATE OF pedido, p;

    ELSIF p_tipo = 'camiseta' AND v_fonte = 'visita_camiseta' THEN
      SELECT
        'Camiseta de ' || pessoa.nome_completo,
        COALESCE(grupo.nome, 'Sem dupla'),
        (intencao.quantidade * COALESCE(config.valor, modelo.valor, 0))::numeric(12, 2),
        CASE
          WHEN intencao.comprovante_url IS NULL THEN '[]'::jsonb
          ELSE jsonb_build_array(intencao.comprovante_url)
        END
      INTO v_descricao, v_grupo_nome, v_valor, v_item_comprovantes
      FROM public.visita_intencao_camiseta intencao
      JOIN public.visita_participacao visita ON visita.id = intencao.visita_id
      JOIN public.participacoes p ON p.id = visita.participacao_id
      JOIN public.pessoas pessoa ON pessoa.id = p.pessoa_id
      JOIN public.camiseta_modelos modelo ON modelo.id = intencao.modelo_id
      LEFT JOIN public.camiseta_config_encontro config
        ON config.encontro_id = p.encontro_id
       AND config.modelo_id = intencao.modelo_id
      LEFT JOIN public.visita_grupos grupo ON grupo.id = visita.grupo_id
      WHERE intencao.id = v_fonte_id
        AND p.encontro_id = p_encontro_id
        AND visita.visitante = false
        AND COALESCE(intencao.pago, false) = true
      FOR UPDATE OF intencao;
    ELSE
      RAISE EXCEPTION 'A origem do pagamento não corresponde ao tipo de reconciliação.';
    END IF;

    IF v_descricao IS NULL THEN
      RAISE EXCEPTION 'Pagamento não encontrado ou não está marcado como pago.';
    END IF;

    IF v_valor IS NULL OR v_valor <= 0 THEN
      RAISE EXCEPTION 'O pagamento % não possui valor configurado.', v_descricao;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.financeiro_reconciliacao_itens item
      WHERE item.fonte = v_fonte
        AND item.fonte_id = v_fonte_id
        AND item.status = 'ativo'
    ) THEN
      RAISE EXCEPTION 'O pagamento % já foi reconciliado.', v_descricao;
    END IF;

    v_valor_esperado := v_valor_esperado + v_valor;
    v_chaves_resolvidas := array_append(v_chaves_resolvidas, v_fonte || ':' || v_fonte_id::text);
    v_comprovantes := v_comprovantes || COALESCE(v_item_comprovantes, '[]'::jsonb);
    v_itens_resolvidos := v_itens_resolvidos || jsonb_build_array(jsonb_build_object(
      'fonte', v_fonte,
      'fonte_id', v_fonte_id,
      'descricao', v_descricao,
      'grupo_nome', v_grupo_nome,
      'valor_esperado', v_valor,
      'comprovantes_urls', COALESCE(v_item_comprovantes, '[]'::jsonb)
    ));
  END LOOP;

  SELECT COALESCE(jsonb_agg(valor ORDER BY valor), '[]'::jsonb)
  INTO v_comprovantes
  FROM (
    SELECT DISTINCT ref.valor
    FROM jsonb_array_elements_text(v_comprovantes) ref(valor)
    WHERE NULLIF(btrim(ref.valor), '') IS NOT NULL
  ) refs;

  IF abs(p_valor_recebido - v_valor_esperado) >= 0.01
     AND NULLIF(btrim(COALESCE(p_justificativa, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a justificativa para a diferença entre o valor esperado e o recebido.';
  END IF;

  SELECT id
  INTO v_categoria_id
  FROM public.financeiro_categorias
  WHERE encontro_id IS NULL
    AND lower(nome) = CASE p_tipo WHEN 'taxa' THEN 'taxas' ELSE 'camisetas' END
    AND tipo IN ('receita', 'ambos')
  ORDER BY created_at
  LIMIT 1;

  INSERT INTO public.financeiro_reconciliacoes (
    encontro_id,
    tipo,
    valor_esperado,
    valor_recebido,
    data_recebimento,
    justificativa,
    comprovantes_urls,
    criado_por_usuario_id
  ) VALUES (
    p_encontro_id,
    p_tipo,
    v_valor_esperado,
    p_valor_recebido,
    COALESCE(p_data_recebimento, CURRENT_DATE),
    NULLIF(btrim(COALESCE(p_justificativa, '')), ''),
    v_comprovantes,
    auth.uid()
  ) RETURNING * INTO v_reconciliacao;

  INSERT INTO public.financeiro_reconciliacao_itens (
    reconciliacao_id,
    fonte,
    fonte_id,
    descricao,
    grupo_nome,
    valor_esperado,
    comprovantes_urls
  )
  SELECT
    v_reconciliacao.id,
    item ->> 'fonte',
    (item ->> 'fonte_id')::uuid,
    item ->> 'descricao',
    item ->> 'grupo_nome',
    (item ->> 'valor_esperado')::numeric,
    COALESCE(item -> 'comprovantes_urls', '[]'::jsonb)
  FROM jsonb_array_elements(v_itens_resolvidos) item;

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
  ) VALUES (
    p_encontro_id,
    v_categoria_id,
    'receita',
    p_tipo,
    v_reconciliacao.id,
    CASE p_tipo WHEN 'taxa' THEN 'Recebimento de taxas' ELSE 'Recebimento de camisetas' END,
    p_valor_recebido,
    COALESCE(p_data_recebimento, CURRENT_DATE),
    v_comprovantes,
    concat_ws(E'\n',
      'Valor esperado: ' || to_char(v_valor_esperado, 'FM999999990D00'),
      CASE WHEN abs(p_valor_recebido - v_valor_esperado) >= 0.01
        THEN 'Diferença: ' || to_char(p_valor_recebido - v_valor_esperado, 'FMS999999990D00')
      END,
      NULLIF(btrim(COALESCE(p_justificativa, '')), '')
    ),
    auth.uid()
  ) RETURNING * INTO v_lancamento;

  UPDATE public.financeiro_reconciliacoes
  SET financeiro_lancamento_id = v_lancamento.id
  WHERE id = v_reconciliacao.id
  RETURNING * INTO v_reconciliacao;

  RETURN v_reconciliacao;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_financeiro_reconciliacao(
  p_reconciliacao_id uuid
)
RETURNS public.financeiro_reconciliacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reconciliacao public.financeiro_reconciliacoes;
BEGIN
  IF NOT public.can_manage_financeiro() THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar o financeiro.';
  END IF;

  SELECT *
  INTO v_reconciliacao
  FROM public.financeiro_reconciliacoes
  WHERE id = p_reconciliacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reconciliação não encontrada.';
  END IF;

  IF v_reconciliacao.status <> 'ativo' THEN
    RAISE EXCEPTION 'A reconciliação já está cancelada.';
  END IF;

  UPDATE public.financeiro_reconciliacao_itens
  SET status = 'cancelado'
  WHERE reconciliacao_id = v_reconciliacao.id
    AND status = 'ativo';

  UPDATE public.financeiro_lancamentos
  SET
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por_usuario_id = auth.uid()
  WHERE id = v_reconciliacao.financeiro_lancamento_id
    AND status = 'ativo';

  UPDATE public.financeiro_reconciliacoes
  SET
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por_usuario_id = auth.uid()
  WHERE id = v_reconciliacao.id
  RETURNING * INTO v_reconciliacao;

  RETURN v_reconciliacao;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_financeiro_reconciliacao_pendencias(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.criar_financeiro_reconciliacao(uuid, text, jsonb, numeric, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_financeiro_reconciliacao(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.listar_financeiro_reconciliacao_pendencias(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_financeiro_reconciliacao(uuid, text, jsonb, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_financeiro_reconciliacao(uuid) TO authenticated;

COMMENT ON TABLE public.financeiro_reconciliacoes IS
'Lotes auditáveis que conciliam pagamentos operacionais com entradas no livro-caixa.';

COMMENT ON TABLE public.financeiro_reconciliacao_itens IS
'Snapshot dos pagamentos incluídos em cada reconciliação, preservado mesmo após cancelamento.';

NOTIFY pgrst, 'reload schema';
