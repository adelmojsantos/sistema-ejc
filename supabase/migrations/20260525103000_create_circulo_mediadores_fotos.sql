CREATE TABLE IF NOT EXISTS public.circulo_mediadores_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id UUID NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    circulo_id INTEGER NOT NULL REFERENCES public.circulos(id) ON DELETE CASCADE,
    foto_url TEXT,
    foto_posicao_y NUMERIC NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT circulo_mediadores_fotos_unique UNIQUE (encontro_id, circulo_id)
);

ALTER TABLE public.circulo_mediadores_fotos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS circulo_mediadores_fotos_set_updated_at ON public.circulo_mediadores_fotos;
CREATE TRIGGER circulo_mediadores_fotos_set_updated_at
BEFORE UPDATE ON public.circulo_mediadores_fotos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Authenticated manage circle mediator photos" ON public.circulo_mediadores_fotos;
CREATE POLICY "Authenticated manage circle mediator photos"
ON public.circulo_mediadores_fotos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select active circle mediator photos" ON public.circulo_mediadores_fotos;
CREATE POLICY "Allow public select active circle mediator photos"
ON public.circulo_mediadores_fotos
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM public.encontros e
        WHERE e.id = circulo_mediadores_fotos.encontro_id
        AND e.quadrante_ativo = true
    )
);
