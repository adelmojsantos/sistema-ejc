-- Migração: Corrige RPC para ignorar REPROVADOS na contagem de vagas
CREATE OR REPLACE FUNCTION get_public_waitlist_count(p_encontro_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT count(*)::integer
        FROM lista_espera
        WHERE encontro_id = p_encontro_id
        -- Ignorar reprovados para liberar a vaga para novos inscritos
        AND status != 'reprovado'
    );
END;
$$;
