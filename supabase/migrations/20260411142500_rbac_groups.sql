-- 1. Create tables for RBAC (Role-Based Access Control)
CREATE TABLE public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grupo_permissoes (
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE CASCADE,
  permissao_id uuid REFERENCES public.permissoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, permissao_id)
);

CREATE TABLE public.usuario_grupos (
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, grupo_id)
);

-- 2. Triggers for updated_at
CREATE TRIGGER grupos_set_updated_at
BEFORE UPDATE ON public.grupos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER permissoes_set_updated_at
BEFORE UPDATE ON public.permissoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Initial Data Insertion
-- Insert default Permissions
INSERT INTO public.permissoes (id, chave, descricao) VALUES
  ('00000000-0000-0000-0001-000000000001', 'modulo_admin', 'Acesso as telas de Administração (Usuários e Configurações)'),
  ('00000000-0000-0000-0001-000000000002', 'modulo_secretaria', 'Acesso a relatórios e ferramentas da Secretaria'),
  ('00000000-0000-0000-0001-000000000003', 'modulo_visitacao', 'Acesso às ferramentas da Visitação'),
  ('00000000-0000-0000-0001-000000000004', 'modulo_cadastros', 'Acesso a página de Cadastros (Encontros, Equipes, Círculos, etc)'),
  ('00000000-0000-0000-0001-000000000005', 'modulo_inscricao', 'Acesso para Inscrições no EJC'),
  ('00000000-0000-0000-0001-000000000006', 'modulo_coordenador', 'Acesso as informações restritas a coordenadores (Menu Minha Equipe)'),
  ('00000000-0000-0000-0001-000000000007', 'modulo_dashboard', 'Acesso à página inícial (Dashboard)');

-- Insert default Groups
INSERT INTO public.grupos (id, nome, descricao) VALUES
  ('00000000-0000-0000-0002-000000000001', 'Administrador', 'Acesso irrestrito a todos os Módulos do Sistema.'),
  ('00000000-0000-0000-0002-000000000002', 'Secretaria', 'Acesso voltado a gestão de pessoas, pastas e configurações gerais.'),
  ('00000000-0000-0000-0002-000000000003', 'Equipe Visitação', 'Acesso com foco nas listagens e ações de Visitação aos Jovens.'),
  ('00000000-0000-0000-0002-000000000004', 'Coordenadores de Pasta', 'Acesso à visão de Minha Equipe e Mínimo da Secretaria.'),
  ('00000000-0000-0000-0002-000000000005', 'Visualizador Padrão', 'Acesso apenas relatórios públicos e Inscrições.');

-- Bind Group x Permissions
-- Admin Gets ALL
INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '00000000-0000-0000-0002-000000000001', id FROM public.permissoes;

-- Secretaria Gets Dashboard, Secretaria, Cadastros, Inscricao
INSERT INTO public.grupo_permissoes (grupo_id, permissao_id) VALUES
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000007'), -- Dashboard
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000002'), -- Secretaria
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000004'), -- Cadastros
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000005'); -- Inscricao

-- Visitacao Gets Dashboard, Visitação, Inscricao
INSERT INTO public.grupo_permissoes (grupo_id, permissao_id) VALUES
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000007'), -- Dashboard
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000003'), -- Visitacao
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000005'); -- Inscricao

-- Coordenador Gets Dashboard, Coordenador, Inscricao
INSERT INTO public.grupo_permissoes (grupo_id, permissao_id) VALUES
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000007'), -- Dashboard
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000006'), -- Coordenador
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000005'); -- Inscricao

-- Visualizador Gets Inscricao
INSERT INTO public.grupo_permissoes (grupo_id, permissao_id) VALUES
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000005'); -- Inscricao

-- 4. Migrate Existing Profiles to New Groups Concept
INSERT INTO public.usuario_grupos (usuario_id, grupo_id)
SELECT id, '00000000-0000-0000-0002-000000000001' FROM public.profiles WHERE role = 'admin';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id)
SELECT id, '00000000-0000-0000-0002-000000000002' FROM public.profiles WHERE role = 'secretaria';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id)
SELECT id, '00000000-0000-0000-0002-000000000003' FROM public.profiles WHERE role = 'visitacao';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id)
SELECT id, '00000000-0000-0000-0002-000000000004' FROM public.profiles WHERE role = 'coordenador';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id)
SELECT id, '00000000-0000-0000-0002-000000000005' FROM public.profiles WHERE role = 'viewer';

-- 5. RLS
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_grupos ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read groups, permissions to load their ui properly
CREATE POLICY "authenticated_can_read_grupos" ON public.grupos FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_can_read_permissoes" ON public.permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_can_read_grupo_permissoes" ON public.grupo_permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_can_read_usuario_grupos" ON public.usuario_grupos FOR SELECT TO authenticated USING (true);

-- Admin can manage everything
CREATE POLICY "admin_can_manage_grupos" ON public.grupos FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_can_manage_permissoes" ON public.permissoes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_can_manage_grupo_permissoes" ON public.grupo_permissoes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_can_manage_usuario_grupos" ON public.usuario_grupos FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Optional check functions for DB level RLS if they need permissions internally (Like is_admin())
CREATE OR REPLACE FUNCTION public.has_permission(check_user uuid, permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_grupos ug
    JOIN public.grupo_permissoes gp ON ug.grupo_id = gp.grupo_id
    JOIN public.permissoes p ON gp.permissao_id = p.id
    WHERE ug.usuario_id = check_user
      AND p.chave = permission_key
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
