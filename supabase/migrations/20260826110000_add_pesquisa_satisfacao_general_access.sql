-- Disponibiliza somente as equipes vinculadas ao encontro para que o acesso
-- geral possa escolher uma equipe antes de carregar seus integrantes.
CREATE OR REPLACE FUNCTION public.get_pesquisa_satisfacao_general_info(
    p_encontro_id uuid
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
        'equipes', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object('equipe_id', equipes_encontro.id, 'nome', equipes_encontro.nome)
                ORDER BY equipes_encontro.nome
            )
            FROM (
                SELECT eq.id, eq.nome
                FROM public.participacoes p
                JOIN public.equipes eq ON eq.id = p.equipe_id
                WHERE p.encontro_id = e.id
                  AND p.equipe_id IS NOT NULL
                GROUP BY eq.id, eq.nome
            ) equipes_encontro
        ), '[]'::jsonb)
    )
    INTO v_result
    FROM public.encontros e
    WHERE e.id = p_encontro_id;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Pesquisa não encontrada.';
    END IF;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pesquisa_satisfacao_general_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_satisfacao_general_info(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_pesquisa_satisfacao_general_info(uuid)
IS 'Retorna encontro e equipes com integrantes somente quando a pesquisa estiver publicada.';
