-- Mantém comprovantes fora do bucket público da galeria.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('comprovantes', 'comprovantes', false, 10485760)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Authorized users manage private proofs" ON storage.objects;
CREATE POLICY "Authorized users manage private proofs"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'modulo_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_visitacao_coordenar')
    OR public.has_permission(auth.uid(), 'modulo_visitacao_duplas')
  )
)
WITH CHECK (
  bucket_id = 'comprovantes'
  AND (
    public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_compras')
    OR public.has_permission(auth.uid(), 'modulo_coordenador')
    OR public.has_permission(auth.uid(), 'modulo_visitacao_coordenar')
    OR public.has_permission(auth.uid(), 'modulo_visitacao_duplas')
  )
);

-- As políticas legadas do bucket galeria são mantidas nesta fase para permitir
-- rollback do frontend. Elas podem ser removidas depois que a migração dos
-- objetos for validada.

COMMENT ON COLUMN public.equipe_confirmacoes.comprovante_taxas_url IS
'Referência privada ou URL legada do comprovante mais recente de taxas.';
COMMENT ON COLUMN public.equipe_confirmacoes.comprovante_camisetas_url IS
'Referência privada ou URL legada do comprovante mais recente de camisetas.';
COMMENT ON COLUMN public.equipe_confirmacoes.comprovantes_taxas_urls IS
'Referências privadas ou URLs legadas dos comprovantes de taxas.';
COMMENT ON COLUMN public.equipe_confirmacoes.comprovantes_camisetas_urls IS
'Referências privadas ou URLs legadas dos comprovantes de camisetas.';
COMMENT ON COLUMN public.visita_intencao_camiseta.comprovante_url IS
'Referência privada ou URL legada do comprovante da intenção de camiseta.';

CREATE TABLE IF NOT EXISTS public.comprovante_storage_migracoes (
  source_bucket text NOT NULL,
  source_path text PRIMARY KEY,
  target_bucket text NOT NULL,
  target_path text NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  source_deleted_at timestamptz
);

ALTER TABLE public.comprovante_storage_migracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins inspect proof storage migrations"
ON public.comprovante_storage_migracoes;
CREATE POLICY "Admins inspect proof storage migrations"
ON public.comprovante_storage_migracoes
FOR SELECT
TO authenticated
USING (public.is_admin());

COMMENT ON TABLE public.comprovante_storage_migracoes IS
'Auditoria retomável da cópia de comprovantes públicos para o bucket privado.';
