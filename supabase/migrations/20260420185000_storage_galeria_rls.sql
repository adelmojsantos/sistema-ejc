-- Migration: storage_galeria_rls
-- Description: Allow authenticated users to manage team photos and public to read them.
-- Date: 2026-04-20

-- 1. Ensure RLS is active on storage
-- (Note: storage.objects is managed by Supabase, but policies are needed)

-- 2. Allow public read access to 'galeria' bucket
-- This is necessary for the Quadrante SPA to display the images to everyone.
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'galeria' );

-- 3. Allow authenticated users to upload photos to 'fotos/equipes/'
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
    bucket_id = 'galeria' AND 
    (name LIKE 'fotos/equipes/%')
);

-- 4. Allow authenticated users to update/delete photos in 'galeria'
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
CREATE POLICY "Authenticated Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'galeria' );

DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;
CREATE POLICY "Authenticated Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'galeria' );
