-- Migration: Add pago_camiseta to participacoes
-- Description: Add a boolean column pago_camiseta to the participacoes table to track shirt payment status.
-- Date: 2026-05-20

ALTER TABLE participacoes ADD COLUMN IF NOT EXISTS pago_camiseta BOOLEAN DEFAULT false;
