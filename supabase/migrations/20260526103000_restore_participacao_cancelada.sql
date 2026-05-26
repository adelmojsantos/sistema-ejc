ALTER TABLE public.participacoes_canceladas
ADD COLUMN IF NOT EXISTS revertido_em timestamptz,
ADD COLUMN IF NOT EXISTS revertido_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS participacao_restaurada_id uuid,
ADD COLUMN IF NOT EXISTS visita_restaurada_id uuid;

DROP POLICY IF EXISTS "Coordenadores podem ver participacoes canceladas" ON public.participacoes_canceladas;

CREATE POLICY "Autorizados podem ver participacoes canceladas"
    ON public.participacoes_canceladas FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'coordenador', 'secretaria')
    ));

CREATE OR REPLACE FUNCTION public.desfazer_desistencia(cancelamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_role text;
    v_cancelamento public.participacoes_canceladas%ROWTYPE;
    v_participacao_snapshot jsonb;
    v_visita_snapshot jsonb;
    v_participacao_id uuid;
    v_visita_id uuid;
    v_existing_participacao uuid;
BEGIN
    SELECT role INTO v_profile_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_profile_role NOT IN ('admin', 'secretaria') THEN
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
        RAISE EXCEPTION 'Esta desistência já foi revertida';
    END IF;

    SELECT id
    INTO v_existing_participacao
    FROM public.participacoes
    WHERE pessoa_id = v_cancelamento.pessoa_id
      AND encontro_id = v_cancelamento.encontro_id
    LIMIT 1;

    IF v_existing_participacao IS NOT NULL THEN
        RAISE EXCEPTION 'Esta pessoa já possui participação neste encontro';
    END IF;

    v_participacao_snapshot := COALESCE(v_cancelamento.dados_snapshot -> 'participacao', '{}'::jsonb);
    v_visita_snapshot := COALESCE(v_cancelamento.dados_snapshot -> 'visita', '{}'::jsonb);
    v_participacao_id := COALESCE((v_participacao_snapshot ->> 'id')::uuid, (v_cancelamento.dados_snapshot ->> 'participacao_id')::uuid, gen_random_uuid());
    v_visita_id := COALESCE((v_visita_snapshot ->> 'id')::uuid, (v_cancelamento.dados_snapshot ->> 'visita_participacao_id')::uuid, gen_random_uuid());

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
        COALESCE((v_participacao_snapshot ->> 'data_inscricao')::timestamptz, now()),
        COALESCE((v_participacao_snapshot ->> 'participante')::boolean, true),
        NULLIF(v_participacao_snapshot ->> 'equipe_id', '')::uuid,
        COALESCE((v_participacao_snapshot ->> 'coordenador')::boolean, false),
        COALESCE((v_participacao_snapshot ->> 'dados_confirmados')::boolean, false),
        NULLIF(v_participacao_snapshot ->> 'confirmado_em', '')::timestamptz,
        COALESCE((v_participacao_snapshot ->> 'pago_taxa')::boolean, false),
        COALESCE((v_participacao_snapshot ->> 'pago_camiseta')::boolean, false),
        COALESCE(v_participacao_snapshot ->> 'origem', 'sistema'),
        v_participacao_snapshot ->> 'foto_url',
        COALESCE((v_participacao_snapshot ->> 'foto_posicao_y')::integer, 50)
    );

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
        COALESCE(NULLIF(v_visita_snapshot ->> 'grupo_id', '')::uuid, v_cancelamento.grupo_id),
        v_participacao_id,
        COALESCE((v_visita_snapshot ->> 'visitante')::boolean, false),
        'pendente',
        v_cancelamento.observacoes,
        v_visita_snapshot ->> 'foto_url',
        COALESCE((v_visita_snapshot ->> 'taxa_paga')::boolean, (v_cancelamento.dados_snapshot ->> 'taxa_paga')::boolean, false),
        NULL
    );

    UPDATE public.participacoes_canceladas
    SET revertido_em = now(),
        revertido_por = auth.uid(),
        participacao_restaurada_id = v_participacao_id,
        visita_restaurada_id = v_visita_id
    WHERE id = cancelamento_id;

    RETURN jsonb_build_object(
        'participacao_id', v_participacao_id,
        'visita_id', v_visita_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.desfazer_desistencia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.desfazer_desistencia(uuid) TO authenticated;
