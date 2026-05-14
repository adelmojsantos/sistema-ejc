-- Migration: Add value to T-shirt models
-- Description: Add a price field to the T-shirt models table.
-- Date: 2026-04-29

ALTER TABLE public.camiseta_modelos 
ADD COLUMN IF NOT EXISTS valor NUMERIC(10, 2) DEFAULT 0;
