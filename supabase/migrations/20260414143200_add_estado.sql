-- Migração: Adiciona campo estado
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE pessoas ADD COLUMN estado VARCHAR(2) DEFAULT 'SP';
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN estado VARCHAR(2) DEFAULT 'SP';
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;
END $$;

UPDATE pessoas SET estado = 'SP' WHERE estado IS NULL;
UPDATE lista_espera SET estado = 'SP' WHERE estado IS NULL;
