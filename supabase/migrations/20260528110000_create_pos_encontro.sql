CREATE TABLE IF NOT EXISTS public.pos_encontros (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    ordem integer NOT NULL DEFAULT 1,
    titulo text NOT NULL,
    tema text,
    conteudo text,
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_encontro_realizacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_encontro_id uuid NOT NULL REFERENCES public.pos_encontros(id) ON DELETE CASCADE,
    circulo_id bigint NOT NULL REFERENCES public.circulos(id) ON DELETE CASCADE,
    data_realizada date,
    observacoes text,
    status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'realizado', 'cancelado')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (pos_encontro_id, circulo_id)
);

CREATE TABLE IF NOT EXISTS public.pos_encontro_presencas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    realizacao_id uuid NOT NULL REFERENCES public.pos_encontro_realizacoes(id) ON DELETE CASCADE,
    participacao_id uuid NOT NULL REFERENCES public.participacoes(id) ON DELETE CASCADE,
    presente boolean NOT NULL DEFAULT false,
    observacao text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (realizacao_id, participacao_id)
);

CREATE TABLE IF NOT EXISTS public.pos_encontro_fichas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    participacao_id uuid NOT NULL REFERENCES public.participacoes(id) ON DELETE CASCADE,
    toca_instrumento boolean NOT NULL DEFAULT false,
    instrumentos text,
    tem_carro boolean NOT NULL DEFAULT false,
    tem_moto boolean NOT NULL DEFAULT false,
    observacoes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (encontro_id, participacao_id)
);

CREATE TABLE IF NOT EXISTS public.pos_encontro_ficha_equipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ficha_id uuid NOT NULL REFERENCES public.pos_encontro_fichas(id) ON DELETE CASCADE,
    equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
    ordem_preferencia integer NOT NULL CHECK (ordem_preferencia BETWEEN 1 AND 3),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ficha_id, ordem_preferencia),
    UNIQUE (ficha_id, equipe_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_encontros_encontro
ON public.pos_encontros (encontro_id, ativo, ordem);

CREATE INDEX IF NOT EXISTS idx_pos_realizacoes_pos
ON public.pos_encontro_realizacoes (pos_encontro_id, circulo_id, status);

CREATE INDEX IF NOT EXISTS idx_pos_presencas_realizacao
ON public.pos_encontro_presencas (realizacao_id, presente);

CREATE INDEX IF NOT EXISTS idx_pos_fichas_encontro
ON public.pos_encontro_fichas (encontro_id, participacao_id);

DROP TRIGGER IF EXISTS pos_encontros_set_updated_at ON public.pos_encontros;
CREATE TRIGGER pos_encontros_set_updated_at
BEFORE UPDATE ON public.pos_encontros
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS pos_encontro_realizacoes_set_updated_at ON public.pos_encontro_realizacoes;
CREATE TRIGGER pos_encontro_realizacoes_set_updated_at
BEFORE UPDATE ON public.pos_encontro_realizacoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS pos_encontro_presencas_set_updated_at ON public.pos_encontro_presencas;
CREATE TRIGGER pos_encontro_presencas_set_updated_at
BEFORE UPDATE ON public.pos_encontro_presencas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS pos_encontro_fichas_set_updated_at ON public.pos_encontro_fichas;
CREATE TRIGGER pos_encontro_fichas_set_updated_at
BEFORE UPDATE ON public.pos_encontro_fichas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pos_encontros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_encontro_realizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_encontro_presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_encontro_fichas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_encontro_ficha_equipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_read_pos_encontros" ON public.pos_encontros;
CREATE POLICY "authenticated_can_read_pos_encontros"
ON public.pos_encontros FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "cadastros_secretaria_can_manage_pos_encontros" ON public.pos_encontros;
CREATE POLICY "cadastros_secretaria_can_manage_pos_encontros"
ON public.pos_encontros FOR ALL TO authenticated
USING (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_cadastros')
    OR public.has_permission(auth.uid(), 'modulo_secretaria')
)
WITH CHECK (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_cadastros')
    OR public.has_permission(auth.uid(), 'modulo_secretaria')
);

DROP POLICY IF EXISTS "authenticated_can_manage_pos_operacional" ON public.pos_encontro_realizacoes;
CREATE POLICY "authenticated_can_manage_pos_operacional"
ON public.pos_encontro_realizacoes FOR ALL TO authenticated
USING (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_circulos_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_circulos_mediador')
)
WITH CHECK (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_circulos_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_circulos_mediador')
);

DROP POLICY IF EXISTS "authenticated_can_manage_pos_presencas" ON public.pos_encontro_presencas;
CREATE POLICY "authenticated_can_manage_pos_presencas"
ON public.pos_encontro_presencas FOR ALL TO authenticated
USING (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_circulos_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_circulos_mediador')
)
WITH CHECK (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_circulos_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_circulos_mediador')
);

DROP POLICY IF EXISTS "authenticated_can_manage_pos_fichas" ON public.pos_encontro_fichas;
CREATE POLICY "authenticated_can_manage_pos_fichas"
ON public.pos_encontro_fichas FOR ALL TO authenticated
USING (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_circulos_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_circulos_mediador')
)
WITH CHECK (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_circulos_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_circulos_mediador')
);

DROP POLICY IF EXISTS "authenticated_can_manage_pos_ficha_equipes" ON public.pos_encontro_ficha_equipes;
CREATE POLICY "authenticated_can_manage_pos_ficha_equipes"
ON public.pos_encontro_ficha_equipes FOR ALL TO authenticated
USING (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_circulos_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_circulos_mediador')
)
WITH CHECK (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_circulos_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_circulos_mediador')
);
