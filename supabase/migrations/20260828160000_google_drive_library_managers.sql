-- Garante que gestores da Biblioteca consigam abrir e editar no Drive os
-- arquivos criados pela conta central, sem compartilhamento manual adicional.

BEGIN;

CREATE OR REPLACE FUNCTION public.biblioteca_google_usuarios_desejados(
  p_arquivo_id uuid
)
RETURNS TABLE (
  profile_id uuid,
  google_email text,
  google_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH RECURSIVE pasta_ancestral AS (
    SELECT arquivo.pasta_id AS id
    FROM public.biblioteca_arquivos arquivo
    WHERE arquivo.id = p_arquivo_id
      AND arquivo.pasta_id IS NOT NULL

    UNION

    SELECT pasta.parent_id
    FROM public.biblioteca_pastas pasta
    JOIN pasta_ancestral ancestral ON ancestral.id = pasta.id
    WHERE pasta.parent_id IS NOT NULL
  ),
  compartilhamentos AS (
    SELECT compartilhamento.*
    FROM public.biblioteca_compartilhamento compartilhamento
    WHERE compartilhamento.arquivo_id = p_arquivo_id
       OR compartilhamento.pasta_id IN (SELECT id FROM pasta_ancestral)
  ),
  usuarios_grupo AS (
    SELECT
      profile.id AS profile_id,
      lower(btrim(COALESCE(NULLIF(profile.google_email, ''), profile.email))) AS google_email,
      compartilhamento.google_role
    FROM compartilhamentos compartilhamento
    JOIN public.usuario_grupos membership
      ON membership.grupo_id = compartilhamento.grupo_id
    JOIN public.profiles profile
      ON profile.id = membership.usuario_id
    WHERE compartilhamento.grupo_id IS NOT NULL
      AND (
        membership.encontro_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.encontros encontro
          WHERE encontro.id = membership.encontro_id
            AND encontro.ativo = true
        )
      )
  ),
  usuarios_equipe AS (
    SELECT
      profile.id AS profile_id,
      lower(btrim(COALESCE(NULLIF(profile.google_email, ''), profile.email))) AS google_email,
      compartilhamento.google_role
    FROM compartilhamentos compartilhamento
    JOIN public.participacoes participacao
      ON participacao.equipe_id = compartilhamento.equipe_id
    JOIN public.encontros encontro
      ON encontro.id = participacao.encontro_id
     AND encontro.ativo = true
    JOIN public.profiles profile
      ON public.resolve_profile_person_id(profile.id) = participacao.pessoa_id
    WHERE compartilhamento.equipe_id IS NOT NULL
  ),
  gestores_biblioteca AS (
    SELECT
      profile.id AS profile_id,
      lower(btrim(COALESCE(NULLIF(profile.google_email, ''), profile.email))) AS google_email,
      'writer'::text AS google_role
    FROM public.profiles profile
    WHERE public.is_admin(profile.id)
       OR EXISTS (
         SELECT 1
         FROM public.usuario_grupos membership
         JOIN public.grupo_permissoes grupo_permissao
           ON grupo_permissao.grupo_id = membership.grupo_id
         JOIN public.permissoes permissao
           ON permissao.id = grupo_permissao.permissao_id
         WHERE membership.usuario_id = profile.id
           AND permissao.chave = 'modulo_biblioteca'
           AND (
             membership.encontro_id IS NULL
             OR EXISTS (
               SELECT 1
               FROM public.encontros encontro
               WHERE encontro.id = membership.encontro_id
                 AND encontro.ativo = true
             )
           )
       )
  ),
  usuarios AS (
    SELECT * FROM usuarios_grupo
    UNION
    SELECT * FROM usuarios_equipe
    UNION
    SELECT * FROM gestores_biblioteca
  )
  SELECT
    min(usuario.profile_id::text)::uuid,
    usuario.google_email,
    CASE WHEN bool_or(usuario.google_role = 'writer') THEN 'writer' ELSE 'reader' END
  FROM usuarios usuario
  WHERE NULLIF(usuario.google_email, '') IS NOT NULL
  GROUP BY usuario.google_email;
$$;

-- Alterações de vínculo do usuário já são cobertas pelo trigger de
-- usuario_grupos. Estes triggers cobrem mudanças na composição dos grupos e da
-- dirigência, que também podem conceder ou revogar gestão da Biblioteca.
DROP TRIGGER IF EXISTS biblioteca_google_grupo_permissao_sync
  ON public.grupo_permissoes;
CREATE TRIGGER biblioteca_google_grupo_permissao_sync
AFTER INSERT OR UPDATE OR DELETE ON public.grupo_permissoes
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_biblioteca_google_reconciliar_todos();

DROP TRIGGER IF EXISTS biblioteca_google_dirigencia_membro_sync
  ON public.dirigencia_membros;
CREATE TRIGGER biblioteca_google_dirigencia_membro_sync
AFTER INSERT OR UPDATE OR DELETE ON public.dirigencia_membros
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_biblioteca_google_reconciliar_todos();

DROP TRIGGER IF EXISTS biblioteca_google_dirigencia_sync
  ON public.dirigencias;
CREATE TRIGGER biblioteca_google_dirigencia_sync
AFTER UPDATE OF status ON public.dirigencias
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_biblioteca_google_reconciliar_todos();

REVOKE ALL ON FUNCTION public.biblioteca_google_usuarios_desejados(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.biblioteca_google_usuarios_desejados(uuid)
  TO service_role;

SELECT public.enfileirar_biblioteca_google_todos();

NOTIFY pgrst, 'reload schema';

COMMIT;
