CREATE TABLE IF NOT EXISTS public.pesquisa_satisfacao_perguntas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    ordem integer NOT NULL DEFAULT 1,
    section_id text NOT NULL,
    section_title text NOT NULL,
    title text NOT NULL,
    type text NOT NULL CHECK (type IN ('sim_nao_partes', 'texto', 'nota', 'sim_nao')),
    required boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesquisa_satisfacao_perguntas_encontro
ON public.pesquisa_satisfacao_perguntas (encontro_id, active, ordem);

CREATE TABLE IF NOT EXISTS public.pesquisa_satisfacao_config (
    encontro_id uuid PRIMARY KEY REFERENCES public.encontros(id) ON DELETE CASCADE,
    publicada boolean NOT NULL DEFAULT false,
    publicada_em timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS pesquisa_satisfacao_config_set_updated_at ON public.pesquisa_satisfacao_config;
CREATE TRIGGER pesquisa_satisfacao_config_set_updated_at
BEFORE UPDATE ON public.pesquisa_satisfacao_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS pesquisa_satisfacao_perguntas_set_updated_at ON public.pesquisa_satisfacao_perguntas;
CREATE TRIGGER pesquisa_satisfacao_perguntas_set_updated_at
BEFORE UPDATE ON public.pesquisa_satisfacao_perguntas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.pesquisa_satisfacao_perguntas (
    encontro_id,
    ordem,
    section_id,
    section_title,
    title,
    type,
    required
)
SELECT
    e.id,
    q.ordem,
    q.section_id,
    q.section_title,
    q.title,
    q.type,
    q.required
FROM public.encontros e
CROSS JOIN (
    VALUES
        (1, 'estrutura', 'Estrutura', 'A limpeza e organização atenderam às expectativas?', 'sim_nao_partes', true),
        (2, 'estrutura', 'Estrutura', 'A alimentação foi satisfatória?', 'sim_nao_partes', true),
        (3, 'estrutura', 'Estrutura', 'Os horários foram cumpridos?', 'sim_nao_partes', true),
        (4, 'organizacao', 'Organização', 'A programação foi bem planejada?', 'sim_nao_partes', true),
        (5, 'organizacao', 'Organização', 'A comunicação entre as equipes funcionou?', 'sim_nao_partes', true),
        (6, 'organizacao', 'Organização', 'Os materiais estavam disponíveis quando necessários?', 'sim_nao_partes', true),
        (7, 'organizacao', 'Organização', 'Houve boa organização dos momentos de transição?', 'sim_nao_partes', true),
        (8, 'equipe_trabalho', 'Equipe de Trabalho', 'A equipe trabalhou em unidade?', 'sim_nao_partes', true),
        (9, 'equipe_trabalho', 'Equipe de Trabalho', 'Houve comprometimento dos integrantes?', 'sim_nao_partes', true),
        (10, 'equipe_trabalho', 'Equipe de Trabalho', 'A equipe demonstrou espírito de serviço?', 'sim_nao_partes', true),
        (11, 'equipe_trabalho', 'Equipe de Trabalho', 'Os problemas foram resolvidos com rapidez?', 'sim_nao_partes', true),
        (12, 'coordenadores', 'Coordenadores', 'Os coordenadores deram o suporte necessário?', 'sim_nao_partes', true),
        (13, 'coordenadores', 'Coordenadores', 'A liderança foi clara e respeitosa?', 'sim_nao_partes', true),
        (14, 'coordenadores', 'Coordenadores', 'As funções da equipe ficaram claras?', 'sim_nao_partes', true),
        (15, 'coordenadores', 'Coordenadores', 'As decisões foram tomadas no momento certo?', 'sim_nao_partes', true),
        (16, 'coordenadores', 'Coordenadores', 'Houve abertura para ouvir sugestões?', 'sim_nao_partes', true),
        (17, 'coordenadores', 'Coordenadores', 'A coordenação transmitiu segurança durante o encontro?', 'sim_nao_partes', true),
        (18, 'espiritualidade', 'Espiritualidade', 'O clima espiritual favoreceu o encontro com Deus?', 'sim_nao_partes', true),
        (19, 'espiritualidade', 'Espiritualidade', 'Os momentos de oração foram bem conduzidos?', 'sim_nao_partes', true),
        (20, 'espiritualidade', 'Espiritualidade', 'A equipe viveu aquilo que pregou aos encontristas?', 'sim_nao_partes', true),
        (21, 'espiritualidade', 'Espiritualidade', 'O tema "Meu Coração em Tua Presença" foi percebido durante todo o encontro?', 'sim_nao_partes', true),
        (22, 'pontos_fortes', 'Pontos Fortes', 'O que mais marcou positivamente o encontro?', 'texto', true),
        (23, 'pontos_fortes', 'Pontos Fortes', 'Qual equipe merece destaque? Por quê?', 'texto', true),
        (24, 'pontos_melhoria', 'Pontos de Melhoria', 'O que precisa ser melhorado para o próximo encontro?', 'texto', true),
        (25, 'pontos_melhoria', 'Pontos de Melhoria', 'Houve alguma dificuldade que poderia ter sido evitada?', 'texto', true),
        (26, 'pontos_melhoria', 'Pontos de Melhoria', 'Que sugestões você daria?', 'texto', true),
        (27, 'avaliacao_final', 'Avaliação Final', 'Nota geral do encontro', 'nota', true),
        (28, 'avaliacao_final', 'Avaliação Final', 'Você serviria novamente na mesma equipe?', 'sim_nao', true),
        (29, 'avaliacao_final', 'Avaliação Final', 'Deixe uma mensagem', 'texto', false)
) AS q(ordem, section_id, section_title, title, type, required)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.pesquisa_satisfacao_perguntas existing
    WHERE existing.encontro_id = e.id
);

