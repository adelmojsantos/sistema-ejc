-- Allow additional leadership nominations to be registered by consensus.
-- Regular nominations still require an active leadership member as proposer.

BEGIN;

ALTER TABLE public.dirigencia_indicacoes
  ALTER COLUMN indicador_membro_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.dirigencia_indicacoes'::regclass
      AND contype = 'c'
      AND pg_catalog.pg_get_constraintdef(oid)
        ILIKE '%tipo%adicional%indicador_membro_id%IS NOT NULL%'
  ) THEN
    ALTER TABLE public.dirigencia_indicacoes
      ADD CONSTRAINT dirigencia_indicacoes_indicador_obrigatorio_check
      CHECK (tipo = 'adicional' OR indicador_membro_id IS NOT NULL);
  END IF;
END;
$$;

COMMIT;
