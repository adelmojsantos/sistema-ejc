-- Canonical version 20260428083000: adicionar modelo_id aos tamanhos
ALTER TABLE camiseta_tamanhos 
ADD COLUMN IF NOT EXISTS modelo_id UUID REFERENCES camiseta_modelos(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_camiseta_tamanhos_modelo ON camiseta_tamanhos(modelo_id);
