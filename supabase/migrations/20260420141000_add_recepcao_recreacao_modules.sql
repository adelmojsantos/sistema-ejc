-- Migration to add Reception and Recreation modules/permissions
-- Following the pattern from 20260411142500_rbac_groups.sql

DO $$
BEGIN
    -- 1. Add Permissions for the new modules
    INSERT INTO public.permissoes (id, chave, descricao)
    VALUES 
        ('00000000-0000-0000-0001-000000000008', 'modulo_recepcao', 'Acesso as ferramentas de Recepção (Veículos)'),
        ('00000000-0000-0000-0001-000000000009', 'modulo_recreacao', 'Acesso as ferramentas de Recreação (Filhos)')
    ON CONFLICT (chave) DO NOTHING;

    -- 2. Add Groups for these teams
    INSERT INTO public.grupos (id, nome, descricao)
    VALUES
        ('00000000-0000-0000-0002-000000000006', 'Equipe Recepção', 'Acesso focado na gestão de veículos e recepção de participantes.'),
        ('00000000-0000-0000-0002-000000000007', 'Equipe Recreação', 'Acesso focado na gestão de crianças e atividades recreativas.')
    ON CONFLICT (nome) DO NOTHING;

    -- 3. Link Groups to their specific Permissions + Dashboard + Inscrição (base access)
    -- Reception Team
    INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
    VALUES
        ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000007'), -- Dashboard
        ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000005'), -- Inscrição
        ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000008')  -- Recepção
    ON CONFLICT DO NOTHING;

    -- Recreation Team
    INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
    VALUES
        ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000007'), -- Dashboard
        ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000005'), -- Inscrição
        ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000009')  -- Recreação
    ON CONFLICT DO NOTHING;

    -- 4. Ensure Admin has the new permissions too (Since modulo_admin normally covers all, but for UI consistency it's good to link)
    INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
    VALUES
        ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000008'),
        ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000009')
    ON CONFLICT DO NOTHING;

END $$;
