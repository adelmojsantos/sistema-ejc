-- Criar tabela de tamanhos de camisetas
CREATE TABLE IF NOT EXISTS camiseta_tamanhos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sigla TEXT NOT NULL UNIQUE,
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Inserir tamanhos padrão
INSERT INTO camiseta_tamanhos (sigla, ordem) VALUES 
('PP', 1),
('P', 2),
('M', 3),
('G', 4),
('GG', 5),
('XG', 6),
('BABY P', 7),
('BABY M', 8),
('BABY G', 9),
('INF 2', 10),
('INF 4', 11),
('INF 6', 12),
('INF 8', 13),
('INF 10', 14),
('INF 12', 15)
ON CONFLICT (sigla) DO NOTHING;
