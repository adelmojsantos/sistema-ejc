-- 20260428_biblioteca.sql
-- Migration para criação da estrutura da Biblioteca de Arquivos (Document Library)

-- 1. Criação das Tabelas
CREATE TABLE public.biblioteca_pastas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    parent_id UUID REFERENCES public.biblioteca_pastas(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.biblioteca_arquivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_exibicao TEXT NOT NULL,
    pasta_id UUID REFERENCES public.biblioteca_pastas(id) ON DELETE RESTRICT,
    storage_path TEXT NOT NULL,
    tamanho_bytes BIGINT NOT NULL DEFAULT 0,
    tipo_mime TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Inserção da Permissão
INSERT INTO public.permissoes (chave, nome, descricao)
VALUES (
    'modulo_biblioteca', 
    'Acesso à Biblioteca', 
    'Permite acessar, enviar e gerenciar a biblioteca global de arquivos do sistema.'
) ON CONFLICT (chave) DO NOTHING;

-- 3. Criação do Bucket no Storage (Isso geralmente é feito via painel ou SQL em alguns casos)
-- Habilita storage bucket se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('biblioteca', 'biblioteca', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do Storage (permitir acesso a usuários autenticados)
CREATE POLICY "Acesso autenticado aos arquivos da biblioteca"
ON storage.objects FOR ALL
USING ( bucket_id = 'biblioteca' AND auth.role() = 'authenticated' )
WITH CHECK ( bucket_id = 'biblioteca' AND auth.role() = 'authenticated' );

-- 4. RLS e Políticas para as tabelas (Opcional se o banco for interno e confiável na camada da aplicação)
ALTER TABLE public.biblioteca_pastas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura de pastas para logados" ON public.biblioteca_pastas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir edicao de pastas para logados" ON public.biblioteca_pastas FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.biblioteca_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura de arquivos para logados" ON public.biblioteca_arquivos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir edicao de arquivos para logados" ON public.biblioteca_arquivos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

