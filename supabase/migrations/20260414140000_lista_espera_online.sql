-- Migração: Habilitando Inscrições Online via Lista de Espera Parametrizada

DO $$ 
BEGIN 
    -- 1. Tabela Encontros: Adiciona o parâmetro de limite
    BEGIN
        ALTER TABLE encontros ADD COLUMN limite_vagas_online INTEGER DEFAULT 0;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    -- 2. Tabela Pessoas: Rastreia quem foi cadastrado online
    BEGIN
        ALTER TABLE pessoas ADD COLUMN origem VARCHAR DEFAULT 'sistema';
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    -- 3. Tabela Inscrições (participacoes): Rastreia participações online
    BEGIN
        ALTER TABLE participacoes ADD COLUMN origem VARCHAR DEFAULT 'sistema';
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    -- 4. Tabela Lista de Espera: Aumenta a ficha de captura e vínculo com Encontro
    BEGIN
        ALTER TABLE lista_espera ADD COLUMN origem VARCHAR DEFAULT 'sistema';
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN encontro_id UUID REFERENCES encontros(id) ON DELETE SET NULL;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN status VARCHAR DEFAULT 'pendente';
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN cpf VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN comunidade VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN nome_pai VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN nome_mae VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN endereco VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN numero VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN bairro VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN cidade VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN telefone_pai VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN telefone_mae VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN outros_contatos VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN fez_ejc_outra_paroquia BOOLEAN DEFAULT FALSE;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE lista_espera ADD COLUMN qual_paroquia_ejc VARCHAR;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;
END $$;
