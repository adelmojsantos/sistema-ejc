-- Migration: Create Financeiro Bucket and Set RLS
-- Description: Create a dedicated bucket for financial settings (QR Codes) and set permissions.
-- Date: 2026-04-30

-- 1. Criar o bucket 'financeiro' se não existir
INSERT INTO storage.buckets (id, name, public)
SELECT 'financeiro', 'financeiro', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'financeiro'
);

-- 2. Permitir upload de arquivos no bucket 'financeiro'
DROP POLICY IF EXISTS "Authenticated Upload Financeiro Access" ON storage.objects;
CREATE POLICY "Authenticated Upload Financeiro Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'financeiro' );

-- 3. Permitir leitura no bucket 'financeiro'
DROP POLICY IF EXISTS "Public Select Financeiro Access" ON storage.objects;
CREATE POLICY "Public Select Financeiro Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'financeiro' );

-- 4. Permitir deleção/update no bucket 'financeiro'
DROP POLICY IF EXISTS "Authenticated Update Financeiro Access" ON storage.objects;
CREATE POLICY "Authenticated Update Financeiro Access"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'financeiro' );

DROP POLICY IF EXISTS "Authenticated Delete Financeiro Access" ON storage.objects;
CREATE POLICY "Authenticated Delete Financeiro Access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'financeiro' );
