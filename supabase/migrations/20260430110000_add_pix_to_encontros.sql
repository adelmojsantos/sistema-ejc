-- Remover campos antigos (caso já tenham sido criados)
ALTER TABLE encontros 
DROP COLUMN IF EXISTS pix_chave,
DROP COLUMN IF EXISTS pix_tipo,
DROP COLUMN IF EXISTS pix_qrcode_url;

-- Adicionar campos separados para Taxas e Camisetas
ALTER TABLE encontros 
ADD COLUMN pix_taxa_chave TEXT,
ADD COLUMN pix_taxa_tipo TEXT,
ADD COLUMN pix_taxa_qrcode_url TEXT,
ADD COLUMN pix_camisetas_chave TEXT,
ADD COLUMN pix_camisetas_tipo TEXT,
ADD COLUMN pix_camisetas_qrcode_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN encontros.pix_taxa_chave IS 'Chave PIX para taxas';
COMMENT ON COLUMN encontros.pix_taxa_tipo IS 'Tipo da chave PIX para taxas';
COMMENT ON COLUMN encontros.pix_taxa_qrcode_url IS 'QR Code para taxas';

COMMENT ON COLUMN encontros.pix_camisetas_chave IS 'Chave PIX para camisetas';
COMMENT ON COLUMN encontros.pix_camisetas_tipo IS 'Tipo da chave PIX para camisetas';
COMMENT ON COLUMN encontros.pix_camisetas_qrcode_url IS 'QR Code para camisetas';
