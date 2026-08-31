-- Biblioteca: usa a resolução canônica de pessoa para compartilhamentos por equipe.
-- Isso contempla tanto o vínculo explícito quanto o fallback temporário por e-mail.

BEGIN;

CREATE OR REPLACE FUNCTION public.destino_biblioteca_pertence_ao_usuario(
  check_grupo_id uuid,
  check_equipe_id uuid,
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
      (
        check_grupo_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.usuario_grupos ug
          WHERE ug.usuario_id = check_user
            AND ug.grupo_id = check_grupo_id
            AND (
              ug.encontro_id IS NULL
              OR EXISTS (
                SELECT 1
                FROM public.encontros e
                WHERE e.id = ug.encontro_id
                  AND e.ativo = true
              )
            )
        )
      )
      OR
      (
        check_equipe_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.participacoes participacao
          JOIN public.encontros encontro
            ON encontro.id = participacao.encontro_id
           AND encontro.ativo = true
          WHERE participacao.pessoa_id = public.resolve_profile_person_id(check_user)
            AND participacao.equipe_id = check_equipe_id
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.destino_biblioteca_pertence_ao_usuario(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.destino_biblioteca_pertence_ao_usuario(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.destino_biblioteca_pertence_ao_usuario(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
