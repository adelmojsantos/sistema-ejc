ALTER TABLE public.pos_encontros
ADD COLUMN IF NOT EXISTS arquivo_path text,
ADD COLUMN IF NOT EXISTS arquivo_nome text,
ADD COLUMN IF NOT EXISTS arquivo_tipo text,
ADD COLUMN IF NOT EXISTS arquivo_tamanho bigint;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pos-encontros', 'pos-encontros', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated manage pos encontro files" ON storage.objects;
CREATE POLICY "Authenticated manage pos encontro files"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'pos-encontros')
WITH CHECK (bucket_id = 'pos-encontros');
