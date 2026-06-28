-- O acesso pelo QR Code é anônimo. A policy original das perguntas consultava
-- diretamente pesquisa_satisfacao_config, cuja leitura era restrita a usuários
-- autenticados. Como consequência, visitantes anônimos recebiam uma lista vazia.

CREATE OR REPLACE FUNCTION public.is_pesquisa_satisfacao_publicada(
    check_encontro_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.pesquisa_satisfacao_config
        WHERE encontro_id = check_encontro_id
          AND publicada = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_pesquisa_satisfacao_publicada(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pesquisa_satisfacao_publicada(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "pesquisa_satisfacao_perguntas_select"
ON public.pesquisa_satisfacao_perguntas;

CREATE POLICY "pesquisa_satisfacao_perguntas_select"
ON public.pesquisa_satisfacao_perguntas
FOR SELECT TO anon, authenticated
USING (
    public.is_admin()
    OR (
        active = true
        AND public.is_pesquisa_satisfacao_publicada(encontro_id)
    )
);
