-- Create recepcao_dados table
CREATE TABLE IF NOT EXISTS public.recepcao_dados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participacao_id UUID NOT NULL UNIQUE REFERENCES public.participacoes(id) ON DELETE CASCADE,
    veiculo_tipo TEXT NOT NULL CHECK (veiculo_tipo IN ('moto', 'carro')),
    veiculo_modelo TEXT NOT NULL,
    veiculo_cor TEXT NOT NULL,
    veiculo_placa TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recepcao_dados ENABLE ROW LEVEL SECURITY;

-- Policies
-- Allow authenticated users to select
CREATE POLICY "Allow authenticated users to select recepcao_dados" 
ON public.recepcao_dados FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to insert/update/delete
-- Note: In a real scenario, we might want to restrict this to coordinators or the person themselves.
-- For now, following the pattern in the project for authenticated users.
CREATE POLICY "Allow authenticated users to insert recepcao_dados" 
ON public.recepcao_dados FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update recepcao_dados" 
ON public.recepcao_dados FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete recepcao_dados" 
ON public.recepcao_dados FOR DELETE 
TO authenticated 
USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recepcao_dados_updated_at
    BEFORE UPDATE ON public.recepcao_dados
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
