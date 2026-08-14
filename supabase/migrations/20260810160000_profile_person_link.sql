-- Vínculo explícito entre a identidade de autenticação e o cadastro da pessoa.
-- O e-mail permanece apenas como compatibilidade temporária e nunca resolve
-- automaticamente uma correspondência ambígua.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS pessoa_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_pessoa_id_fkey'
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_pessoa_id_fkey
            FOREIGN KEY (pessoa_id)
            REFERENCES public.pessoas(id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_pessoa_id_unique_idx
    ON public.profiles (pessoa_id)
    WHERE pessoa_id IS NOT NULL;

-- Migra somente pares 1:1 pelo e-mail normalizado. E-mails repetidos em qualquer
-- um dos lados permanecem sem vínculo para revisão administrativa.
WITH profile_candidates AS (
    SELECT
        lower(btrim(email)) AS normalized_email,
        min(id::text)::uuid AS profile_id
    FROM public.profiles
    WHERE pessoa_id IS NULL
      AND nullif(btrim(email), '') IS NOT NULL
    GROUP BY lower(btrim(email))
    HAVING count(*) = 1
),
person_candidates AS (
    SELECT
        lower(btrim(email)) AS normalized_email,
        min(id::text)::uuid AS pessoa_id
    FROM public.pessoas
    WHERE nullif(btrim(email), '') IS NOT NULL
    GROUP BY lower(btrim(email))
    HAVING count(*) = 1
)
UPDATE public.profiles profile
SET pessoa_id = person_candidates.pessoa_id,
    updated_at = now()
FROM profile_candidates
JOIN person_candidates USING (normalized_email)
WHERE profile.id = profile_candidates.profile_id
  AND profile.pessoa_id IS NULL;

CREATE OR REPLACE FUNCTION public.resolve_profile_person_id(
    check_user uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_person_id uuid;
    profile_email text;
    fallback_person_id uuid;
BEGIN
    SELECT pessoa_id, lower(btrim(email))
      INTO profile_person_id, profile_email
    FROM public.profiles
    WHERE id = check_user;

    IF profile_person_id IS NOT NULL THEN
        RETURN profile_person_id;
    END IF;

    IF nullif(profile_email, '') IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT min(id::text)::uuid
      INTO fallback_person_id
    FROM public.pessoas
    WHERE lower(btrim(email)) = profile_email
    HAVING count(*) = 1;

    RETURN fallback_person_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_profile_person_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_profile_person_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_coordenador_da_equipe(
    check_encontro_id uuid,
    check_equipe_id uuid,
    check_user uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.participacoes participation
        WHERE participation.pessoa_id = public.resolve_profile_person_id(check_user)
          AND participation.encontro_id = check_encontro_id
          AND participation.equipe_id = check_equipe_id
          AND participation.coordenador = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_coordenador_da_equipe(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_dirigente_atual(check_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.dirigencia_membros member
        JOIN public.dirigencias leadership ON leadership.id = member.dirigencia_id
        WHERE member.pessoa_id = public.resolve_profile_person_id(check_user)
          AND member.ativo = true
          AND leadership.status = 'ativa'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_dirigente_atual(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_usuario_da_participacao(
    check_participacao_id uuid,
    check_user uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.participacoes participation
        WHERE participation.id = check_participacao_id
          AND participation.pessoa_id = public.resolve_profile_person_id(check_user)
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_usuario_da_participacao(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_almoxarifado_pedido(p_pedido_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.can_manage_almoxarifado_pedidos()
    OR EXISTS (
      SELECT 1
      FROM public.almoxarifado_pedidos request
      WHERE request.id = p_pedido_id
        AND (
          request.criado_por_usuario_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.participacoes participation
            WHERE participation.equipe_id = request.solicitante_equipe_id
              AND participation.coordenador = true
              AND participation.pessoa_id = public.resolve_profile_person_id(auth.uid())
          )
        )
    );
$$;

-- As funções abaixo já existem em produção e são extensas. A migração troca
-- somente os trechos de resolução de identidade, preservando as demais regras
-- transacionais já homologadas. Cada bloco falha explicitamente se a definição
-- esperada não for encontrada, evitando uma migração parcialmente aplicada.
DO $$
DECLARE
    original_definition text;
    updated_definition text;
BEGIN
    SELECT pg_get_functiondef('public.get_my_dashboard_summary(uuid)'::regprocedure)
      INTO original_definition;
    updated_definition := replace(
        original_definition,
        'ON lower(pe.email) = lower(pr.email)',
        'ON pe.id = public.resolve_profile_person_id(pr.id)'
    );
    IF updated_definition = original_definition THEN
        RAISE EXCEPTION 'Não foi possível atualizar a identidade de get_my_dashboard_summary.';
    END IF;
    EXECUTE updated_definition;
END;
$$;

DO $$
DECLARE
    function_signature regprocedure;
    original_definition text;
    updated_definition text;
BEGIN
    FOREACH function_signature IN ARRAY ARRAY[
        'public.adicionar_membro_dirigencia(uuid,uuid)'::regprocedure,
        'public.registrar_saida_dirigente(uuid,text)'::regprocedure
    ] LOOP
        SELECT pg_get_functiondef(function_signature) INTO original_definition;
        updated_definition := replace(
            original_definition,
            'LEFT JOIN public.profiles pr ON LOWER(pr.email) = LOWER(pe.email)',
            'LEFT JOIN public.profiles pr ON pe.id = public.resolve_profile_person_id(pr.id)'
        );
        IF updated_definition = original_definition THEN
            RAISE EXCEPTION 'Não foi possível atualizar a identidade de %.', function_signature;
        END IF;
        EXECUTE updated_definition;
    END LOOP;
END;
$$;

DO $$
DECLARE
    function_signature regprocedure;
    original_definition text;
    updated_definition text;
BEGIN
    FOREACH function_signature IN ARRAY ARRAY[
        'public.cancelar_participacao(uuid,text)'::regprocedure,
        'public.restaurar_participacao_cancelada(uuid)'::regprocedure
    ] LOOP
        SELECT pg_get_functiondef(function_signature) INTO original_definition;
        updated_definition := replace(
            original_definition,
            'JOIN public.pessoas visitor_person ON lower(visitor_person.email) = lower(profile.email)',
            'JOIN public.pessoas visitor_person ON visitor_person.id = public.resolve_profile_person_id(profile.id)'
        );
        IF updated_definition = original_definition THEN
            RAISE EXCEPTION 'Não foi possível atualizar a identidade de %.', function_signature;
        END IF;
        EXECUTE updated_definition;
    END LOOP;
END;
$$;

DO $$
DECLARE
    original_definition text;
    updated_definition text;
BEGIN
    SELECT pg_get_functiondef('public.ativar_nova_dirigencia(uuid)'::regprocedure)
      INTO original_definition;

    updated_definition := replace(
        original_definition,
        'JOIN public.profiles pr ON LOWER(pr.email) = LOWER(pe.email)',
        'JOIN public.profiles pr ON pe.id = public.resolve_profile_person_id(pr.id)'
    );
    updated_definition := replace(
        updated_definition,
        'AND LOWER(pr.email) = LOWER(pe.email)',
        'AND pe.id = public.resolve_profile_person_id(pr.id)'
    );

    IF updated_definition = original_definition
       OR position('LOWER(pr.email) = LOWER(pe.email)' in updated_definition) > 0 THEN
        RAISE EXCEPTION 'Não foi possível atualizar integralmente a identidade de ativar_nova_dirigencia.';
    END IF;
    EXECUTE updated_definition;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profile_pessoa_vinculo_auditoria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pessoa_id_anterior uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
    pessoa_id_novo uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
    alterado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_pessoa_vinculo_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem consultar auditoria de vinculos" ON public.profile_pessoa_vinculo_auditoria;
CREATE POLICY "Admins podem consultar auditoria de vinculos"
    ON public.profile_pessoa_vinculo_auditoria
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.vincular_profile_pessoa(
    p_profile_id uuid,
    p_pessoa_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    previous_person_id uuid;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Apenas administradores podem vincular usuários a pessoas.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE id = p_pessoa_id) THEN
        RAISE EXCEPTION 'Pessoa não encontrada.' USING ERRCODE = 'P0002';
    END IF;

    SELECT pessoa_id
      INTO previous_person_id
    FROM public.profiles
    WHERE id = p_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil de usuário não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    IF previous_person_id IS NOT DISTINCT FROM p_pessoa_id THEN
        RETURN;
    END IF;

    UPDATE public.profiles
    SET pessoa_id = p_pessoa_id,
        updated_at = now()
    WHERE id = p_profile_id;

    INSERT INTO public.profile_pessoa_vinculo_auditoria (
        profile_id,
        pessoa_id_anterior,
        pessoa_id_novo,
        alterado_por
    ) VALUES (
        p_profile_id,
        previous_person_id,
        p_pessoa_id,
        auth.uid()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_profile_pessoa(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_profile_pessoa(uuid, uuid) TO authenticated;

COMMENT ON COLUMN public.profiles.pessoa_id IS
    'Vínculo explícito 1:1 com pessoas. E-mail não deve ser usado como chave relacional.';
COMMENT ON FUNCTION public.resolve_profile_person_id(uuid) IS
    'Retorna o vínculo explícito ou, durante a transição, um único cadastro por e-mail normalizado.';
