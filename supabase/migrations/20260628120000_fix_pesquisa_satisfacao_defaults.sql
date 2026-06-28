-- Garante perguntas padrão para encontros criados depois da migration inicial
-- e impede que uma pesquisa sem perguntas ativas seja publicada.

CREATE OR REPLACE FUNCTION public.criar_perguntas_padrao_pesquisa_satisfacao(
    p_encontro_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.pesquisa_satisfacao_perguntas
        WHERE encontro_id = p_encontro_id
    ) THEN
        RETURN;
    END IF;

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
        p_encontro_id,
        q.ordem,
        q.section_id,
        q.section_title,
        q.title,
        q.type,
        q.required
    FROM (
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
    ) AS q(ordem, section_id, section_title, title, type, required);
END;
$$;

REVOKE ALL ON FUNCTION public.criar_perguntas_padrao_pesquisa_satisfacao(uuid) FROM PUBLIC;

DO $$
DECLARE
    v_encontro_id uuid;
BEGIN
    FOR v_encontro_id IN
        SELECT id FROM public.encontros
    LOOP
        PERFORM public.criar_perguntas_padrao_pesquisa_satisfacao(v_encontro_id);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.encontro_criar_perguntas_pesquisa_satisfacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.criar_perguntas_padrao_pesquisa_satisfacao(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encontro_criar_perguntas_pesquisa_satisfacao ON public.encontros;
CREATE TRIGGER encontro_criar_perguntas_pesquisa_satisfacao
AFTER INSERT ON public.encontros
FOR EACH ROW
EXECUTE FUNCTION public.encontro_criar_perguntas_pesquisa_satisfacao();

CREATE OR REPLACE FUNCTION public.validar_publicacao_pesquisa_satisfacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.publicada = true AND NOT EXISTS (
        SELECT 1
        FROM public.pesquisa_satisfacao_perguntas
        WHERE encontro_id = NEW.encontro_id
          AND active = true
    ) THEN
        RAISE EXCEPTION 'A pesquisa precisa ter ao menos uma pergunta ativa para ser publicada.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pesquisa_satisfacao_validar_publicacao ON public.pesquisa_satisfacao_config;
CREATE TRIGGER pesquisa_satisfacao_validar_publicacao
BEFORE INSERT OR UPDATE OF publicada ON public.pesquisa_satisfacao_config
FOR EACH ROW
EXECUTE FUNCTION public.validar_publicacao_pesquisa_satisfacao();
