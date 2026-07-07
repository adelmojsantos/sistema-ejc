CREATE TABLE IF NOT EXISTS public.pesquisa_encontrista_resumos_ia (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    conteudo text,
    provider text NOT NULL DEFAULT 'gemini',
    model text NOT NULL,
    prompt_version text NOT NULL DEFAULT 'pesquisa-encontristas-v1',
    total_encontristas integer NOT NULL DEFAULT 0,
    total_respostas integer NOT NULL DEFAULT 0,
    gerado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'error')),
    resultado jsonb,
    erro_mensagem text,
    finalizado_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pesquisa_encontrista_resumos_ia_encontro_created
ON public.pesquisa_encontrista_resumos_ia (encontro_id, created_at DESC);

ALTER TABLE public.pesquisa_encontrista_resumos_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_can_read_pesquisa_encontrista_resumos_ia" ON public.pesquisa_encontrista_resumos_ia;
CREATE POLICY "admin_can_read_pesquisa_encontrista_resumos_ia"
ON public.pesquisa_encontrista_resumos_ia
FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "admin_can_insert_pesquisa_encontrista_resumos_ia" ON public.pesquisa_encontrista_resumos_ia;
CREATE POLICY "admin_can_insert_pesquisa_encontrista_resumos_ia"
ON public.pesquisa_encontrista_resumos_ia
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());
