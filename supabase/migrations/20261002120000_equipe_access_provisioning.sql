-- Define quais perfis de acesso são elegíveis por equipe e função em cada encontro.
-- A configuração não concede acesso automaticamente; ela alimenta a liberação
-- administrativa explícita realizada pela Edge Function admin-users.

CREATE TABLE public.equipe_acesso_regras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
    papel text NOT NULL CHECK (papel IN ('coordenador', 'integrante')),
    grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    UNIQUE (encontro_id, equipe_id, papel, grupo_id)
);

CREATE INDEX equipe_acesso_regras_encontro_idx
    ON public.equipe_acesso_regras (encontro_id, equipe_id, papel);

ALTER TABLE public.equipe_acesso_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem consultar regras de acesso por equipe"
    ON public.equipe_acesso_regras
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem gerenciar regras de acesso por equipe"
    ON public.equipe_acesso_regras
    FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.substituir_regras_acesso_equipes(
    p_encontro_id uuid,
    p_regras jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    inserted_count integer := 0;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Somente administradores podem configurar regras de acesso.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.encontros WHERE id = p_encontro_id) THEN
        RAISE EXCEPTION 'Encontro não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    IF jsonb_typeof(COALESCE(p_regras, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'Formato de regras inválido.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(p_regras, '[]'::jsonb)) AS rule
        WHERE NULLIF(rule ->> 'papel', '') IS NULL
           OR rule ->> 'papel' NOT IN ('coordenador', 'integrante')
           OR NULLIF(rule ->> 'equipe_id', '') IS NULL
           OR NULLIF(rule ->> 'grupo_id', '') IS NULL
    ) THEN
        RAISE EXCEPTION 'Cada regra deve informar equipe, função e perfil válidos.'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(p_regras, '[]'::jsonb)) AS rule
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.participacoes participation
            WHERE participation.encontro_id = p_encontro_id
              AND participation.equipe_id = (rule ->> 'equipe_id')::uuid
        )
    ) THEN
        RAISE EXCEPTION 'A matriz contém uma equipe sem participação neste encontro.'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(p_regras, '[]'::jsonb)) AS rule
        JOIN public.grupo_permissoes group_permission
          ON group_permission.grupo_id = (rule ->> 'grupo_id')::uuid
        JOIN public.permissoes permission
          ON permission.id = group_permission.permissao_id
        WHERE permission.chave = 'modulo_admin'
    ) THEN
        RAISE EXCEPTION 'Perfis administrativos não podem ser concedidos pela matriz de equipes.'
            USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.equipe_acesso_regras
    WHERE encontro_id = p_encontro_id;

    INSERT INTO public.equipe_acesso_regras (
        encontro_id,
        equipe_id,
        papel,
        grupo_id,
        created_by
    )
    SELECT DISTINCT
        p_encontro_id,
        (rule ->> 'equipe_id')::uuid,
        rule ->> 'papel',
        (rule ->> 'grupo_id')::uuid,
        auth.uid()
    FROM jsonb_array_elements(COALESCE(p_regras, '[]'::jsonb)) AS rule
    WHERE rule ->> 'papel' IN ('coordenador', 'integrante')
      AND NULLIF(rule ->> 'equipe_id', '') IS NOT NULL
      AND NULLIF(rule ->> 'grupo_id', '') IS NOT NULL
    ON CONFLICT (encontro_id, equipe_id, papel, grupo_id) DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.substituir_regras_acesso_equipes(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.substituir_regras_acesso_equipes(uuid, jsonb) TO authenticated;

COMMENT ON TABLE public.equipe_acesso_regras IS
    'Perfis sugeridos por equipe e função para liberação administrativa no encontro.';
COMMENT ON FUNCTION public.substituir_regras_acesso_equipes(uuid, jsonb) IS
    'Substitui atomicamente a matriz de perfis elegíveis de um encontro; exige administrador.';
