-- Migration: Quadrante Fields and Configuration
-- Date: 2026-04-20

-- 1. Add foto_url to participacoes and equipes
ALTER TABLE public.participacoes 
ADD COLUMN IF NOT EXISTS foto_url TEXT;

ALTER TABLE public.equipes 
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- 2. Add quadrante configuration to encontros
ALTER TABLE public.encontros 
ADD COLUMN IF NOT EXISTS quadrante_token UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS quadrante_pin TEXT,
ADD COLUMN IF NOT EXISTS quadrante_ativo BOOLEAN DEFAULT false;

-- 3. Create indices for performance
CREATE INDEX IF NOT EXISTS idx_encontros_quadrante_token ON public.encontros (quadrante_token);

-- 4. RPC for secure PIN validation (to avoid leaking PIN in public queries)
CREATE OR REPLACE FUNCTION public.validate_quadrante_access(
    p_token UUID,
    p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.encontros
        WHERE quadrante_token = p_token
          AND quadrante_ativo = true
          AND (quadrante_pin IS NULL OR quadrante_pin = p_pin)
    );
END;
$$;
