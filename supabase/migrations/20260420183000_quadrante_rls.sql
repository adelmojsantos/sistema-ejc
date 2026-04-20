-- Migration: Release Public Access for Quadrante Data (RLS)
-- Date: 2026-04-20

-- 1. Allow public (anon) to read encounter basic info if it's active
DROP POLICY IF EXISTS "Allow public select active encounters" ON public.encontros;
CREATE POLICY "Allow public select active encounters" 
ON public.encontros FOR SELECT 
TO anon 
USING (quadrante_ativo = true);

-- 2. Allow public (anon) to read participations of active encounters
DROP POLICY IF EXISTS "Allow public select participants of active encounters" ON public.participacoes;
CREATE POLICY "Allow public select participants of active encounters" 
ON public.participacoes FOR SELECT 
TO anon 
USING (
    EXISTS (
        SELECT 1 FROM public.encontros 
        WHERE id = participacoes.encontro_id 
        AND quadrante_ativo = true
    )
);

-- 3. Allow public (anon) to read people info of active encounters
DROP POLICY IF EXISTS "Allow public select people of active encounters" ON public.pessoas;
CREATE POLICY "Allow public select people of active encounters" 
ON public.pessoas FOR SELECT 
TO anon 
USING (
    EXISTS (
        SELECT 1 FROM public.participacoes p
        JOIN public.encontros e ON e.id = p.encontro_id
        WHERE p.pessoa_id = pessoas.id
        AND e.quadrante_ativo = true
    )
);

-- 4. Allow public (anon) to read teams and circles (general data)
DROP POLICY IF EXISTS "Allow public select teams for quadrante" ON public.equipes;
CREATE POLICY "Allow public select teams for quadrante" 
ON public.equipes FOR SELECT 
TO anon 
USING (true);

DROP POLICY IF EXISTS "Allow public select circles for quadrante" ON public.circulos;
CREATE POLICY "Allow public select circles for quadrante" 
ON public.circulos FOR SELECT 
TO anon 
USING (true);

DROP POLICY IF EXISTS "Allow public select circle relationships" ON public.circulo_participacao;
CREATE POLICY "Allow public select circle relationships" 
ON public.circulo_participacao FOR SELECT 
TO anon 
USING (
    EXISTS (
        SELECT 1 FROM public.participacoes p
        JOIN public.encontros e ON e.id = p.encontro_id
        WHERE p.id = circulo_participacao.participacao
        AND e.quadrante_ativo = true
    )
);
