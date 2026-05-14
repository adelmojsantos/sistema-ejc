-- Migration: Create participacoes_canceladas table
-- Created at: 2026-05-14

CREATE TABLE IF NOT EXISTS participacoes_canceladas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pessoa_id UUID NOT NULL REFERENCES pessoas(id),
    encontro_id UUID NOT NULL REFERENCES encontros(id),
    grupo_id UUID REFERENCES visita_grupos(id) ON DELETE SET NULL, -- ID da dupla que estava com o participante
    status_visita TEXT,
    observacoes TEXT,
    data_cancelamento TIMESTAMPTZ DEFAULT NOW(),
    cancelado_por UUID REFERENCES auth.users(id),
    dados_snapshot JSONB,
    motivo_cancelamento TEXT
);

-- Enable RLS
ALTER TABLE participacoes_canceladas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Coordenadores podem ver participacoes canceladas"
    ON participacoes_canceladas FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'coordenador')
    ));

CREATE POLICY "Usuários autenticados podem inserir participacoes canceladas"
    ON participacoes_canceladas FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_participacoes_canceladas_encontro ON participacoes_canceladas(encontro_id);
CREATE INDEX IF NOT EXISTS idx_participacoes_canceladas_pessoa ON participacoes_canceladas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_participacoes_canceladas_grupo ON participacoes_canceladas(grupo_id);
