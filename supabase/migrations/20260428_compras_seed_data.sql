-- 1. Inserir Modelos Padrão
INSERT INTO camiseta_modelos (nome, ativo)
VALUES 
('Masculina', true),
('Babylook', true)
ON CONFLICT (nome) DO NOTHING;

-- 2. Inserir Tamanhos para o Modelo Masculino
DO $$ 
DECLARE 
    v_modelo_id UUID;
BEGIN
    SELECT id INTO v_modelo_id FROM camiseta_modelos WHERE nome = 'Masculina' LIMIT 1;
    
    IF v_modelo_id IS NOT NULL THEN
        INSERT INTO camiseta_tamanhos (sigla, modelo_id, ordem) VALUES 
        ('P', v_modelo_id, 10),
        ('M', v_modelo_id, 20),
        ('G', v_modelo_id, 30),
        ('GG', v_modelo_id, 40),
        ('XG', v_modelo_id, 50),
        ('G1', v_modelo_id, 60),
        ('G2', v_modelo_id, 70),
        ('G3', v_modelo_id, 80)
        ON CONFLICT (sigla, modelo_id) DO NOTHING;
    END IF;
END $$;

-- 3. Inserir Tamanhos para o Modelo Babylook
DO $$ 
DECLARE 
    v_modelo_id UUID;
BEGIN
    SELECT id INTO v_modelo_id FROM camiseta_modelos WHERE nome = 'Babylook' LIMIT 1;
    
    IF v_modelo_id IS NOT NULL THEN
        INSERT INTO camiseta_tamanhos (sigla, modelo_id, ordem) VALUES 
        ('P', v_modelo_id, 10),
        ('M', v_modelo_id, 20),
        ('G', v_modelo_id, 30),
        ('GG', v_modelo_id, 40)
        ON CONFLICT (sigla, modelo_id) DO NOTHING;
    END IF;
END $$;
