-- Adicionar campos de PIX à tabela de encontros
ALTER TABLE encontros 
ADD COLUMN pix_chave TEXT,
ADD COLUMN pix_tipo TEXT, -- 'cpf', 'cnpj', 'email', 'telefone', 'aleatoria'
ADD COLUMN pix_qrcode_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN encontros.pix_chave IS 'Chave PIX para recebimento de pagamentos do encontro';
COMMENT ON COLUMN encontros.pix_tipo IS 'Tipo da chave PIX (cpf, cnpj, email, telefone, aleatoria)';
COMMENT ON COLUMN encontros.pix_qrcode_url IS 'URL ou Storage Path da imagem do QR Code PIX';
