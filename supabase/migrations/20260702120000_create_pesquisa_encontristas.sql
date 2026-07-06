-- Pesquisa dos encontristas, acessada pela mesma sessão da ficha pós-encontro.

CREATE TABLE IF NOT EXISTS public.pesquisa_encontrista_perguntas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    ordem integer NOT NULL DEFAULT 1,
    section_id text NOT NULL,
    section_title text NOT NULL,
    title text NOT NULL,
    type text NOT NULL CHECK (type IN ('sim_nao_partes', 'texto', 'nota', 'sim_nao', 'sim_nao_texto')),
    required boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesquisa_encontrista_perguntas_encontro
ON public.pesquisa_encontrista_perguntas (encontro_id, active, ordem);

CREATE TABLE IF NOT EXISTS public.pesquisa_encontrista_config (
    encontro_id uuid PRIMARY KEY REFERENCES public.encontros(id) ON DELETE CASCADE,
    publicada boolean NOT NULL DEFAULT false,
    publicada_em timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pesquisa_encontrista_envios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    participacao_id uuid NOT NULL REFERENCES public.participacoes(id) ON DELETE CASCADE,
    respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado')),
    enviado_em timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (encontro_id, participacao_id)
);

CREATE INDEX IF NOT EXISTS idx_pesquisa_encontrista_envios_encontro
ON public.pesquisa_encontrista_envios (encontro_id, status);

DROP TRIGGER IF EXISTS pesquisa_encontrista_perguntas_set_updated_at ON public.pesquisa_encontrista_perguntas;
CREATE TRIGGER pesquisa_encontrista_perguntas_set_updated_at
BEFORE UPDATE ON public.pesquisa_encontrista_perguntas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS pesquisa_encontrista_config_set_updated_at ON public.pesquisa_encontrista_config;
CREATE TRIGGER pesquisa_encontrista_config_set_updated_at
BEFORE UPDATE ON public.pesquisa_encontrista_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS pesquisa_encontrista_envios_set_updated_at ON public.pesquisa_encontrista_envios;
CREATE TRIGGER pesquisa_encontrista_envios_set_updated_at
BEFORE UPDATE ON public.pesquisa_encontrista_envios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.criar_perguntas_padrao_pesquisa_encontrista(
    p_encontro_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.pesquisa_encontrista_perguntas
        WHERE encontro_id = p_encontro_id
    ) THEN
        RETURN;
    END IF;

    INSERT INTO public.pesquisa_encontrista_perguntas (
        encontro_id, ordem, section_id, section_title, title, type, required
    )
    SELECT p_encontro_id, q.ordem, q.section_id, q.section_title, q.title, q.type, true
    FROM (VALUES
        (1, 'avaliacao_geral', 'Avaliação Geral do Encontro', 'A limpeza e organização foram boas?', 'sim_nao_partes'),
        (2, 'avaliacao_geral', 'Avaliação Geral do Encontro', 'A alimentação foi satisfatória?', 'sim_nao_partes'),
        (3, 'avaliacao_geral', 'Avaliação Geral do Encontro', 'Os horários foram cumpridos?', 'sim_nao_partes'),
        (4, 'avaliacao_geral', 'Avaliação Geral do Encontro', 'O clima espiritual favoreceu o encontro com Deus?', 'sim_nao_partes'),
        (5, 'avaliacao_geral', 'Avaliação Geral do Encontro', 'Os momentos de oração foram bem conduzidos?', 'sim_nao_partes'),
        (6, 'avaliacao_geral', 'Avaliação Geral do Encontro', 'Os palestrantes conseguiram passar a mensagem que se propuseram a pregar?', 'sim_nao_partes'),
        (7, 'destaques', 'Destaques', 'O que mais marcou positivamente o encontro?', 'texto'),
        (8, 'destaques', 'Destaques', 'Qual equipe merece destaque? Por quê?', 'texto'),
        (9, 'melhorias', 'Melhorias e Sugestões', 'Tem algo que precisa ser melhorado para o próximo encontro?', 'sim_nao_texto'),
        (10, 'melhorias', 'Melhorias e Sugestões', 'Você tem alguma sugestão?', 'sim_nao_texto')
    ) AS q(ordem, section_id, section_title, title, type);
END;
$$;

