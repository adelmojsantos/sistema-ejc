-- Garante que, ao remover uma participacao do encontro, seu vinculo com
-- o circulo seja removido automaticamente.

DELETE FROM public.circulo_participacao cp
WHERE cp.participacao IS NULL
   OR NOT EXISTS (
       SELECT 1
       FROM public.participacoes p
       WHERE p.id = cp.participacao
   );

DO $$
DECLARE
    constraint_record record;
BEGIN
    FOR constraint_record IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_attribute att
          ON att.attrelid = rel.oid
         AND att.attname = 'participacao'
        WHERE con.contype = 'f'
          AND nsp.nspname = 'public'
          AND rel.relname = 'circulo_participacao'
          AND att.attnum = ANY (con.conkey)
    LOOP
        EXECUTE format(
            'ALTER TABLE public.circulo_participacao DROP CONSTRAINT %I',
            constraint_record.conname
        );
    END LOOP;
END;
$$;

ALTER TABLE public.circulo_participacao
    ALTER COLUMN participacao SET NOT NULL,
    ADD CONSTRAINT circulo_participacao_participacao_fkey
        FOREIGN KEY (participacao)
        REFERENCES public.participacoes(id)
        ON DELETE CASCADE;
