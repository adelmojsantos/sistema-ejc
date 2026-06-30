-- Evolui o resumo Markdown legado para um relatório estruturado, retomável e
-- processado em pequenos lotes. Os registros antigos continuam consultáveis.
ALTER TABLE public.avaliacao_resumos_ia
    ALTER COLUMN conteudo DROP NOT NULL;

ALTER TABLE public.avaliacao_resumos_ia
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS resultado jsonb,
    ADD COLUMN IF NOT EXISTS erro_mensagem text,
    ADD COLUMN IF NOT EXISTS iniciado_em timestamptz,
    ADD COLUMN IF NOT EXISTS finalizado_em timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_perguntas integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS perguntas_concluidas integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS consolidando boolean NOT NULL DEFAULT false;

UPDATE public.avaliacao_resumos_ia
SET status = 'completed',
    iniciado_em = COALESCE(iniciado_em, created_at),
    finalizado_em = COALESCE(finalizado_em, created_at),
    updated_at = COALESCE(updated_at, created_at)
WHERE conteudo IS NOT NULL
  AND resultado IS NULL;

ALTER TABLE public.avaliacao_resumos_ia
    DROP CONSTRAINT IF EXISTS avaliacao_resumos_ia_status_check;
ALTER TABLE public.avaliacao_resumos_ia
    ADD CONSTRAINT avaliacao_resumos_ia_status_check
    CHECK (status IN ('pending', 'generating', 'completed', 'error'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_avaliacao_resumo_ia_ativo
ON public.avaliacao_resumos_ia (encontro_id)
WHERE status IN ('pending', 'generating');

DROP TRIGGER IF EXISTS avaliacao_resumos_ia_set_updated_at
ON public.avaliacao_resumos_ia;
CREATE TRIGGER avaliacao_resumos_ia_set_updated_at
BEFORE UPDATE ON public.avaliacao_resumos_ia
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.avaliacao_resumo_ia_secoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    relatorio_id uuid NOT NULL
        REFERENCES public.avaliacao_resumos_ia(id) ON DELETE CASCADE,
    pergunta_id uuid
        REFERENCES public.pesquisa_satisfacao_perguntas(id) ON DELETE SET NULL,
    pergunta_ordem integer NOT NULL,
    pergunta_secao text NOT NULL,
    pergunta_titulo text NOT NULL,
    pergunta_tipo text NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'generating', 'completed', 'error')),
    etapa text NOT NULL DEFAULT 'batches'
        CHECK (etapa IN ('batches', 'consolidating', 'completed')),
    total_respostas integer NOT NULL DEFAULT 0,
    respostas_processadas integer NOT NULL DEFAULT 0,
    resultados_parciais jsonb NOT NULL DEFAULT '[]'::jsonb,
    resultado jsonb,
    erro_mensagem text,
    tentativas integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (relatorio_id, pergunta_id)
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_resumo_ia_secoes_fila
ON public.avaliacao_resumo_ia_secoes (relatorio_id, status, pergunta_ordem);

DROP TRIGGER IF EXISTS avaliacao_resumo_ia_secoes_set_updated_at
ON public.avaliacao_resumo_ia_secoes;
CREATE TRIGGER avaliacao_resumo_ia_secoes_set_updated_at
BEFORE UPDATE ON public.avaliacao_resumo_ia_secoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.avaliacao_resumo_ia_secoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_can_read_avaliacao_resumo_ia_secoes"
ON public.avaliacao_resumo_ia_secoes;
CREATE POLICY "admin_can_read_avaliacao_resumo_ia_secoes"
ON public.avaliacao_resumo_ia_secoes
FOR SELECT TO authenticated
USING (public.is_admin());

-- Faz a reserva atômica de uma pergunta. SKIP LOCKED evita que duas
-- invocações processem o mesmo lote em caso de clique duplo/repetição de rede.
CREATE OR REPLACE FUNCTION public.claim_avaliacao_resumo_ia_secao(
    p_relatorio_id uuid
)
RETURNS SETOF public.avaliacao_resumo_ia_secoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_secao public.avaliacao_resumo_ia_secoes%ROWTYPE;
BEGIN
    UPDATE public.avaliacao_resumo_ia_secoes
    SET status = 'pending',
        erro_mensagem = 'Etapa retomada após interrupção do processamento.'
    WHERE relatorio_id = p_relatorio_id
      AND status = 'generating'
      AND updated_at < now() - interval '10 minutes';

    SELECT *
    INTO v_secao
    FROM public.avaliacao_resumo_ia_secoes
    WHERE relatorio_id = p_relatorio_id
      AND status = 'pending'
    ORDER BY pergunta_ordem
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.avaliacao_resumo_ia_secoes
    SET status = 'generating',
        tentativas = tentativas + 1,
        erro_mensagem = NULL
    WHERE id = v_secao.id
    RETURNING * INTO v_secao;

    RETURN NEXT v_secao;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_avaliacao_resumo_ia_secao(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_avaliacao_resumo_ia_secao(uuid)
TO service_role;
