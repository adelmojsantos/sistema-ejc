-- Add health information fields to pessoas table
-- These fields are filled during visitation, not during registration

ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS restricao_alimentar text,
  ADD COLUMN IF NOT EXISTS medicamento_continuo text,
  ADD COLUMN IF NOT EXISTS alergia text,
  ADD COLUMN IF NOT EXISTS observacoes_saude text;

-- Add comments for documentation
COMMENT ON COLUMN pessoas.restricao_alimentar IS 'Restrições alimentares (ex: vegetariano, intolerante à lactose)';
COMMENT ON COLUMN pessoas.medicamento_continuo IS 'Medicamentos de uso contínuo (ex: insulina, antialérgico)';
COMMENT ON COLUMN pessoas.alergia IS 'Alergias conhecidas (ex: amendoim, penicilina, látex)';
COMMENT ON COLUMN pessoas.observacoes_saude IS 'Observações gerais de saúde relevantes para o encontro';
