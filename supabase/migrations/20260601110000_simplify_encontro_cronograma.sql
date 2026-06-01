CREATE OR REPLACE FUNCTION public.validar_encontro_cronograma()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    periodo_inicio date;
    periodo_fim date;
BEGIN
    SELECT data_inicio, data_fim
      INTO periodo_inicio, periodo_fim
      FROM public.encontros
     WHERE id = NEW.encontro_id;

    IF periodo_inicio IS NULL OR periodo_fim IS NULL THEN
        RAISE EXCEPTION 'O encontro precisa possuir data de início e fim.';
    END IF;

    IF NEW.data < periodo_inicio OR NEW.data > periodo_fim THEN
        RAISE EXCEPTION 'A data da atividade deve estar dentro do período do encontro.';
    END IF;

    RETURN NEW;
END;
$$;

ALTER TABLE public.encontro_cronograma
ADD COLUMN IF NOT EXISTS cor text;

UPDATE public.encontro_cronograma
SET cor = COALESCE(cor, '#0ea5e9')
WHERE cor IS NULL;

ALTER TABLE public.encontro_cronograma
ALTER COLUMN cor SET DEFAULT '#0ea5e9',
ALTER COLUMN cor SET NOT NULL;

ALTER TABLE public.encontro_cronograma
DROP CONSTRAINT IF EXISTS encontro_cronograma_cor_check;

ALTER TABLE public.encontro_cronograma
ADD CONSTRAINT encontro_cronograma_cor_check
CHECK (cor ~ '^#[0-9A-Fa-f]{6}$');

UPDATE public.encontro_cronograma
SET descricao = COALESCE(NULLIF(BTRIM(descricao), ''), 'Atividade')
WHERE descricao IS NULL OR BTRIM(descricao) = '';

ALTER TABLE public.encontro_cronograma
ALTER COLUMN descricao SET NOT NULL;

ALTER TABLE public.encontro_cronograma
DROP COLUMN IF EXISTS atividade_id,
DROP COLUMN IF EXISTS palestra_id,
DROP COLUMN IF EXISTS responsavel_pessoa_id,
DROP COLUMN IF EXISTS responsavel_nome;

DROP TABLE IF EXISTS public.cronograma_atividades;

NOTIFY pgrst, 'reload schema';
