DROP POLICY IF EXISTS "Autorizados podem ver participacoes canceladas" ON public.participacoes_canceladas;

CREATE POLICY "Autorizados podem ver participacoes canceladas"
    ON public.participacoes_canceladas FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'coordenador', 'secretaria')
        )
        OR EXISTS (
            SELECT 1
            FROM public.usuario_grupos ug
            JOIN public.grupo_permissoes gp ON gp.grupo_id = ug.grupo_id
            JOIN public.permissoes pe ON pe.id = gp.permissao_id
            WHERE ug.usuario_id = auth.uid()
              AND pe.chave IN ('modulo_admin', 'modulo_secretaria', 'modulo_visitacao_coordenar')
        )
    );

CREATE OR REPLACE FUNCTION public.desfazer_desistencia(cancelamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowed boolean := false;
    v_cancelamento public.participacoes_canceladas%ROWTYPE;
    v_participacao_snapshot jsonb;
    v_visita_snapshot jsonb;
    v_participacao_id uuid;
    v_visita_id uuid;
    v_existing_participacao uuid;
    v_existing_visita uuid;
    v_grupo_id uuid;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'secretaria')
    ) OR EXISTS (
        SELECT 1
        FROM public.usuario_grupos ug
        JOIN public.grupo_permissoes gp ON gp.grupo_id = ug.grupo_id
        JOIN public.permissoes pe ON pe.id = gp.permissao_id
        WHERE ug.usuario_id = auth.uid()
          AND pe.chave IN ('modulo_admin', 'modulo_secretaria')
    )
    INTO v_allowed;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Somente administradores ou secretaria podem desfazer desistências';
    END IF;

    SELECT *
    INTO v_cancelamento
    FROM public.participacoes_canceladas
    WHERE id = cancelamento_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Desistência não encontrada';
    END IF;

    IF v_cancelamento.revertido_em IS NOT NULL THEN
        RETURN jsonb_build_object(
            'participacao_id', v_cancelamento.participacao_restaurada_id,
            'visita_id', v_cancelamento.visita_restaurada_id,
            'already_reverted', true
        );
    END IF;

    v_participacao_snapshot := COALESCE(v_cancelamento.dados_snapshot -> 'participacao', '{}'::jsonb);
    v_visita_snapshot := COALESCE(v_cancelamento.dados_snapshot -> 'visita', '{}'::jsonb);
    v_grupo_id := COALESCE(NULLIF(v_visita_snapshot ->> 'grupo_id', '')::uuid, v_cancelamento.grupo_id);

    IF v_grupo_id IS NULL THEN
        RAISE EXCEPTION 'Não foi possível identificar a dupla original desta desistência';
    END IF;

    SELECT id
    INTO v_existing_participacao
    FROM public.participacoes
    WHERE pessoa_id = v_cancelamento.pessoa_id
      AND encontro_id = v_cancelamento.encontro_id
    LIMIT 1;

    IF v_existing_participacao IS NOT NULL THEN
        v_participacao_id := v_existing_participacao;
    ELSE
        v_participacao_id := COALESCE(
            NULLIF(v_participacao_snapshot ->> 'id', '')::uuid,
            NULLIF(v_cancelamento.dados_snapshot ->> 'participacao_id', '')::uuid,
            gen_random_uuid()
        );

        IF EXISTS (SELECT 1 FROM public.participacoes WHERE id = v_participacao_id) THEN
            v_participacao_id := gen_random_uuid();
        END IF;

        INSERT INTO public.participacoes (
            id,
            pessoa_id,
            encontro_id,
            data_inscricao,
            participante,
            equipe_id,
            coordenador,
            dados_confirmados,
            confirmado_em,
            pago_taxa,
            pago_camiseta,
            origem,
            foto_url,
            foto_posicao_y
        ) VALUES (
            v_participacao_id,
            v_cancelamento.pessoa_id,
            v_cancelamento.encontro_id,
            COALESCE(NULLIF(v_participacao_snapshot ->> 'data_inscricao', '')::timestamptz, now()),
            COALESCE(NULLIF(v_participacao_snapshot ->> 'participante', '')::boolean, true),
            NULLIF(v_participacao_snapshot ->> 'equipe_id', '')::uuid,
            COALESCE(NULLIF(v_participacao_snapshot ->> 'coordenador', '')::boolean, false),
            COALESCE(NULLIF(v_participacao_snapshot ->> 'dados_confirmados', '')::boolean, false),
            NULLIF(v_participacao_snapshot ->> 'confirmado_em', '')::timestamptz,
            COALESCE(NULLIF(v_participacao_snapshot ->> 'pago_taxa', '')::boolean, false),
            COALESCE(NULLIF(v_participacao_snapshot ->> 'pago_camiseta', '')::boolean, false),
            COALESCE(NULLIF(v_participacao_snapshot ->> 'origem', ''), 'sistema'),
            NULLIF(v_participacao_snapshot ->> 'foto_url', ''),
            COALESCE(NULLIF(v_participacao_snapshot ->> 'foto_posicao_y', '')::integer, 50)
        );
    END IF;

    SELECT id
    INTO v_existing_visita
    FROM public.visita_participacao
    WHERE participacao_id = v_participacao_id
      AND visitante = false
    LIMIT 1;

    IF v_existing_visita IS NOT NULL THEN
        v_visita_id := v_existing_visita;

        UPDATE public.visita_participacao
        SET grupo_id = v_grupo_id,
            status = 'pendente',
            observacoes = COALESCE(v_cancelamento.observacoes, observacoes),
            taxa_paga = COALESCE(NULLIF(v_visita_snapshot ->> 'taxa_paga', '')::boolean, NULLIF(v_cancelamento.dados_snapshot ->> 'taxa_paga', '')::boolean, taxa_paga),
            data_visita = NULL
        WHERE id = v_existing_visita;
    ELSE
        v_visita_id := COALESCE(
            NULLIF(v_visita_snapshot ->> 'id', '')::uuid,
            NULLIF(v_cancelamento.dados_snapshot ->> 'visita_participacao_id', '')::uuid,
            gen_random_uuid()
        );

        IF EXISTS (SELECT 1 FROM public.visita_participacao WHERE id = v_visita_id) THEN
            v_visita_id := gen_random_uuid();
        END IF;

        INSERT INTO public.visita_participacao (
            id,
            grupo_id,
            participacao_id,
            visitante,
            status,
            observacoes,
            foto_url,
            taxa_paga,
            data_visita
        ) VALUES (
            v_visita_id,
            v_grupo_id,
            v_participacao_id,
            false,
            'pendente',
            v_cancelamento.observacoes,
            NULLIF(v_visita_snapshot ->> 'foto_url', ''),
            COALESCE(NULLIF(v_visita_snapshot ->> 'taxa_paga', '')::boolean, NULLIF(v_cancelamento.dados_snapshot ->> 'taxa_paga', '')::boolean, false),
            NULL
        );
    END IF;

    UPDATE public.participacoes_canceladas
    SET revertido_em = now(),
        revertido_por = auth.uid(),
        participacao_restaurada_id = v_participacao_id,
        visita_restaurada_id = v_visita_id
    WHERE id = cancelamento_id;

    RETURN jsonb_build_object(
        'participacao_id', v_participacao_id,
        'visita_id', v_visita_id,
        'already_had_participacao', v_existing_participacao IS NOT NULL,
        'already_had_visita', v_existing_visita IS NOT NULL
    );
END;
$$;

REVOKE ALL ON FUNCTION public.desfazer_desistencia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.desfazer_desistencia(uuid) TO authenticated;
