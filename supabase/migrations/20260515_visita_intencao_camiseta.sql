-- ============================================================
-- MIGRATION: Intenção de Compra de Camiseta durante Visita
-- ============================================================
-- Tabela separada dos pedidos formais de equipe.
-- Registra a INTENÇÃO expressada pelo encontrista durante a visita.
-- NÃO gera pedido formal automaticamente.
-- ============================================================

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS visita_intencao_camiseta (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    visita_id   uuid        NOT NULL REFERENCES visita_participacao(id) ON DELETE CASCADE,
    modelo_id   uuid        NOT NULL REFERENCES camiseta_modelos(id),
    tamanho     text        NOT NULL,
    quantidade  int         NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_visita_intencao_visita_id
    ON visita_intencao_camiseta(visita_id);

CREATE INDEX IF NOT EXISTS idx_visita_intencao_modelo_id
    ON visita_intencao_camiseta(modelo_id);

-- 3. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visita_intencao_updated_at
    BEFORE UPDATE ON visita_intencao_camiseta
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Habilitar RLS
ALTER TABLE visita_intencao_camiseta ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
-- Leitura: usuários autenticados podem ler
CREATE POLICY "Autenticados podem ler intenções"
    ON visita_intencao_camiseta
    FOR SELECT
    TO authenticated
    USING (true);

-- Escrita: usuários autenticados podem inserir
CREATE POLICY "Autenticados podem inserir intenções"
    ON visita_intencao_camiseta
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Atualização: usuários autenticados podem atualizar
CREATE POLICY "Autenticados podem atualizar intenções"
    ON visita_intencao_camiseta
    FOR UPDATE
    TO authenticated
    USING (true);

-- Exclusão: usuários autenticados podem excluir
CREATE POLICY "Autenticados podem excluir intenções"
    ON visita_intencao_camiseta
    FOR DELETE
    TO authenticated
    USING (true);

-- 6. Comentários na tabela e colunas
COMMENT ON TABLE visita_intencao_camiseta IS
    'Intenções de compra de camiseta registradas durante a visita ao encontrista. '
    'Não representa pedido formal — é apenas uma estimativa de demanda. '
    'Separada de camiseta_pedidos que são os pedidos oficiais das equipes.';

COMMENT ON COLUMN visita_intencao_camiseta.visita_id IS
    'Referência à visita (visita_participacao) onde a intenção foi registrada.';

COMMENT ON COLUMN visita_intencao_camiseta.modelo_id IS
    'Modelo de camiseta de interesse.';

COMMENT ON COLUMN visita_intencao_camiseta.tamanho IS
    'Tamanho desejado (sigla: PP, P, M, G, GG, etc).';

COMMENT ON COLUMN visita_intencao_camiseta.quantidade IS
    'Quantidade de camisetas desejadas (mínimo 1).';
