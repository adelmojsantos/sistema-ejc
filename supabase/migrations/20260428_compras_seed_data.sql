-- 1. Inserir Modelos Padrão com IDs específicos
INSERT INTO camiseta_modelos (id, nome, ativo)
VALUES 
('568986f1-8c8d-4069-8074-b2635d6d7ffe', 'Masculina', true),
('0c515b82-da2d-44d5-9535-551ce2617b73', 'Babylook', true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- 2. Inserir Tamanhos para o Modelo Masculino (568986f1...)
INSERT INTO camiseta_tamanhos (sigla, modelo_id, ordem) VALUES 
('P', '568986f1-8c8d-4069-8074-b2635d6d7ffe', 10),
('M', '568986f1-8c8d-4069-8074-b2635d6d7ffe', 20),
('G', '568986f1-8c8d-4069-8074-b2635d6d7ffe', 30),
('GG', '568986f1-8c8d-4069-8074-b2635d6d7ffe', 40),
('XG', '568986f1-8c8d-4069-8074-b2635d6d7ffe', 50),
('G1', '568986f1-8c8d-4069-8074-b2635d6d7ffe', 60),
('G2', '568986f1-8c8d-4069-8074-b2635d6d7ffe', 70),
('G3', '568986f1-8c8d-4069-8074-b2635d6d7ffe', 80)
ON CONFLICT (sigla, modelo_id) DO NOTHING;

-- 3. Inserir Tamanhos para o Modelo Babylook (0c515b82...)
INSERT INTO camiseta_tamanhos (sigla, modelo_id, ordem) VALUES 
('P', '0c515b82-da2d-44d5-9535-551ce2617b73', 10),
('M', '0c515b82-da2d-44d5-9535-551ce2617b73', 20),
('G', '0c515b82-da2d-44d5-9535-551ce2617b73', 30),
('GG', '0c515b82-da2d-44d5-9535-551ce2617b73', 40)
ON CONFLICT (sigla, modelo_id) DO NOTHING;
