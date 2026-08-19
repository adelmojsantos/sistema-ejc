-- Separate approximate regional references from exact, navigation-safe coordinates.

BEGIN;

ALTER TABLE public.pessoas
  ADD COLUMN IF NOT EXISTS geo_reference_latitude numeric,
  ADD COLUMN IF NOT EXISTS geo_reference_longitude numeric,
  ADD COLUMN IF NOT EXISTS geo_reference_source text,
  ADD COLUMN IF NOT EXISTS geo_reference_precision text,
  ADD COLUMN IF NOT EXISTS geo_reference_address_fingerprint text,
  ADD COLUMN IF NOT EXISTS geo_reference_checked_at timestamptz;

ALTER TABLE public.pessoas
  ADD CONSTRAINT pessoas_geo_reference_pair_check
    CHECK ((geo_reference_latitude IS NULL) = (geo_reference_longitude IS NULL)) NOT VALID,
  ADD CONSTRAINT pessoas_geo_reference_range_check
    CHECK (
      geo_reference_latitude IS NULL
      OR (
        geo_reference_latitude BETWEEN -90 AND 90
        AND geo_reference_longitude BETWEEN -180 AND 180
        AND NOT (geo_reference_latitude = 0 AND geo_reference_longitude = 0)
      )
    ) NOT VALID,
  ADD CONSTRAINT pessoas_geo_reference_source_check
    CHECK (
      geo_reference_source IS NULL
      OR geo_reference_source IN ('nominatim', 'cepaberto', 'awesomeapi')
    ) NOT VALID,
  ADD CONSTRAINT pessoas_geo_reference_precision_check
    CHECK (
      geo_reference_precision IS NULL
      OR geo_reference_precision IN ('street', 'cep')
    ) NOT VALID,
  ADD CONSTRAINT pessoas_geo_reference_complete_check
    CHECK (
      geo_reference_latitude IS NULL
      OR (
        geo_reference_source IS NOT NULL
        AND geo_reference_precision IS NOT NULL
        AND geo_reference_address_fingerprint IS NOT NULL
        AND geo_reference_checked_at IS NOT NULL
      )
    ) NOT VALID;

CREATE INDEX IF NOT EXISTS pessoas_geo_reference_coordinates_idx
  ON public.pessoas (geo_reference_latitude, geo_reference_longitude)
  WHERE geo_reference_latitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_person_geolocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new_fingerprint text;
  v_old_fingerprint text;
  v_address_changed boolean := false;
