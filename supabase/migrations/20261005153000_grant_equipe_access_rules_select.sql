-- A leitura é necessária para a tela administrativa carregar a configuração.
-- Escritas continuam restritas à função substituir_regras_acesso_equipes,
-- que valida administrador e substitui as regras de forma atômica.
GRANT SELECT ON TABLE public.equipe_acesso_regras TO authenticated;
