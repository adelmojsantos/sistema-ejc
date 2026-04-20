-- Create recreacao_dados table
CREATE TABLE IF NOT EXISTS public.recreacao_dados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participacao_id UUID NOT NULL REFERENCES public.participacoes(id) ON DELETE CASCADE,
    nome_crianca TEXT NOT NULL,
    idade INTEGER NOT NULL,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Upgrade logic for existing installations
DO $$ 
BEGIN 
    -- Change outro_responsavel from text to UUID FK if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recreacao_dados' AND column_name='outro_responsavel') THEN
        ALTER TABLE public.recreacao_dados DROP COLUMN outro_responsavel;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recreacao_dados' AND column_name='outro_responsavel_id') THEN
        ALTER TABLE public.recreacao_dados ADD COLUMN outro_responsavel_id UUID REFERENCES public.participacoes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.recreacao_dados ENABLE ROW LEVEL SECURITY;

-- Indices
CREATE INDEX IF NOT EXISTS idx_recreacao_participacao ON public.recreacao_dados(participacao_id);
CREATE INDEX IF NOT EXISTS idx_recreacao_outro_resp ON public.recreacao_dados(outro_responsavel_id);

-- Policies
-- Allow authenticated users (internal management)
DROP POLICY IF EXISTS "Allow authenticated users to manage recreacao_dados" ON public.recreacao_dados;
CREATE POLICY "Allow authenticated users to manage recreacao_dados" 
ON public.recreacao_dados FOR ALL
TO authenticated 
USING (true)
WITH CHECK (true);

-- Allow public access for insertion/selection (for external forms)
DROP POLICY IF EXISTS "Allow public to manage their recreacao_dados" ON public.recreacao_dados;
CREATE POLICY "Allow public to manage their recreacao_dados" 
ON public.recreacao_dados FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_recreacao_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_recreacao_dados_updated_at ON public.recreacao_dados;
CREATE TRIGGER update_recreacao_dados_updated_at
    BEFORE UPDATE ON public.recreacao_dados
    FOR EACH ROW
    EXECUTE PROCEDURE update_recreacao_updated_at_column();

-- New security policies to allow external form to list teams and participants of the SAME encounter
-- This is needed for the cascading selectors (Team -> Person)

-- Allow public (anon) to select teams
DROP POLICY IF EXISTS "Allow public select teams" ON public.equipes;
CREATE POLICY "Allow public select teams" 
ON public.equipes FOR SELECT 
TO anon 
USING (deleted_at IS NULL);

-- Allow public (anon) to select participants of the encounter they have a token for
DROP POLICY IF EXISTS "Allow public select participacoes of same encounter" ON public.participacoes;
CREATE POLICY "Allow public select participacoes of same encounter" 
ON public.participacoes FOR SELECT 
TO anon 
USING (
    encontro_id IN (
        SELECT es.encontro_id 
        FROM public.external_sessions es 
        WHERE es.expires_at > now()
    )
);

-- Allow public (anon) to select people associated with those participacoes
DROP POLICY IF EXISTS "Allow public select people of same encounter" ON public.pessoas;
CREATE POLICY "Allow public select people of same encounter" 
ON public.pessoas FOR SELECT 
TO anon 
USING (
    id IN (
        SELECT pessoa_id 
        FROM public.participacoes 
        WHERE encontro_id IN (
            SELECT es.encontro_id 
            FROM public.external_sessions es 
            WHERE es.expires_at > now()
        )
    )
);
