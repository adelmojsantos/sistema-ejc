-- 1. Create table for Team Confirmations
CREATE TABLE public.equipe_confirmacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    confirmado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    confirmado_em timestamptz NOT NULL DEFAULT now(),
    
    -- An entry per team per encounter
    UNIQUE(equipe_id, encontro_id)
);

-- 2. Triggers for updated_at (if we add it, but confirmations are usually once)
-- ALTER TABLE public.equipe_confirmacoes ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
-- CREATE TRIGGER set_updated_at_equipe_confirmacoes BEFORE UPDATE ON public.equipe_confirmacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RLS
ALTER TABLE public.equipe_confirmacoes ENABLE ROW LEVEL SECURITY;

-- Read: Everyone authenticated can read
CREATE POLICY "authenticated_can_read_confirmacoes" 
ON public.equipe_confirmacoes FOR SELECT TO authenticated USING (true);

-- Manage: Admins can do everything
CREATE POLICY "admin_can_manage_confirmacoes" 
ON public.equipe_confirmacoes FOR ALL TO authenticated 
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Coordenador can confirm their own team (if we have a way to check that in DB, but usually they do it via app)
-- Since we have the team_id in the participacao they belong to, we can restrict it.
CREATE POLICY "coordenador_can_insert_confirmacoes"
ON public.equipe_confirmacoes FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_grupos ug
        JOIN public.grupo_permissoes gp ON gp.grupo_id = ug.grupo_id
        JOIN public.permissoes p ON p.id = gp.permissao_id
        WHERE ug.usuario_id = auth.uid()
          AND p.chave = 'modulo_coordenador'
          AND ug.encontro_id = encontro_id
    )
);

-- Note: We trust the coordinator role validation handled in the profile.
