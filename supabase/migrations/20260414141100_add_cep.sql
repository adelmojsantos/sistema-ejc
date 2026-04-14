-- Adicionar coluna cep nas tabelas pessoas e lista_espera

BEGIN;

-- Tabela pessoas
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS cep VARCHAR;

-- Tabela lista_espera
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS cep VARCHAR;

COMMIT;