BEGIN
  v_new_fingerprint := public.build_address_fingerprint(
    NEW.endereco,
    NEW.numero,
    NEW.complemento,
    NEW.cep,
    NEW.bairro,
    NEW.cidade,
    NEW.estado
  );

  IF TG_OP = 'UPDATE' THEN
    v_old_fingerprint := public.build_address_fingerprint(
      OLD.endereco,
      OLD.numero,
      OLD.complemento,
      OLD.cep,
      OLD.bairro,
      OLD.cidade,
      OLD.estado
    );
    v_address_changed := v_new_fingerprint IS DISTINCT FROM v_old_fingerprint;
  END IF;

  IF v_address_changed AND NOT (
    NEW.geo_status = 'verified'
    AND NEW.latitude IS NOT NULL
    AND NEW.longitude IS NOT NULL
    AND NEW.geo_address_fingerprint = v_new_fingerprint
  ) THEN
    NEW.latitude := NULL;
    NEW.longitude := NULL;
    NEW.geo_status := 'pending';
    NEW.geo_source := NULL;
    NEW.geo_precision := NULL;
    NEW.geo_accuracy_m := NULL;
    NEW.geo_checked_at := NULL;
    NEW.geo_verified_at := NULL;
    NEW.geo_verified_by := NULL;
    NEW.geo_failure_code := 'address_changed';
    NEW.geo_retry_count := 0;
    NEW.geo_next_retry_at := NULL;
  END IF;

  IF v_address_changed AND NOT (
    NEW.geo_reference_latitude IS NOT NULL
    AND NEW.geo_reference_longitude IS NOT NULL
    AND NEW.geo_reference_address_fingerprint = v_new_fingerprint
  ) THEN
    NEW.geo_reference_latitude := NULL;
    NEW.geo_reference_longitude := NULL;
    NEW.geo_reference_source := NULL;
    NEW.geo_reference_precision := NULL;
    NEW.geo_reference_address_fingerprint := NULL;
    NEW.geo_reference_checked_at := NULL;
  END IF;

  IF NEW.geo_status = 'verified' THEN
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RAISE EXCEPTION 'Localização verificada exige latitude e longitude.';
    END IF;
    IF NEW.geo_address_fingerprint IS DISTINCT FROM v_new_fingerprint THEN
      RAISE EXCEPTION 'A localização não corresponde ao endereço atual.';
    END IF;
    NEW.geo_checked_at := COALESCE(NEW.geo_checked_at, now());
    NEW.geo_verified_at := COALESCE(NEW.geo_verified_at, now());
    NEW.geo_verified_by := CASE
      WHEN NEW.geo_source IN ('gps', 'manual') THEN auth.uid()
      ELSE NULL
    END;
    NEW.geo_failure_code := NULL;
    NEW.geo_next_retry_at := NULL;
  ELSIF NEW.geo_status IN ('pending', 'failed') THEN
    NEW.latitude := NULL;
    NEW.longitude := NULL;
    NEW.geo_verified_at := NULL;
    NEW.geo_verified_by := NULL;
  END IF;

  IF NEW.geo_reference_latitude IS NULL OR NEW.geo_reference_longitude IS NULL THEN
    NEW.geo_reference_latitude := NULL;
    NEW.geo_reference_longitude := NULL;
    NEW.geo_reference_source := NULL;
    NEW.geo_reference_precision := NULL;
    NEW.geo_reference_address_fingerprint := NULL;
    NEW.geo_reference_checked_at := NULL;
  ELSE
    IF NEW.geo_reference_address_fingerprint IS DISTINCT FROM v_new_fingerprint THEN
      RAISE EXCEPTION 'A referência regional não corresponde ao endereço atual.';
    END IF;
    NEW.geo_reference_checked_at := COALESCE(NEW.geo_reference_checked_at, now());
  END IF;

  NEW.geo_address_fingerprint := v_new_fingerprint;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_person_geolocation_trigger ON public.pessoas;
CREATE TRIGGER protect_person_geolocation_trigger
BEFORE INSERT OR UPDATE OF
  endereco,
  numero,
  complemento,
  cep,
  bairro,
  cidade,
  estado,
  latitude,
  longitude,
  geo_status,
  geo_source,
  geo_precision,
  geo_accuracy_m,
  geo_address_fingerprint,
  geo_reference_latitude,
  geo_reference_longitude,
  geo_reference_source,
  geo_reference_precision,
  geo_reference_address_fingerprint,
  geo_reference_checked_at
ON public.pessoas
FOR EACH ROW
EXECUTE FUNCTION public.protect_person_geolocation();

CREATE OR REPLACE FUNCTION public.atualizar_endereco_visitacao_v2(
  p_participacao_id uuid,
  p_endereco jsonb
)
RETURNS public.pessoas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_pessoa_id uuid;
  v_pessoa public.pessoas%ROWTYPE;
