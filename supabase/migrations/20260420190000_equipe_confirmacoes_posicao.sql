-- Migration: Add Foto Position (Panning) to Team Confirmations
-- Date: 2026-04-20

-- 1. Add foto_posicao_y to equipe_confirmacoes
-- Stored as percentage (0-100), default 50 (center)
ALTER TABLE public.equipe_confirmacoes 
ADD COLUMN IF NOT EXISTS foto_posicao_y INTEGER DEFAULT 50;

-- 2. Ensure RLS is active for the new column (covered by existing policies)
