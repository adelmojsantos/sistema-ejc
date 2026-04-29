-- Migration: Fix Proof Upload RLS
-- Description: Allow coordinators to update team confirmations and upload proofs to storage.
-- Date: 2026-04-29

-- 0. Add columns to equipe_confirmacoes
ALTER TABLE public.equipe_confirmacoes 
ADD COLUMN IF NOT EXISTS comprovante_taxas_url TEXT,
ADD COLUMN IF NOT EXISTS comprovante_camisetas_url TEXT;

-- 1. Allow Coordinators to UPDATE equipe_confirmacoes
-- This is needed for uploading proofs or updating team photos after the initial confirmation.
DROP POLICY IF EXISTS "coordenador_can_update_confirmacoes" ON public.equipe_confirmacoes;
CREATE POLICY "coordenador_can_update_confirmacoes"
ON public.equipe_confirmacoes FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuario_grupos ug
        JOIN public.grupo_permissoes gp ON gp.grupo_id = ug.grupo_id
        JOIN public.permissoes p ON p.id = gp.permissao_id
        WHERE ug.usuario_id = auth.uid()
          AND p.chave = 'modulo_coordenador'
          AND ug.encontro_id = equipe_confirmacoes.encontro_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuario_grupos ug
        JOIN public.grupo_permissoes gp ON gp.grupo_id = ug.grupo_id
        JOIN public.permissoes p ON p.id = gp.permissao_id
        WHERE ug.usuario_id = auth.uid()
          AND p.chave = 'modulo_coordenador'
          AND ug.encontro_id = equipe_confirmacoes.encontro_id
    )
);

-- 3. Permitir upload de arquivos na pasta 'comprovantes/' no Storage
-- Ajustado para ser mais genérico e permitir subpastas como taxas e camisetas
DROP POLICY IF EXISTS "Authenticated Upload Proofs Access" ON storage.objects;
CREATE POLICY "Authenticated Upload Proofs Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
    bucket_id = 'galeria' AND 
    (name LIKE 'comprovantes/%')
);

-- 4. Permitir leitura dos comprovantes por usuários autenticados
DROP POLICY IF EXISTS "Authenticated Select Proofs Access" ON storage.objects;
CREATE POLICY "Authenticated Select Proofs Access"
ON storage.objects FOR SELECT
TO authenticated
USING ( 
    bucket_id = 'galeria' AND 
    (name LIKE 'comprovantes/%')
);
