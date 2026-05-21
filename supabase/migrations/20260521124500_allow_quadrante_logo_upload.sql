DROP POLICY IF EXISTS "Authenticated Upload Quadrante Logos Access" ON storage.objects;

CREATE POLICY "Authenticated Upload Quadrante Logos Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'galeria'
    AND name LIKE 'fotos/quadrante/%'
);