REVOKE ALL ON FUNCTION public.criar_perguntas_padrao_pesquisa_encontrista(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_perguntas_padrao_pesquisa_encontrista(uuid) TO authenticated;

DO $$
DECLARE
    v_encontro_id uuid;
BEGIN
    FOR v_encontro_id IN SELECT id FROM public.encontros LOOP
        PERFORM public.criar_perguntas_padrao_pesquisa_encontrista(v_encontro_id);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.encontro_criar_perguntas_pesquisa_encontrista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.criar_perguntas_padrao_pesquisa_encontrista(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encontro_criar_perguntas_pesquisa_encontrista ON public.encontros;
CREATE TRIGGER encontro_criar_perguntas_pesquisa_encontrista
AFTER INSERT ON public.encontros
FOR EACH ROW EXECUTE FUNCTION public.encontro_criar_perguntas_pesquisa_encontrista();

CREATE OR REPLACE FUNCTION public.validar_publicacao_pesquisa_encontrista()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.publicada AND NOT EXISTS (
        SELECT 1 FROM public.pesquisa_encontrista_perguntas
        WHERE encontro_id = NEW.encontro_id AND active
    ) THEN
        RAISE EXCEPTION 'A pesquisa precisa ter ao menos uma pergunta ativa para ser publicada.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pesquisa_encontrista_validar_publicacao ON public.pesquisa_encontrista_config;
CREATE TRIGGER pesquisa_encontrista_validar_publicacao
BEFORE INSERT OR UPDATE OF publicada ON public.pesquisa_encontrista_config
FOR EACH ROW EXECUTE FUNCTION public.validar_publicacao_pesquisa_encontrista();

ALTER TABLE public.pesquisa_encontrista_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisa_encontrista_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisa_encontrista_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pesquisa_encontrista_perguntas_admin"
ON public.pesquisa_encontrista_perguntas
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "pesquisa_encontrista_config_admin"
ON public.pesquisa_encontrista_config
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "pesquisa_encontrista_envios_admin"
ON public.pesquisa_encontrista_envios
FOR SELECT TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_pesquisa_encontrista_fluxo(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sessao public.external_sessions%ROWTYPE;
    v_publicada boolean;
    v_encontro_nome text;
    v_envio public.pesquisa_encontrista_envios%ROWTYPE;
    v_perguntas jsonb;
BEGIN
    SELECT es.* INTO v_sessao
    FROM public.external_sessions es
    JOIN public.participacoes pa ON pa.id = es.participacao_id
    WHERE es.token::text = p_token
      AND es.expires_at > now()
      AND pa.participante = true
    LIMIT 1;

    IF v_sessao.id IS NULL THEN
        RAISE EXCEPTION 'Sessão inválida ou expirada.';
    END IF;

    SELECT e.nome, COALESCE(c.publicada, false)
    INTO v_encontro_nome, v_publicada
    FROM public.encontros e
    LEFT JOIN public.pesquisa_encontrista_config c ON c.encontro_id = e.id
    WHERE e.id = v_sessao.encontro_id;

    SELECT * INTO v_envio
    FROM public.pesquisa_encontrista_envios
    WHERE encontro_id = v_sessao.encontro_id
      AND participacao_id = v_sessao.participacao_id;

    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.ordem), '[]'::jsonb)
    INTO v_perguntas
    FROM public.pesquisa_encontrista_perguntas p
    WHERE p.encontro_id = v_sessao.encontro_id
      AND p.active;

    RETURN jsonb_build_object(
        'publicada', v_publicada,
        'encontro_nome', v_encontro_nome,
        'perguntas', v_perguntas,
        'status', COALESCE(v_envio.status, 'pendente'),
        'respostas', COALESCE(v_envio.respostas, '{}'::jsonb),
        'enviado_em', v_envio.enviado_em
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_pesquisa_encontrista_publica(
    p_token text,
    p_respostas jsonb,
    p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sessao public.external_sessions%ROWTYPE;
    v_envio public.pesquisa_encontrista_envios%ROWTYPE;
BEGIN
    IF p_status NOT IN ('rascunho', 'enviado') THEN
        RAISE EXCEPTION 'Status inválido.';
    END IF;

    SELECT es.* INTO v_sessao
    FROM public.external_sessions es
    JOIN public.participacoes pa ON pa.id = es.participacao_id
    WHERE es.token::text = p_token
      AND es.expires_at > now()
      AND pa.participante = true
    LIMIT 1;

    IF v_sessao.id IS NULL THEN
        RAISE EXCEPTION 'Sessão inválida ou expirada.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.pesquisa_encontrista_config
        WHERE encontro_id = v_sessao.encontro_id AND publicada
    ) THEN
        RAISE EXCEPTION 'Pesquisa ainda não publicada.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.pesquisa_encontrista_envios
        WHERE encontro_id = v_sessao.encontro_id
          AND participacao_id = v_sessao.participacao_id
          AND status = 'enviado'
    ) THEN
        RAISE EXCEPTION 'Pesquisa já enviada. Não é possível editar.';
    END IF;

    INSERT INTO public.pesquisa_encontrista_envios (
        encontro_id, participacao_id, respostas, status, enviado_em
    ) VALUES (
        v_sessao.encontro_id,
        v_sessao.participacao_id,
        COALESCE(p_respostas, '{}'::jsonb),
        p_status,
        CASE WHEN p_status = 'enviado' THEN now() ELSE NULL END
    )
    ON CONFLICT (encontro_id, participacao_id)
    DO UPDATE SET
        respostas = EXCLUDED.respostas,
        status = EXCLUDED.status,
        enviado_em = CASE WHEN EXCLUDED.status = 'enviado' THEN now() ELSE NULL END
    WHERE public.pesquisa_encontrista_envios.status <> 'enviado'
    RETURNING * INTO v_envio;

    RETURN jsonb_build_object(
        'status', v_envio.status,
        'respostas', v_envio.respostas,
        'enviado_em', v_envio.enviado_em
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_pesquisa_encontrista_fluxo(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_pesquisa_encontrista_publica(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_encontrista_fluxo(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_pesquisa_encontrista_publica(text, jsonb, text) TO anon, authenticated;
