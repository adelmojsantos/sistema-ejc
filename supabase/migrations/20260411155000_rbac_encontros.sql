-- 1. Alterar a tabela usuario_grupos para suportar Encontros
-- Remove a chave primária restrita
ALTER TABLE public.usuario_grupos DROP CONSTRAINT IF EXISTS usuario_grupos_pkey;

-- Adiciona ID único como nova chave primária para permitir flexibilidade
ALTER TABLE public.usuario_grupos ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() PRIMARY KEY;

-- Adiciona vínculo opcional ao Encontro (null = acesso global ilimitado)
ALTER TABLE public.usuario_grupos ADD COLUMN IF NOT EXISTS encontro_id uuid REFERENCES public.encontros(id) ON DELETE CASCADE;

-- Evita duplicatas do mesmo usuário no mesmo grupo para o mesmo encontro (usando uuid zerado como placeholder para NULL no index)
CREATE UNIQUE INDEX IF NOT EXISTS usuario_grupos_unique_idx ON public.usuario_grupos (usuario_id, grupo_id, COALESCE(encontro_id, '00000000-0000-0000-0000-000000000000'::uuid));


-- 2. Atualizar a função RLS de Checagem do Banco
-- Agora a função verifica automaticamente qual o Encontro ATUAL ATIVO e nega se a permissão do usuário for de um encontro passado.
CREATE OR REPLACE FUNCTION public.has_permission(p_usuario_id uuid, p_permissao text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tem_permissao boolean;
    v_encontro_ativo_id uuid;
BEGIN
    -- Obter qual é o encontro ativo atualmente
    SELECT id INTO v_encontro_ativo_id FROM public.encontros WHERE ativo = true LIMIT 1;

    SELECT EXISTS (
        SELECT 1
        FROM public.usuario_grupos ug
        JOIN public.grupo_permissoes gp ON gp.grupo_id = ug.grupo_id
        JOIN public.permissoes p ON p.id = gp.permissao_id
        WHERE ug.usuario_id = p_usuario_id
          AND p.chave = p_permissao
          AND (ug.encontro_id IS NULL OR ug.encontro_id = v_encontro_ativo_id)
    ) INTO v_tem_permissao;

    RETURN v_tem_permissao;
END;
$$;
