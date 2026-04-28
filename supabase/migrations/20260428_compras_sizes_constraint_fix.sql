-- Ajustar restrição de unicidade para permitir a mesma sigla em modelos diferentes
ALTER TABLE camiseta_tamanhos DROP CONSTRAINT IF EXISTS camiseta_tamanhos_sigla_key;

-- Criar nova restrição composta (Sigla + Modelo)
-- Nota: Isso permite que 'P' exista para 'Masculina' e para 'Babylook' simultaneamente
ALTER TABLE camiseta_tamanhos ADD CONSTRAINT camiseta_tamanhos_sigla_modelo_key UNIQUE (sigla, modelo_id);
