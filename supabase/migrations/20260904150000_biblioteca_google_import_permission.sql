BEGIN;

INSERT INTO public.permissoes (id, chave, descricao)
VALUES (
  '00000000-0000-0000-0001-000000000024',
  'biblioteca_google_importar',
  'Importar pastas e arquivos de outra conta do Google Drive para a Biblioteca'
)
ON CONFLICT (chave) DO UPDATE
SET descricao = EXCLUDED.descricao;

-- Administradores preservam a capacidade atual. O grupo temporário, quando
-- presente no ambiente de produção, recebe apenas a ação necessária à revisão.
INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT grupo.id, permissao.id
FROM public.grupos grupo
CROSS JOIN public.permissoes permissao
WHERE grupo.nome IN ('Administrador', 'Verificação Google')
  AND permissao.chave = 'biblioteca_google_importar'
ON CONFLICT (grupo_id, permissao_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.pode_importar_biblioteca_google(
  check_user uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    check_user IS NOT NULL
    AND check_user = auth.uid()
    AND (
      public.is_admin(check_user)
      OR public.has_permission(check_user, 'biblioteca_google_importar')
    );
$$;

REVOKE ALL ON FUNCTION public.pode_importar_biblioteca_google(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_importar_biblioteca_google(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pode_importar_biblioteca_google(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
