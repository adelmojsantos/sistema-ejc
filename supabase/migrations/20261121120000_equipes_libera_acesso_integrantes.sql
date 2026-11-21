-- Marca as equipes cujo coordenador pode liberar, no encontro ativo, os acessos
-- configurados para os integrantes da própria equipe. O padrão desativado mantém
-- o comportamento atual: somente administradores liberam acessos.
ALTER TABLE public.equipes
    ADD COLUMN libera_acesso_integrantes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.equipes.libera_acesso_integrantes IS
    'Permite que o coordenador da equipe libere, no encontro ativo, os perfis configurados para os integrantes da própria equipe.';
