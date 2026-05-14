-- Migration: Update External Form Access RPC
-- Date: 2026-04-28
-- Removes data_nascimento validation and allows flexible phone number matching

-- Drop the old function since the signature changes
DROP FUNCTION IF EXISTS public.validate_external_access(UUID, UUID, TEXT, DATE, TEXT);

-- Create new function with updated signature
CREATE OR REPLACE FUNCTION public.validate_external_access(
    p_encontro_id UUID,
    p_equipe_id UUID,
    p_nome TEXT,
    p_telefone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_participacao_id UUID;
    v_token UUID;
    v_is_active BOOLEAN;
    v_clean_telefone TEXT;
BEGIN
    -- Check if form is active
    SELECT formulario_publico_ativo INTO v_is_active 
    FROM public.encontros 
    WHERE id = p_encontro_id;

    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Formulário não está ativo para este encontro.';
    END IF;

    -- Clean the input phone (just digits)
    v_clean_telefone := regexp_replace(p_telefone, '\D', '', 'g');

    -- Search for the participant
    SELECT pa.id INTO v_participacao_id
    FROM public.participacoes pa
    JOIN public.pessoas p ON p.id = pa.pessoa_id
    WHERE pa.encontro_id = p_encontro_id
      AND pa.equipe_id = p_equipe_id
      AND unaccent(p.nome_completo) ILIKE '%' || unaccent(trim(p_nome)) || '%'
      AND right(regexp_replace(p.telefone, '\D', '', 'g'), length(v_clean_telefone)) = v_clean_telefone
    LIMIT 1;

    IF v_participacao_id IS NULL THEN
        RAISE EXCEPTION 'Não foi possível validar seus dados.';
    END IF;

    -- Create session
    INSERT INTO public.external_sessions (
        participacao_id,
        encontro_id,
        expires_at
    ) VALUES (
        v_participacao_id,
        p_encontro_id,
        now() + interval '2 hours'
    )
    RETURNING token INTO v_token;

    RETURN v_token;
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM = 'Formulário não está ativo para este encontro.' THEN
            RAISE EXCEPTION '%', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Não foi possível validar seus dados.';
        END IF;
END;
$$;
