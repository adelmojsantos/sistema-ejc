-- Nomes curtos para a tela administrativa de grupos e acessos.
-- A alteração é apenas descritiva e não modifica vínculos ou regras de autorização.

ALTER TABLE public.permissoes
  ADD COLUMN IF NOT EXISTS nome text;

UPDATE public.permissoes AS permissao
SET nome = nomes.nome
FROM (
  VALUES
    ('modulo_admin', 'Administração'),
    ('modulo_almoxarifado', 'Almoxarifado'),
    ('modulo_biblioteca', 'Biblioteca'),
    ('modulo_cadastros', 'Cadastros'),
    ('modulo_circulos', 'Círculos'),
    ('modulo_circulos_cadastros', 'Círculos — Cadastros'),
    ('modulo_circulos_coordenador', 'Círculos — Coordenadores'),
    ('modulo_circulos_mediador', 'Círculos — Mediadores'),
    ('modulo_compras', 'Compras, taxas e camisetas'),
    ('modulo_coordenador', 'Minha equipe'),
    ('modulo_cuidados', 'Cuidados'),
    ('modulo_dashboard', 'Página inicial'),
    ('modulo_diagnosticos', 'Diagnósticos técnicos'),
    ('modulo_email_institucional', 'E-mail institucional'),
    ('modulo_financeiro', 'Financeiro'),
    ('modulo_inscricao', 'Inscrições'),
    ('modulo_ligacao', 'Ligação'),
    ('modulo_recepcao', 'Recepção'),
    ('modulo_recreacao', 'Recreação'),
    ('modulo_secretaria', 'Secretaria'),
    ('modulo_visitacao', 'Visitação'),
    ('modulo_visitacao_coordenar', 'Visitação — Coordenação'),
    ('modulo_visitacao_duplas', 'Visitação — Duplas'),
    ('almoxarifado_compras_operar', 'Almoxarifado — Operar compras'),
    ('almoxarifado_consultar', 'Almoxarifado — Consultar estoque'),
    ('almoxarifado_gerenciar', 'Almoxarifado — Gerenciar itens'),
    ('almoxarifado_movimentar', 'Almoxarifado — Movimentar estoque'),
    ('almoxarifado_pedidos_criar', 'Almoxarifado — Criar pedidos'),
    ('almoxarifado_pedidos_gerenciar', 'Almoxarifado — Gerenciar pedidos'),
    ('biblioteca_google_importar', 'Biblioteca — Importar de outro Drive'),
    ('email_institucional_gerenciar', 'E-mail institucional — Gerenciar'),
    ('email_institucional_responder', 'E-mail institucional — Responder'),
    ('financeiro_gerenciar', 'Financeiro — Gerenciar lançamentos')
) AS nomes(chave, nome)
WHERE permissao.chave = nomes.chave
  AND permissao.nome IS DISTINCT FROM nomes.nome;
