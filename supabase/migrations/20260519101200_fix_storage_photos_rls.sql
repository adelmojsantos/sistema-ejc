-- Migration: Fix Storage Photos RLS
-- Description: Expand the RLS policies on the 'galeria' bucket to allow uploads to any subfolder under 'fotos/' (e.g. equipes, palestrantes, visitacao)
-- Date: 2026-05-19

-- Expand upload access to any path starting with 'fotos/' in the 'galeria' bucket
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;

CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
    bucket_id = 'galeria' AND 
    (name LIKE 'fotos/%')
);
