-- Diagnostics contain implementation details and are intentionally not part
-- of the general administrator access.

BEGIN;

INSERT INTO public.permissoes (chave, nome, descricao)
VALUES (
  'modulo_diagnosticos',
  'Diagnósticos técnicos',
  'Permite consultar falhas técnicas e detalhes de diagnóstico da aplicação.'
)
ON CONFLICT (chave) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    updated_at = now();

INSERT INTO public.grupos (nome, descricao)
VALUES (
  'Desenvolvedores',
  'Acesso restrito às ferramentas técnicas de diagnóstico.'
)
ON CONFLICT (nome) DO UPDATE
SET descricao = EXCLUDED.descricao,
    updated_at = now();

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT g.id, p.id
FROM public.grupos g
JOIN public.permissoes p ON p.chave = 'modulo_diagnosticos'
WHERE g.nome = 'Desenvolvedores'
ON CONFLICT DO NOTHING;

-- Initial technical owner. Additional developers must be granted this group
-- explicitly through access management.
INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
SELECT pr.id, g.id, NULL
FROM public.profiles pr
CROSS JOIN public.grupos g
WHERE lower(pr.email) = 'adelmojsantos1985@gmail.com'
  AND g.nome = 'Desenvolvedores'
  AND NOT EXISTS (
    SELECT 1
    FROM public.usuario_grupos ug
    WHERE ug.usuario_id = pr.id
      AND ug.grupo_id = g.id
      AND ug.encontro_id IS NULL
  );

DROP POLICY IF EXISTS "admins_read_app_errors"
  ON public.app_error_logs;
DROP POLICY IF EXISTS "developers_read_app_errors"
  ON public.app_error_logs;

CREATE POLICY "developers_read_app_errors"
ON public.app_error_logs
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'modulo_diagnosticos')
);

NOTIFY pgrst, 'reload schema';

COMMIT;
