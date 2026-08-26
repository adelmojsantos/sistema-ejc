-- A leitura pública não consulta a tabela diretamente porque sua policy também
-- atende administradores e depende de is_admin(), função não executável por anon.
CREATE OR REPLACE FUNCTION public.get_pesquisa_satisfacao_public_questions(
    p_encontro_id uuid
)
RETURNS TABLE (
    id uuid,
    encontro_id uuid,
    ordem integer,
    section_id text,
    section_title text,
    title text,
    type text,
    required boolean,
    active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

    RETURN QUERY
    SELECT
        pergunta.id,
        pergunta.encontro_id,
        pergunta.ordem,
        pergunta.section_id,
        pergunta.section_title,
        pergunta.title,
        pergunta.type,
        pergunta.required,
        pergunta.active
    FROM public.pesquisa_satisfacao_perguntas pergunta
    WHERE pergunta.encontro_id = p_encontro_id
      AND pergunta.active = true
    ORDER BY pergunta.ordem, pergunta.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pesquisa_satisfacao_public_questions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_satisfacao_public_questions(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_pesquisa_satisfacao_public_questions(uuid)
IS 'Retorna somente perguntas ativas de uma pesquisa de satisfação publicada.';
