-- Expose only safe Quadrante metadata for public routing.
CREATE OR REPLACE FUNCTION public.get_quadrante_public_info(p_token UUID)
RETURNS TABLE (
    nome TEXT,
    quadrante_ativo BOOLEAN,
    tem_pin BOOLEAN
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        e.nome,
        e.quadrante_ativo,
        COALESCE(NULLIF(e.quadrante_pin, ''), NULL) IS NOT NULL AS tem_pin
    FROM public.encontros e
    WHERE e.quadrante_token = p_token
      AND (e.quadrante_ativo = TRUE OR auth.uid() IS NOT NULL)
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_quadrante_public_info(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_quadrante_access(
    p_token UUID,
    p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.encontros
        WHERE quadrante_token = p_token
          AND quadrante_ativo = TRUE
          AND (
              quadrante_pin IS NULL
              OR quadrante_pin = ''
              OR quadrante_pin = p_pin
          )
    );
END;
$$;
