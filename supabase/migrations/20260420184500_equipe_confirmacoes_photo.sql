-- Migration: Add Foto URL to Team Confirmations
-- Date: 2026-04-20

-- 1. Add foto_url to equipe_confirmacoes
ALTER TABLE public.equipe_confirmacoes 
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- 2. RLS: Allow public (anon) to read team photos if the encounter quadrante is active
-- We join with encontros to check the quadrante_ativo status
DROP POLICY IF EXISTS "Allow public select team photos for active quadrantes" ON public.equipe_confirmacoes;
CREATE POLICY "Allow public select team photos for active quadrantes" 
ON public.equipe_confirmacoes FOR SELECT 
TO anon 
USING (
    EXISTS (
        SELECT 1 FROM public.encontros 
        WHERE id = equipe_confirmacoes.encontro_id 
        AND quadrante_ativo = true
    )
);
