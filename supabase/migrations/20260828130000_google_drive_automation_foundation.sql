-- Biblioteca Google Drive: fundação para OAuth, criação de arquivos e
-- sincronização resiliente de permissões individuais.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_email text;

COMMENT ON COLUMN public.profiles.google_email IS
  'Conta Google usada pela automação do Drive. Quando nula, utiliza profiles.email.';

ALTER TABLE public.biblioteca_compartilhamento
  ADD COLUMN IF NOT EXISTS google_role text NOT NULL DEFAULT 'reader';

ALTER TABLE public.biblioteca_compartilhamento
  DROP CONSTRAINT IF EXISTS biblioteca_compartilhamento_google_role_check;
ALTER TABLE public.biblioteca_compartilhamento
  ADD CONSTRAINT biblioteca_compartilhamento_google_role_check
  CHECK (google_role IN ('reader', 'writer'));

ALTER TABLE public.biblioteca_arquivos
  ADD COLUMN IF NOT EXISTS google_managed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_sync_status text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS google_sync_error text,
  ADD COLUMN IF NOT EXISTS google_synced_at timestamptz;

ALTER TABLE public.biblioteca_arquivos
  DROP CONSTRAINT IF EXISTS biblioteca_arquivos_google_sync_status_check;
ALTER TABLE public.biblioteca_arquivos
  ADD CONSTRAINT biblioteca_arquivos_google_sync_status_check
  CHECK (google_sync_status IN ('manual', 'pending', 'syncing', 'synced', 'error'));

COMMENT ON COLUMN public.biblioteca_arquivos.google_managed IS
  'Indica que o arquivo foi criado ou selecionado pela integração OAuth e pode ter ACL sincronizada.';

CREATE TABLE public.biblioteca_google_integracao (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  google_account_email text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  drive_root_folder_id text NOT NULL,
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);

CREATE TABLE public.biblioteca_google_oauth_state (
  state_hash text PRIMARY KEY,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.biblioteca_google_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id uuid NOT NULL REFERENCES public.biblioteca_arquivos(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  google_email text NOT NULL,
  permission_id text,
  desired_role text NOT NULL CHECK (desired_role IN ('reader', 'writer')),
  previous_role text CHECK (previous_role IS NULL OR previous_role IN ('reader', 'commenter', 'writer')),
  management_type text NOT NULL CHECK (management_type IN ('created', 'updated', 'observed')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'revoked')),
  last_error text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.biblioteca_google_permissoes
  ADD CONSTRAINT biblioteca_google_permissoes_arquivo_email_key
  UNIQUE (arquivo_id, google_email);

CREATE TABLE public.biblioteca_google_sync_fila (
  arquivo_id uuid PRIMARY KEY REFERENCES public.biblioteca_arquivos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'error')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  requested_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  locked_at timestamptz
);

ALTER TABLE public.biblioteca_google_integracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_google_oauth_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_google_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_google_sync_fila ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.biblioteca_google_integracao FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.biblioteca_google_oauth_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.biblioteca_google_permissoes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.biblioteca_google_sync_fila FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.biblioteca_google_integracao TO service_role;
GRANT ALL ON TABLE public.biblioteca_google_oauth_state TO service_role;
GRANT ALL ON TABLE public.biblioteca_google_permissoes TO service_role;
GRANT ALL ON TABLE public.biblioteca_google_sync_fila TO service_role;

-- Funções SECURITY DEFINER abaixo são privadas da service_role ou usadas apenas
-- por triggers. Isso permite reconciliar ACLs sem ampliar as policies públicas.
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
  usuarios AS (
    SELECT * FROM usuarios_grupo
    UNION
    SELECT * FROM usuarios_equipe
  )
  SELECT
    min(usuario.profile_id::text)::uuid,
    usuario.google_email,
    CASE WHEN bool_or(usuario.google_role = 'writer') THEN 'writer' ELSE 'reader' END
  FROM usuarios usuario
  WHERE NULLIF(usuario.google_email, '') IS NOT NULL
  GROUP BY usuario.google_email;
$$;

