-- Adicionar campos de conteúdo ao Quadrante na tabela de encontros
ALTER TABLE encontros 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS simbologia_texto TEXT DEFAULT 'O Jovem no mundo, inserido em seu meio, iluminado pelo Espírito Santo, trilha os caminhos de Cristo em busca de Deus. Há nesta simbologia uma profunda mensagem bíblica. O círculo representa a terra onde vivemos, a nossa realidade temporal e, firmes, com os pés no chão, temos como tarefa reverter o processo histórico de denominação e de exploração do homem pelo homem, do irmão pelo irmão. A nossa luta por um mundo mais humano será inútil se nosso interior não estiver renovado com um novo pentecoste, se nossas ações não forem transformadas pela luz do Espírito Santo. A Cruz nos orienta a viver constantemente exemplo de Jesus Cristo que nos leva a vivenciar o “Amai-vos uns aos outros” cada vez com mais intensidade. A Cruz nos leva à verdade. Caminhando em direção a ela também tropeçando porque “somos um povo santo e pecador”. Ficamos reanimados sabendo que o nosso irmão maior, Jesus Cristo, nos antecedeu na caminhada e venceu a cruz. Finalmente, a mão para o alto vai ao encontro da mão de Deus que nos dará firmeza em nossa caminhada e nos sustentará em nossas quedas. Nossa mão ao encontro de Deus se reveste de sentido maior na medida em que, aqui na terra, somos solidários e nos sentimos fraternos dando as mãos aos nossos irmãos sem nenhuma distinção. Juntos, “Com Cristo e em Cristo”, vivemos nossa caminhada ao encontro de Deus Pai.',
ADD COLUMN IF NOT EXISTS tematica_texto TEXT,
ADD COLUMN IF NOT EXISTS musica_letra TEXT;

-- Criar tabela de palestras
CREATE TABLE IF NOT EXISTS palestras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    encontro_id UUID NOT NULL REFERENCES encontros(id) ON DELETE CASCADE,
    pessoa_id UUID REFERENCES pessoas(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    palestrante_nome TEXT,
    palestrante_foto_url TEXT,
    resumo TEXT,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativar RLS para palestras
ALTER TABLE palestras ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para palestras (mesma lógica dos encontros)
CREATE POLICY "Permitir leitura pública de palestras para encontros ativos" ON palestras
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM encontros 
            WHERE encontros.id = palestras.encontro_id 
            AND (encontros.quadrante_ativo = true OR auth.uid() IS NOT NULL)
        )
    );

CREATE POLICY "Permitir gestão de palestras para usuários autenticados" ON palestras
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Gatilho para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_palestras_updated_at
    BEFORE UPDATE ON palestras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