BEGIN
  IF p_endereco IS NULL OR jsonb_typeof(p_endereco) <> 'object' THEN
    RAISE EXCEPTION 'Dados de endereço inválidos.';
  END IF;

  SELECT p.pessoa_id
  INTO v_pessoa_id
  FROM public.participacoes p
  WHERE p.id = p_participacao_id
    AND p.participante = true;

  IF v_pessoa_id IS NULL THEN
    RAISE EXCEPTION 'Participação de encontrista não encontrada.';
  END IF;

  IF NOT public.can_access_operational_participation(
    p_participacao_id,
    'modulo_visitacao',
    true
  ) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar o endereço deste encontrista.';
  END IF;

  UPDATE public.pessoas
  SET
    endereco = NULLIF(BTRIM(p_endereco ->> 'endereco'), ''),
    numero = NULLIF(BTRIM(p_endereco ->> 'numero'), ''),
    complemento = NULLIF(BTRIM(p_endereco ->> 'complemento'), ''),
    cep = NULLIF(regexp_replace(COALESCE(p_endereco ->> 'cep', ''), '\D', '', 'g'), ''),
    bairro = NULLIF(BTRIM(p_endereco ->> 'bairro'), ''),
    cidade = NULLIF(BTRIM(p_endereco ->> 'cidade'), ''),
    estado = NULLIF(upper(BTRIM(p_endereco ->> 'estado')), ''),
    latitude = NULLIF(p_endereco ->> 'latitude', '')::numeric,
    longitude = NULLIF(p_endereco ->> 'longitude', '')::numeric,
    geo_status = COALESCE(NULLIF(p_endereco ->> 'geo_status', ''), 'pending'),
    geo_source = NULLIF(p_endereco ->> 'geo_source', ''),
    geo_precision = NULLIF(p_endereco ->> 'geo_precision', ''),
    geo_accuracy_m = NULLIF(p_endereco ->> 'geo_accuracy_m', '')::numeric,
    geo_address_fingerprint = NULLIF(p_endereco ->> 'geo_address_fingerprint', ''),
    geo_checked_at = NULLIF(p_endereco ->> 'geo_checked_at', '')::timestamptz,
    geo_verified_at = NULLIF(p_endereco ->> 'geo_verified_at', '')::timestamptz,
    geo_verified_by = CASE
      WHEN p_endereco ->> 'geo_source' IN ('gps', 'manual') THEN auth.uid()
      ELSE NULL
    END,
    geo_failure_code = NULLIF(p_endereco ->> 'geo_failure_code', ''),
    geo_retry_count = COALESCE(NULLIF(p_endereco ->> 'geo_retry_count', '')::integer, 0),
    geo_next_retry_at = NULLIF(p_endereco ->> 'geo_next_retry_at', '')::timestamptz,
    geo_reference_latitude = CASE
      WHEN p_endereco ? 'geo_reference_latitude'
        THEN NULLIF(p_endereco ->> 'geo_reference_latitude', '')::numeric
      ELSE geo_reference_latitude
    END,
    geo_reference_longitude = CASE
      WHEN p_endereco ? 'geo_reference_longitude'
        THEN NULLIF(p_endereco ->> 'geo_reference_longitude', '')::numeric
      ELSE geo_reference_longitude
    END,
    geo_reference_source = CASE
      WHEN p_endereco ? 'geo_reference_source'
        THEN NULLIF(p_endereco ->> 'geo_reference_source', '')
      ELSE geo_reference_source
    END,
    geo_reference_precision = CASE
      WHEN p_endereco ? 'geo_reference_precision'
        THEN NULLIF(p_endereco ->> 'geo_reference_precision', '')
      ELSE geo_reference_precision
    END,
    geo_reference_address_fingerprint = CASE
      WHEN p_endereco ? 'geo_reference_address_fingerprint'
        THEN NULLIF(p_endereco ->> 'geo_reference_address_fingerprint', '')
      ELSE geo_reference_address_fingerprint
    END,
    geo_reference_checked_at = CASE
      WHEN p_endereco ? 'geo_reference_checked_at'
        THEN NULLIF(p_endereco ->> 'geo_reference_checked_at', '')::timestamptz
      ELSE geo_reference_checked_at
    END
  WHERE id = v_pessoa_id
  RETURNING * INTO v_pessoa;

  RETURN v_pessoa;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_endereco_visitacao_v2(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_endereco_visitacao_v2(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.atualizar_endereco_visitacao_v2(uuid, jsonb) IS
'Atualiza endereço, localização exata e referência regional sem misturar suas finalidades.';

COMMIT;
