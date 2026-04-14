-- Migração: Cria RPC para verificação robusta de duplicidade (By-pass RLS)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS check_duplicate_registration(UUID, VARCHAR, VARCHAR, VARCHAR);
END $$;

CREATE OR REPLACE FUNCTION check_duplicate_registration(
    p_encontro_id UUID,
    p_email VARCHAR,
    p_cpf VARCHAR,
    p_telefone VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM lista_espera 
        WHERE encontro_id = p_encontro_id 
        AND (
            (p_email IS NOT NULL AND p_email != '' AND email ILIKE p_email) OR 
            (p_cpf IS NOT NULL AND p_cpf != '' AND cpf = p_cpf) OR
            (p_telefone IS NOT NULL AND p_telefone != '' AND telefone = p_telefone)
        )
    ) INTO v_exists;
    RETURN v_exists;
END;
$$;
