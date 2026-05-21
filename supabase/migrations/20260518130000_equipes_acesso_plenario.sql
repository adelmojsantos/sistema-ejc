-- Migration for adding acesso_plenario to equipes
ALTER TABLE equipes
ADD COLUMN acesso_plenario text DEFAULT 'verde' CHECK (acesso_plenario IN ('verde', 'amarela', 'vermelha'));
