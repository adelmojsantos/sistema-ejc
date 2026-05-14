-- 1. Limpar restrições de unicidade antigas na sigla (independente do nome)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'camiseta_tamanhos'::regclass 
        AND contype = 'u' 
        AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'camiseta_tamanhos'::regclass AND attname = 'sigla')
    ) LOOP
        EXECUTE 'ALTER TABLE camiseta_tamanhos DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 2. Garantir a nova restrição composta (Sigla + Modelo)
ALTER TABLE camiseta_tamanhos DROP CONSTRAINT IF EXISTS camiseta_tamanhos_sigla_modelo_key;
ALTER TABLE camiseta_tamanhos ADD CONSTRAINT camiseta_tamanhos_sigla_modelo_key UNIQUE (sigla, modelo_id);

-- 3. Inserir/Atualizar Modelos com IDs específicos
-- Se o nome já existir com outro ID, vamos atualizar para os IDs corretos
DELETE FROM camiseta_modelos WHERE nome IN ('Masculina', 'Babylook') AND id NOT IN ('568986f1-8c8d-4069-8074-b2635d6d7ffe', '0c515b82-da2d-44d5-9535-551ce2617b73');

INSERT INTO camiseta_modelos (id, nome, ativo)
VALUES 
('568986f1-8c8d-4069-8074-b2635d6d7ffe', 'Masculina', true),
('0c515b82-da2d-44d5-9535-551ce2617b73', 'Babylook', true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- 4. Inserir Tamanhos para o Modelo Masculino
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

-- 5. Inserir Tamanhos para o Modelo Babylook
INSERT INTO camiseta_tamanhos (sigla, modelo_id, ordem) VALUES 
('P', '0c515b82-da2d-44d5-9535-551ce2617b73', 10),
('M', '0c515b82-da2d-44d5-9535-551ce2617b73', 20),
('G', '0c515b82-da2d-44d5-9535-551ce2617b73', 30),
('GG', '0c515b82-da2d-44d5-9535-551ce2617b73', 40)
ON CONFLICT (sigla, modelo_id) DO NOTHING;
