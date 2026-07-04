-- O link público usa uma sessão externa, não uma sessão do Supabase Auth.
-- As funções abaixo validam o token no banco e mantêm as tabelas protegidas
-- contra acesso anônimo direto.

CREATE OR REPLACE FUNCTION public.get_pos_encontro_ficha_publica(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sessao public.external_sessions%ROWTYPE;
    v_ficha jsonb;
BEGIN
    SELECT es.* INTO v_sessao
    FROM public.external_sessions es
    JOIN public.participacoes pa
      ON pa.id = es.participacao_id
     AND pa.encontro_id = es.encontro_id
    WHERE es.token::text = p_token
      AND es.expires_at > now()
      AND pa.participante = true
    LIMIT 1;

    IF v_sessao.id IS NULL THEN
        RAISE EXCEPTION 'Sessão inválida ou expirada.';
    END IF;

    SELECT to_jsonb(f) || jsonb_build_object(
        'pos_encontro_ficha_equipes',
        COALESCE((
            SELECT jsonb_agg(
                to_jsonb(fe) || jsonb_build_object(
                    'equipes', jsonb_build_object('nome', e.nome)
                )
                ORDER BY fe.ordem_preferencia
            )
            FROM public.pos_encontro_ficha_equipes fe
            JOIN public.equipes e ON e.id = fe.equipe_id
            WHERE fe.ficha_id = f.id
        ), '[]'::jsonb)
    )
    INTO v_ficha
    FROM public.pos_encontro_fichas f
    WHERE f.encontro_id = v_sessao.encontro_id
      AND f.participacao_id = v_sessao.participacao_id;

    RETURN v_ficha;
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_pos_encontro_ficha_publica(
    p_token text,
    p_toca_instrumento boolean,
    p_instrumentos text,
    p_tem_carro boolean,
    p_tem_moto boolean,
    p_observacoes text,
    p_equipe_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sessao public.external_sessions%ROWTYPE;
    v_ficha_id uuid;
    v_equipes_validas integer;
BEGIN
    SELECT es.* INTO v_sessao
    FROM public.external_sessions es
    JOIN public.participacoes pa
      ON pa.id = es.participacao_id
     AND pa.encontro_id = es.encontro_id
    WHERE es.token::text = p_token
      AND es.expires_at > now()
      AND pa.participante = true
    LIMIT 1;

    IF v_sessao.id IS NULL THEN
        RAISE EXCEPTION 'Sessão inválida ou expirada.';
    END IF;

    IF COALESCE(cardinality(p_equipe_ids), 0) <> 3 THEN
        RAISE EXCEPTION 'Selecione exatamente três equipes.';
    END IF;

    SELECT count(DISTINCT e.id)
    INTO v_equipes_validas
    FROM unnest(p_equipe_ids) equipe_id
    JOIN public.equipes e
      ON e.id = equipe_id
     AND e.deleted_at IS NULL
     AND e.aparece_pos_encontro = true;

    IF v_equipes_validas <> 3 THEN
        RAISE EXCEPTION 'As equipes selecionadas são inválidas ou estão repetidas.';
    END IF;

    INSERT INTO public.pos_encontro_fichas (
        encontro_id,
        participacao_id,
        toca_instrumento,
        instrumentos,
        tem_carro,
        tem_moto,
        observacoes
    )
    VALUES (
        v_sessao.encontro_id,
        v_sessao.participacao_id,
        COALESCE(p_toca_instrumento, false),
        CASE WHEN COALESCE(p_toca_instrumento, false) THEN NULLIF(trim(p_instrumentos), '') ELSE NULL END,
        COALESCE(p_tem_carro, false),
        COALESCE(p_tem_moto, false),
        NULLIF(trim(p_observacoes), '')
    )
    ON CONFLICT (encontro_id, participacao_id)
    DO UPDATE SET
        toca_instrumento = EXCLUDED.toca_instrumento,
        instrumentos = EXCLUDED.instrumentos,
        tem_carro = EXCLUDED.tem_carro,
        tem_moto = EXCLUDED.tem_moto,
        observacoes = EXCLUDED.observacoes
    RETURNING id INTO v_ficha_id;

    DELETE FROM public.pos_encontro_ficha_equipes
    WHERE ficha_id = v_ficha_id;

    INSERT INTO public.pos_encontro_ficha_equipes (
        ficha_id,
        equipe_id,
        ordem_preferencia
    )
    SELECT
        v_ficha_id,
        preferencia.equipe_id,
        preferencia.ordem::integer
    FROM unnest(p_equipe_ids) WITH ORDINALITY
        AS preferencia(equipe_id, ordem);

    RETURN public.get_pos_encontro_ficha_publica(p_token);
END;
$$;

REVOKE ALL ON FUNCTION public.get_pos_encontro_ficha_publica(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_pos_encontro_ficha_publica(
    text, boolean, text, boolean, boolean, text, uuid[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_pos_encontro_ficha_publica(text)
TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_pos_encontro_ficha_publica(
    text, boolean, text, boolean, boolean, text, uuid[]
) TO anon, authenticated;