CREATE TABLE IF NOT EXISTS public.pesquisa_satisfacao_envios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
    participacao_id uuid NOT NULL REFERENCES public.participacoes(id) ON DELETE CASCADE,
    respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado')),
    enviado_em timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (encontro_id, participacao_id)
);

CREATE INDEX IF NOT EXISTS idx_pesquisa_satisfacao_envios_equipe
ON public.pesquisa_satisfacao_envios (encontro_id, equipe_id, status);

DROP TRIGGER IF EXISTS pesquisa_satisfacao_envios_set_updated_at ON public.pesquisa_satisfacao_envios;
CREATE TRIGGER pesquisa_satisfacao_envios_set_updated_at
BEFORE UPDATE ON public.pesquisa_satisfacao_envios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_usuario_da_participacao(
    check_participacao_id uuid,
    check_user uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.participacoes p
        JOIN public.pessoas pe ON pe.id = p.pessoa_id
        JOIN public.profiles pr ON lower(pr.email) = lower(pe.email)
        WHERE p.id = check_participacao_id
          AND pr.id = check_user
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_usuario_da_participacao(uuid, uuid) TO authenticated;

ALTER TABLE public.pesquisa_satisfacao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisa_satisfacao_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisa_satisfacao_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pesquisa_satisfacao_config_select" ON public.pesquisa_satisfacao_config;
CREATE POLICY "pesquisa_satisfacao_config_select"
ON public.pesquisa_satisfacao_config
FOR SELECT TO authenticated
USING (public.is_admin() OR publicada = true);

DROP POLICY IF EXISTS "pesquisa_satisfacao_config_admin_manage" ON public.pesquisa_satisfacao_config;
CREATE POLICY "pesquisa_satisfacao_config_admin_manage"
ON public.pesquisa_satisfacao_config
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "pesquisa_satisfacao_perguntas_select" ON public.pesquisa_satisfacao_perguntas;
CREATE POLICY "pesquisa_satisfacao_perguntas_select"
ON public.pesquisa_satisfacao_perguntas
FOR SELECT TO anon, authenticated
USING (
    public.is_admin()
    OR (
        active = true
        AND EXISTS (
            SELECT 1
            FROM public.pesquisa_satisfacao_config psc
            WHERE psc.encontro_id = pesquisa_satisfacao_perguntas.encontro_id
              AND psc.publicada = true
        )
    )
);

DROP POLICY IF EXISTS "pesquisa_satisfacao_perguntas_admin_manage" ON public.pesquisa_satisfacao_perguntas;
CREATE POLICY "pesquisa_satisfacao_perguntas_admin_manage"
ON public.pesquisa_satisfacao_perguntas
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "pesquisa_satisfacao_select_authenticated" ON public.pesquisa_satisfacao_envios;
CREATE POLICY "pesquisa_satisfacao_select_authenticated"
ON public.pesquisa_satisfacao_envios
FOR SELECT TO authenticated
USING (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
    OR public.is_usuario_da_participacao(participacao_id)
);

DROP POLICY IF EXISTS "pesquisa_satisfacao_insert_authenticated" ON public.pesquisa_satisfacao_envios;
CREATE POLICY "pesquisa_satisfacao_insert_authenticated"
ON public.pesquisa_satisfacao_envios
FOR INSERT TO authenticated
WITH CHECK (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
    OR public.is_usuario_da_participacao(participacao_id)
);

DROP POLICY IF EXISTS "pesquisa_satisfacao_update_authenticated" ON public.pesquisa_satisfacao_envios;
CREATE POLICY "pesquisa_satisfacao_update_authenticated"
ON public.pesquisa_satisfacao_envios
FOR UPDATE TO authenticated
USING (
    status <> 'enviado'
    AND (
        public.is_admin()
        OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
        OR public.is_usuario_da_participacao(participacao_id)
    )
)
WITH CHECK (
    (
        public.is_admin()
        OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
        OR public.is_usuario_da_participacao(participacao_id)
    )
);

CREATE OR REPLACE FUNCTION public.get_pesquisa_satisfacao_public_info(
    p_encontro_id uuid,
    p_equipe_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_publicada boolean;
BEGIN
    SELECT COALESCE(psc.publicada, false)
    INTO v_publicada
    FROM public.encontros e
    LEFT JOIN public.pesquisa_satisfacao_config psc ON psc.encontro_id = e.id
    WHERE e.id = p_encontro_id;

    IF COALESCE(v_publicada, false) = false THEN
        RAISE EXCEPTION 'Pesquisa ainda não publicada.';
    END IF;

    SELECT jsonb_build_object(
        'encontro_id', e.id,
        'encontro_nome', e.nome,
        'equipe_id', eq.id,
        'equipe_nome', eq.nome,
        'participantes', COALESCE(jsonb_agg(
            jsonb_build_object(
                'participacao_id', p.id,
                'nome', pe.nome_completo
            )
            ORDER BY pe.nome_completo
        ) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb)
    )
    INTO v_result
    FROM public.encontros e
    JOIN public.equipes eq ON eq.id = p_equipe_id
    LEFT JOIN public.participacoes p
      ON p.encontro_id = e.id
     AND p.equipe_id = eq.id
    LEFT JOIN public.pessoas pe ON pe.id = p.pessoa_id
    WHERE e.id = p_encontro_id
    GROUP BY e.id, e.nome, eq.id, eq.nome;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Pesquisa não encontrada.';
    END IF;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_pesquisa_satisfacao_acesso(
    p_encontro_id uuid,
    p_equipe_id uuid,
    p_participacao_id uuid,
    p_telefone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nome text;
    v_telefone text;
    v_digits text;
    v_envio public.pesquisa_satisfacao_envios%ROWTYPE;
    v_publicada boolean;
BEGIN
    SELECT COALESCE(psc.publicada, false)
    INTO v_publicada
    FROM public.encontros e
    LEFT JOIN public.pesquisa_satisfacao_config psc ON psc.encontro_id = e.id
    WHERE e.id = p_encontro_id;

    IF COALESCE(v_publicada, false) = false THEN
        RAISE EXCEPTION 'Pesquisa ainda não publicada.';
    END IF;

    SELECT pe.nome_completo, pe.telefone
    INTO v_nome, v_telefone
    FROM public.participacoes p
    JOIN public.pessoas pe ON pe.id = p.pessoa_id
    WHERE p.id = p_participacao_id
      AND p.encontro_id = p_encontro_id
      AND p.equipe_id = p_equipe_id;

    IF v_nome IS NULL THEN
        RAISE EXCEPTION 'Participante não encontrado nesta equipe.';
    END IF;

    v_digits := regexp_replace(COALESCE(v_telefone, ''), '[^0-9]', '', 'g');
    IF right(v_digits, 4) <> right(regexp_replace(COALESCE(p_telefone, ''), '[^0-9]', '', 'g'), 4) THEN
        RAISE EXCEPTION 'Telefone não confere.';
    END IF;

    SELECT *
    INTO v_envio
    FROM public.pesquisa_satisfacao_envios
    WHERE encontro_id = p_encontro_id
      AND participacao_id = p_participacao_id
    LIMIT 1;

    RETURN jsonb_build_object(
        'participacao_id', p_participacao_id,
        'nome', v_nome,
        'status', COALESCE(v_envio.status, 'pendente'),
        'respostas', COALESCE(v_envio.respostas, '{}'::jsonb),
        'enviado_em', v_envio.enviado_em
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_pesquisa_satisfacao_publica(
    p_encontro_id uuid,
    p_equipe_id uuid,
    p_participacao_id uuid,
    p_telefone text,
    p_respostas jsonb,
    p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_access jsonb;
    v_existing_status text;
    v_envio public.pesquisa_satisfacao_envios%ROWTYPE;
BEGIN
    IF p_status NOT IN ('rascunho', 'enviado') THEN
        RAISE EXCEPTION 'Status inválido.';
    END IF;

    v_access := public.validar_pesquisa_satisfacao_acesso(p_encontro_id, p_equipe_id, p_participacao_id, p_telefone);

    SELECT status
    INTO v_existing_status
    FROM public.pesquisa_satisfacao_envios
    WHERE encontro_id = p_encontro_id
      AND participacao_id = p_participacao_id;

    IF v_existing_status = 'enviado' THEN
        RAISE EXCEPTION 'Pesquisa já enviada. Não é possível editar.';
    END IF;

    INSERT INTO public.pesquisa_satisfacao_envios (
        encontro_id,
        equipe_id,
        participacao_id,
        respostas,
        status,
        enviado_em
    )
    VALUES (
        p_encontro_id,
        p_equipe_id,
        p_participacao_id,
        COALESCE(p_respostas, '{}'::jsonb),
        p_status,
        CASE WHEN p_status = 'enviado' THEN now() ELSE NULL END
    )
    ON CONFLICT (encontro_id, participacao_id)
    DO UPDATE SET
        respostas = EXCLUDED.respostas,
        status = EXCLUDED.status,
        enviado_em = CASE WHEN EXCLUDED.status = 'enviado' THEN now() ELSE NULL END
    WHERE public.pesquisa_satisfacao_envios.status <> 'enviado'
    RETURNING * INTO v_envio;

    IF v_envio.id IS NULL THEN
        RAISE EXCEPTION 'Pesquisa já enviada. Não é possível editar.';
    END IF;

    RETURN jsonb_build_object(
        'id', v_envio.id,
        'status', v_envio.status,
        'respostas', v_envio.respostas,
        'enviado_em', v_envio.enviado_em
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pesquisa_satisfacao_public_info(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_pesquisa_satisfacao_acesso(uuid, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_pesquisa_satisfacao_publica(uuid, uuid, uuid, text, jsonb, text) TO anon, authenticated;
