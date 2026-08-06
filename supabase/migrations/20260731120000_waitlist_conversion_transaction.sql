-- Converte uma inscrição online aprovada em pessoa + participação de forma atômica.
CREATE OR REPLACE FUNCTION public.aprovar_lista_espera(
    p_lista_espera_id uuid,
    p_pessoa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowed boolean;
    v_entry public.lista_espera%ROWTYPE;
    v_pessoa_id uuid := p_pessoa_id;
    v_participacao_id uuid;
BEGIN
    v_allowed := public.is_admin()
        OR public.has_permission(auth.uid(), 'modulo_admin')
        OR public.has_permission(auth.uid(), 'modulo_secretaria');

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Somente administradores ou secretaria podem aprovar inscrições online';
    END IF;

    SELECT * INTO v_entry
    FROM public.lista_espera
    WHERE id = p_lista_espera_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inscrição online não encontrada';
    END IF;

    IF v_entry.status <> 'pendente' THEN
        RAISE EXCEPTION 'Somente inscrições pendentes podem ser aprovadas';
    END IF;

    IF v_entry.encontro_id IS NULL THEN
        RAISE EXCEPTION 'A inscrição não está vinculada a um encontro';
    END IF;

    IF v_pessoa_id IS NULL THEN
        INSERT INTO public.pessoas (
            nome_completo, cpf, email, telefone, comunidade, data_nascimento,
            nome_pai, nome_mae, endereco, numero, complemento, cep, bairro,
            cidade, estado, telefone_pai, telefone_mae, outros_contatos,
            fez_ejc_outra_paroquia, qual_paroquia_ejc, origem
        ) VALUES (
            v_entry.nome_completo, v_entry.cpf, v_entry.email, v_entry.telefone,
            v_entry.comunidade, v_entry.data_nascimento, v_entry.nome_pai,
            v_entry.nome_mae, v_entry.endereco, v_entry.numero, v_entry.complemento,
            v_entry.cep, v_entry.bairro, v_entry.cidade, v_entry.estado,
            v_entry.telefone_pai, v_entry.telefone_mae, v_entry.outros_contatos,
            v_entry.fez_ejc_outra_paroquia, v_entry.qual_paroquia_ejc, 'online'
        )
        RETURNING id INTO v_pessoa_id;
    ELSE
        UPDATE public.pessoas
        SET nome_completo = v_entry.nome_completo,
            cpf = v_entry.cpf,
            email = v_entry.email,
            telefone = v_entry.telefone,
            comunidade = v_entry.comunidade,
            data_nascimento = v_entry.data_nascimento,
            nome_pai = v_entry.nome_pai,
            nome_mae = v_entry.nome_mae,
            endereco = v_entry.endereco,
            numero = v_entry.numero,
            complemento = v_entry.complemento,
            cep = v_entry.cep,
            bairro = v_entry.bairro,
            cidade = v_entry.cidade,
            estado = v_entry.estado,
            telefone_pai = v_entry.telefone_pai,
            telefone_mae = v_entry.telefone_mae,
            outros_contatos = v_entry.outros_contatos,
            fez_ejc_outra_paroquia = v_entry.fez_ejc_outra_paroquia,
            qual_paroquia_ejc = v_entry.qual_paroquia_ejc
        WHERE id = v_pessoa_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Pessoa vinculada não encontrada';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.participacoes
        WHERE pessoa_id = v_pessoa_id AND encontro_id = v_entry.encontro_id
    ) THEN
        RAISE EXCEPTION 'Esta pessoa já possui participação neste encontro';
    END IF;

    INSERT INTO public.participacoes (
        pessoa_id, encontro_id, participante, equipe_id, coordenador,
        dados_confirmados, confirmado_em, pago_taxa, origem
    ) VALUES (
        v_pessoa_id, v_entry.encontro_id, true, NULL, false,
        true, now(), false, 'online'
    )
    RETURNING id INTO v_participacao_id;

    UPDATE public.lista_espera
    SET status = 'convertido'
    WHERE id = p_lista_espera_id;

    RETURN jsonb_build_object(
        'pessoa_id', v_pessoa_id,
        'participacao_id', v_participacao_id,
        'lista_espera_id', p_lista_espera_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.aprovar_lista_espera(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprovar_lista_espera(uuid, uuid) TO authenticated;
