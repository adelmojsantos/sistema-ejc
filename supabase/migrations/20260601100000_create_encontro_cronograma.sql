CREATE TABLE IF NOT EXISTS public.encontro_cronograma (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    data date NOT NULL,
    hora_inicio time NOT NULL,
    hora_fim time NOT NULL,
    descricao text NOT NULL,
    cor text NOT NULL DEFAULT '#0ea5e9' CHECK (cor ~ '^#[0-9A-Fa-f]{6}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (hora_fim > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_encontro_cronograma_encontro_data
ON public.encontro_cronograma (encontro_id, data, hora_inicio);

DROP TRIGGER IF EXISTS encontro_cronograma_set_updated_at ON public.encontro_cronograma;
CREATE TRIGGER encontro_cronograma_set_updated_at
BEFORE UPDATE ON public.encontro_cronograma
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

DROP TRIGGER IF EXISTS encontro_cronograma_validar ON public.encontro_cronograma;
CREATE TRIGGER encontro_cronograma_validar
BEFORE INSERT OR UPDATE ON public.encontro_cronograma
FOR EACH ROW EXECUTE FUNCTION public.validar_encontro_cronograma();

ALTER TABLE public.encontro_cronograma ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_read_encontro_cronograma" ON public.encontro_cronograma;
CREATE POLICY "authenticated_can_read_encontro_cronograma"
ON public.encontro_cronograma FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "cadastros_can_manage_encontro_cronograma" ON public.encontro_cronograma;
CREATE POLICY "cadastros_can_manage_encontro_cronograma"
ON public.encontro_cronograma FOR ALL TO authenticated
USING (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_cadastros')
)
WITH CHECK (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_cadastros')
);
