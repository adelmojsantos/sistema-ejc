CREATE TABLE IF NOT EXISTS public.pesquisa_publicacao_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
  pesquisa_tipo text NOT NULL CHECK (pesquisa_tipo IN ('encontreiros', 'encontristas')),
  acao text NOT NULL CHECK (acao IN ('publicou', 'despublicou')),
  realizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  realizado_por_nome text,
  realizado_por_email text,
  realizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pesquisa_publicacao_auditoria_encontro_idx
  ON public.pesquisa_publicacao_auditoria (encontro_id, pesquisa_tipo, realizado_em DESC);

ALTER TABLE public.pesquisa_publicacao_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pesquisa_publicacao_auditoria FROM anon, authenticated;
GRANT SELECT ON public.pesquisa_publicacao_auditoria TO authenticated;

DROP POLICY IF EXISTS "Admins consultam auditoria de publicacao das pesquisas"
  ON public.pesquisa_publicacao_auditoria;
CREATE POLICY "Admins consultam auditoria de publicacao das pesquisas"
  ON public.pesquisa_publicacao_auditoria
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

INSERT INTO public.pesquisa_publicacao_auditoria (
  encontro_id, pesquisa_tipo, acao, realizado_em
)
SELECT encontro_id, 'encontreiros', 'publicou', publicada_em
FROM public.pesquisa_satisfacao_config
WHERE publicada = true
  AND publicada_em IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.pesquisa_publicacao_auditoria audit
    WHERE audit.encontro_id = pesquisa_satisfacao_config.encontro_id
      AND audit.pesquisa_tipo = 'encontreiros'
  );

INSERT INTO public.pesquisa_publicacao_auditoria (
  encontro_id, pesquisa_tipo, acao, realizado_em
)
SELECT encontro_id, 'encontristas', 'publicou', publicada_em
FROM public.pesquisa_encontrista_config
WHERE publicada = true
  AND publicada_em IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.pesquisa_publicacao_auditoria audit
    WHERE audit.encontro_id = pesquisa_encontrista_config.encontro_id
      AND audit.pesquisa_tipo = 'encontristas'
  );

CREATE OR REPLACE FUNCTION public.registrar_auditoria_publicacao_pesquisa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tipo text;
  v_nome text;
  v_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.publicada IS NOT DISTINCT FROM OLD.publicada THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.publicada = false THEN
    RETURN NEW;
  END IF;

  v_tipo := CASE TG_TABLE_NAME
    WHEN 'pesquisa_satisfacao_config' THEN 'encontreiros'
    WHEN 'pesquisa_encontrista_config' THEN 'encontristas'
    ELSE NULL
  END;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Tabela de pesquisa não suportada pela auditoria.';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(person.nome_completo), ''), NULLIF(BTRIM(profile.email), '')),
         NULLIF(BTRIM(profile.email), '')
    INTO v_nome, v_email
  FROM public.profiles profile
  LEFT JOIN public.pessoas person ON person.id = profile.pessoa_id
  WHERE profile.id = auth.uid();

  INSERT INTO public.pesquisa_publicacao_auditoria (
    encontro_id,
    pesquisa_tipo,
    acao,
    realizado_por,
    realizado_por_nome,
    realizado_por_email,
    realizado_em
  ) VALUES (
    NEW.encontro_id,
    v_tipo,
    CASE WHEN NEW.publicada THEN 'publicou' ELSE 'despublicou' END,
    auth.uid(),
    v_nome,
    v_email,
    now()
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_auditoria_publicacao_pesquisa() FROM PUBLIC;

DROP TRIGGER IF EXISTS pesquisa_satisfacao_publicacao_auditoria
  ON public.pesquisa_satisfacao_config;
CREATE TRIGGER pesquisa_satisfacao_publicacao_auditoria
AFTER INSERT OR UPDATE OF publicada ON public.pesquisa_satisfacao_config
FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_publicacao_pesquisa();

DROP TRIGGER IF EXISTS pesquisa_encontrista_publicacao_auditoria
  ON public.pesquisa_encontrista_config;
CREATE TRIGGER pesquisa_encontrista_publicacao_auditoria
AFTER INSERT OR UPDATE OF publicada ON public.pesquisa_encontrista_config
FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_publicacao_pesquisa();

COMMENT ON TABLE public.pesquisa_publicacao_auditoria IS
  'Histórico imutável de publicação e despublicação das pesquisas do encontro.';
