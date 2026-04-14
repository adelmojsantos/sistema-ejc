-- Migração: Cria RPC para contagem de inscritos (By-pass RLS para o público)
CREATE OR REPLACE FUNCTION get_public_waitlist_count(p_encontro_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- Garante permissão interna para contar registros privados
AS $$
BEGIN
    RETURN (
        SELECT count(*)::integer
        FROM lista_espera
        WHERE encontro_id = p_encontro_id
    );
END;
$$;
