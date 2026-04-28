-- Adicionar permissão para o módulo de compras
INSERT INTO permissoes (chave, descricao)
VALUES ('modulo_compras', 'Acesso ao módulo de compras, taxas e camisetas')
ON CONFLICT (chave) DO NOTHING;
