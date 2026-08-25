-- O link público combina encontro e equipe. Como equipes são globais, valide
-- explicitamente que há participação da equipe no encontro antes de expor
-- nomes ou permitir que uma combinação obsoleta pareça válida.
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

    IF NOT EXISTS (
        SELECT 1
        FROM public.participacoes p
        WHERE p.encontro_id = p_encontro_id
          AND p.equipe_id = p_equipe_id
    ) THEN
        RAISE EXCEPTION 'Equipe não encontrada neste encontro.';
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
    JOIN public.participacoes p
      ON p.encontro_id = e.id
     AND p.equipe_id = eq.id
    JOIN public.pessoas pe ON pe.id = p.pessoa_id
    WHERE e.id = p_encontro_id
    GROUP BY e.id, e.nome, eq.id, eq.nome;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Pesquisa não encontrada.';
    END IF;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pesquisa_satisfacao_public_info(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_satisfacao_public_info(uuid, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_pesquisa_satisfacao_public_info(uuid, uuid)
IS 'Retorna dados públicos somente para uma equipe com participantes no encontro publicado.';
