-- Add aparece_pos_encontro column to equipes table
ALTER TABLE public.equipes ADD COLUMN aparece_pos_encontro boolean NOT NULL DEFAULT true;
