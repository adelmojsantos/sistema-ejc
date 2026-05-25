CREATE TABLE IF NOT EXISTS public.avaliacao_perguntas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    ordem integer NOT NULL DEFAULT 0,
    titulo text NOT NULL,
    descricao text,
    tipo text NOT NULL DEFAULT 'texto_longo' CHECK (tipo IN ('texto', 'texto_longo', 'nota', 'sim_nao', 'multipla_escolha')),
    obrigatoria boolean NOT NULL DEFAULT true,
    opcoes jsonb,
    ativa boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.avaliacao_respostas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
    pergunta_id uuid NOT NULL REFERENCES public.avaliacao_perguntas(id) ON DELETE CASCADE,
    resposta_texto text,
    resposta_numero numeric,
    resposta_json jsonb,
    respondido_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (equipe_id, pergunta_id)
);

CREATE TABLE IF NOT EXISTS public.avaliacao_envios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado')),
    enviado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    enviado_em timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (encontro_id, equipe_id)
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_perguntas_encontro
ON public.avaliacao_perguntas (encontro_id, ativa, ordem);

CREATE INDEX IF NOT EXISTS idx_avaliacao_respostas_equipe_encontro
ON public.avaliacao_respostas (encontro_id, equipe_id);

CREATE INDEX IF NOT EXISTS idx_avaliacao_envios_encontro
ON public.avaliacao_envios (encontro_id, status);

DROP TRIGGER IF EXISTS avaliacao_perguntas_set_updated_at ON public.avaliacao_perguntas;
CREATE TRIGGER avaliacao_perguntas_set_updated_at
BEFORE UPDATE ON public.avaliacao_perguntas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS avaliacao_respostas_set_updated_at ON public.avaliacao_respostas;
CREATE TRIGGER avaliacao_respostas_set_updated_at
BEFORE UPDATE ON public.avaliacao_respostas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS avaliacao_envios_set_updated_at ON public.avaliacao_envios;
CREATE TRIGGER avaliacao_envios_set_updated_at
BEFORE UPDATE ON public.avaliacao_envios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
        FROM public.participacoes p
        JOIN public.pessoas pe ON pe.id = p.pessoa_id
        JOIN public.profiles pr ON lower(pr.email) = lower(pe.email)
        WHERE pr.id = check_user
          AND p.encontro_id = check_encontro_id
          AND p.equipe_id = check_equipe_id
          AND p.coordenador = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_coordenador_da_equipe(uuid, uuid, uuid) TO authenticated;

ALTER TABLE public.avaliacao_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_read_active_avaliacao_perguntas" ON public.avaliacao_perguntas;
CREATE POLICY "authenticated_can_read_active_avaliacao_perguntas"
ON public.avaliacao_perguntas
FOR SELECT TO authenticated
USING (ativa = true OR public.is_admin());

DROP POLICY IF EXISTS "admin_can_manage_avaliacao_perguntas" ON public.avaliacao_perguntas;
CREATE POLICY "admin_can_manage_avaliacao_perguntas"
ON public.avaliacao_perguntas
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "coordenador_can_read_own_avaliacao_respostas" ON public.avaliacao_respostas;
CREATE POLICY "coordenador_can_read_own_avaliacao_respostas"
ON public.avaliacao_respostas
FOR SELECT TO authenticated
USING (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
);

DROP POLICY IF EXISTS "coordenador_can_write_own_avaliacao_respostas" ON public.avaliacao_respostas;
CREATE POLICY "coordenador_can_write_own_avaliacao_respostas"
ON public.avaliacao_respostas
FOR INSERT TO authenticated
WITH CHECK (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
);

DROP POLICY IF EXISTS "coordenador_can_update_own_avaliacao_respostas" ON public.avaliacao_respostas;
CREATE POLICY "coordenador_can_update_own_avaliacao_respostas"
ON public.avaliacao_respostas
FOR UPDATE TO authenticated
USING (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
)
WITH CHECK (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
);

DROP POLICY IF EXISTS "coordenador_can_read_own_avaliacao_envios" ON public.avaliacao_envios;
CREATE POLICY "coordenador_can_read_own_avaliacao_envios"
ON public.avaliacao_envios
FOR SELECT TO authenticated
USING (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
);

DROP POLICY IF EXISTS "coordenador_can_write_own_avaliacao_envios" ON public.avaliacao_envios;
CREATE POLICY "coordenador_can_write_own_avaliacao_envios"
ON public.avaliacao_envios
FOR INSERT TO authenticated
WITH CHECK (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
);

DROP POLICY IF EXISTS "coordenador_can_update_own_avaliacao_envios" ON public.avaliacao_envios;
CREATE POLICY "coordenador_can_update_own_avaliacao_envios"
ON public.avaliacao_envios
FOR UPDATE TO authenticated
USING (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
)
WITH CHECK (
    public.is_admin()
    OR public.is_coordenador_da_equipe(encontro_id, equipe_id)
);