CREATE OR REPLACE FUNCTION public.biblioteca_google_arquivos_afetados(
  p_pasta_id uuid DEFAULT NULL,
  p_arquivo_id uuid DEFAULT NULL
)
RETURNS TABLE (arquivo_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH RECURSIVE pastas AS (
    SELECT p_pasta_id AS id
    WHERE p_pasta_id IS NOT NULL

    UNION

    SELECT pasta.id
    FROM public.biblioteca_pastas pasta
    JOIN pastas parent ON parent.id = pasta.parent_id
  )
  SELECT arquivo.id
  FROM public.biblioteca_arquivos arquivo
  WHERE arquivo.origem = 'google_drive'
    AND arquivo.google_managed = true
    AND (
      arquivo.id = p_arquivo_id
      OR arquivo.pasta_id IN (SELECT id FROM pastas)
    );
$$;

CREATE OR REPLACE FUNCTION public.enfileirar_biblioteca_google_arquivo(
  p_arquivo_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  INSERT INTO public.biblioteca_google_sync_fila (
    arquivo_id,
    status,
    attempts,
    requested_at,
    next_attempt_at,
    last_error,
    locked_at
  )
  SELECT
    arquivo.id,
    'pending',
    0,
    now(),
    now(),
    NULL,
    NULL
  FROM public.biblioteca_arquivos arquivo
  WHERE arquivo.id = p_arquivo_id
    AND arquivo.origem = 'google_drive'
    AND arquivo.google_managed = true
  ON CONFLICT (arquivo_id) DO UPDATE SET
    status = 'pending',
    attempts = 0,
    requested_at = now(),
    next_attempt_at = now(),
    last_error = NULL,
    locked_at = NULL;

  UPDATE public.biblioteca_arquivos
  SET google_sync_status = 'pending',
      google_sync_error = NULL
  WHERE id = p_arquivo_id
    AND origem = 'google_drive'
    AND google_managed = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enfileirar_biblioteca_google_todos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.enfileirar_biblioteca_google_arquivo(arquivo.id)
  FROM public.biblioteca_arquivos arquivo
  WHERE arquivo.origem = 'google_drive'
    AND arquivo.google_managed = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_biblioteca_google_sync_fila(
  p_limit integer DEFAULT 10
)
RETURNS TABLE (arquivo_id uuid)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH candidates AS (
    SELECT fila.arquivo_id
    FROM public.biblioteca_google_sync_fila fila
    WHERE (
        fila.status IN ('pending', 'error')
        AND fila.next_attempt_at <= now()
      )
      OR (
        fila.status = 'processing'
        AND fila.locked_at < now() - interval '5 minutes'
      )
    ORDER BY fila.requested_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 25)
  ),
  claimed AS (
    UPDATE public.biblioteca_google_sync_fila fila
    SET status = 'processing',
        locked_at = now()
    FROM candidates
    WHERE fila.arquivo_id = candidates.arquivo_id
    RETURNING fila.arquivo_id
  )
  SELECT claimed.arquivo_id FROM claimed;
$$;

CREATE OR REPLACE FUNCTION public.trigger_biblioteca_google_compartilhamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  arquivo record;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    FOR arquivo IN
      SELECT * FROM public.biblioteca_google_arquivos_afetados(OLD.pasta_id, OLD.arquivo_id)
    LOOP
      PERFORM public.enfileirar_biblioteca_google_arquivo(arquivo.arquivo_id);
    END LOOP;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    FOR arquivo IN
      SELECT * FROM public.biblioteca_google_arquivos_afetados(NEW.pasta_id, NEW.arquivo_id)
    LOOP
      PERFORM public.enfileirar_biblioteca_google_arquivo(arquivo.arquivo_id);
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS biblioteca_google_compartilhamento_sync
  ON public.biblioteca_compartilhamento;
CREATE TRIGGER biblioteca_google_compartilhamento_sync
AFTER INSERT OR UPDATE OR DELETE ON public.biblioteca_compartilhamento
FOR EACH ROW EXECUTE FUNCTION public.trigger_biblioteca_google_compartilhamento();

CREATE OR REPLACE FUNCTION public.trigger_biblioteca_google_arquivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.origem = 'google_drive' AND NEW.google_managed = true THEN
    PERFORM public.enfileirar_biblioteca_google_arquivo(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS biblioteca_google_arquivo_sync ON public.biblioteca_arquivos;
CREATE TRIGGER biblioteca_google_arquivo_sync
AFTER INSERT OR UPDATE OF pasta_id, google_managed ON public.biblioteca_arquivos
FOR EACH ROW EXECUTE FUNCTION public.trigger_biblioteca_google_arquivo();

CREATE OR REPLACE FUNCTION public.trigger_biblioteca_google_reconciliar_todos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.enfileirar_biblioteca_google_todos();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS biblioteca_google_usuario_grupo_sync ON public.usuario_grupos;
CREATE TRIGGER biblioteca_google_usuario_grupo_sync
AFTER INSERT OR UPDATE OR DELETE ON public.usuario_grupos
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_biblioteca_google_reconciliar_todos();

DROP TRIGGER IF EXISTS biblioteca_google_participacao_sync ON public.participacoes;
CREATE TRIGGER biblioteca_google_participacao_sync
AFTER INSERT OR DELETE OR UPDATE OF pessoa_id, equipe_id, encontro_id ON public.participacoes
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_biblioteca_google_reconciliar_todos();

DROP TRIGGER IF EXISTS biblioteca_google_profile_sync ON public.profiles;
CREATE TRIGGER biblioteca_google_profile_sync
AFTER DELETE OR UPDATE OF email, google_email, pessoa_id ON public.profiles
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_biblioteca_google_reconciliar_todos();

DROP TRIGGER IF EXISTS biblioteca_google_pessoa_sync ON public.pessoas;
CREATE TRIGGER biblioteca_google_pessoa_sync
AFTER DELETE OR UPDATE OF email ON public.pessoas
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_biblioteca_google_reconciliar_todos();

DROP TRIGGER IF EXISTS biblioteca_google_encontro_sync ON public.encontros;
CREATE TRIGGER biblioteca_google_encontro_sync
AFTER UPDATE OF ativo ON public.encontros
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_biblioteca_google_reconciliar_todos();

REVOKE ALL ON FUNCTION public.biblioteca_google_usuarios_desejados(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.biblioteca_google_arquivos_afetados(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enfileirar_biblioteca_google_arquivo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enfileirar_biblioteca_google_todos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_biblioteca_google_sync_fila(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.biblioteca_google_usuarios_desejados(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.biblioteca_google_arquivos_afetados(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enfileirar_biblioteca_google_arquivo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enfileirar_biblioteca_google_todos() TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_biblioteca_google_sync_fila(integer) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
