-- Add provenance and quality controls for route-safe person coordinates.
-- Existing coordinates are preserved but classified for manual review.

BEGIN;

ALTER TABLE public.pessoas
  ADD COLUMN IF NOT EXISTS geo_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS geo_source text,
  ADD COLUMN IF NOT EXISTS geo_precision text,
  ADD COLUMN IF NOT EXISTS geo_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS geo_address_fingerprint text,
  ADD COLUMN IF NOT EXISTS geo_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo_verified_by uuid,
  ADD COLUMN IF NOT EXISTS geo_failure_code text,
  ADD COLUMN IF NOT EXISTS geo_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS geo_next_retry_at timestamptz;

CREATE OR REPLACE FUNCTION public.build_address_fingerprint(
  p_endereco text,
  p_numero text,
  p_complemento text,
  p_cep text,
  p_bairro text,
  p_cidade text,
  p_estado text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT md5(
    lower(
      regexp_replace(
        concat_ws('|',
          COALESCE(NULLIF(BTRIM(p_endereco), ''), ''),
          COALESCE(NULLIF(BTRIM(p_numero), ''), ''),
          COALESCE(NULLIF(BTRIM(p_complemento), ''), ''),
          COALESCE(NULLIF(regexp_replace(COALESCE(p_cep, ''), '\D', '', 'g'), ''), ''),
          COALESCE(NULLIF(BTRIM(p_bairro), ''), ''),
          COALESCE(NULLIF(BTRIM(p_cidade), ''), ''),
          COALESCE(upper(NULLIF(BTRIM(p_estado), '')), '')
        ),
        '\s+',
        ' ',
        'g'
      )
    )
  );
$$;

UPDATE public.pessoas
SET
  geo_status = CASE
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'legacy_review'
    ELSE 'pending'
  END,
  geo_source = CASE
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'legacy'
    ELSE NULL
  END,
  geo_precision = CASE
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'unknown'
    ELSE NULL
  END,
  geo_address_fingerprint = public.build_address_fingerprint(
    endereco,
    numero,
    complemento,
    cep,
    bairro,
    cidade,
    estado
  )
WHERE geo_address_fingerprint IS NULL;

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
  geo_address_fingerprint
ON public.pessoas
FOR EACH ROW
EXECUTE FUNCTION public.protect_person_geolocation();

ALTER TABLE public.pessoas
  ADD CONSTRAINT pessoas_geo_status_check
    CHECK (geo_status IN ('pending', 'verified', 'failed', 'legacy_review')) NOT VALID,
  ADD CONSTRAINT pessoas_geo_source_check
    CHECK (geo_source IS NULL OR geo_source IN ('nominatim', 'gps', 'manual', 'legacy')) NOT VALID,
  ADD CONSTRAINT pessoas_geo_precision_check
    CHECK (geo_precision IS NULL OR geo_precision IN ('house_number', 'gps', 'manual', 'unknown')) NOT VALID,
  ADD CONSTRAINT pessoas_geo_pair_check
    CHECK ((latitude IS NULL) = (longitude IS NULL)) NOT VALID,
  ADD CONSTRAINT pessoas_geo_range_check
    CHECK (
      latitude IS NULL
      OR (
        latitude BETWEEN -90 AND 90
        AND longitude BETWEEN -180 AND 180
        AND NOT (latitude = 0 AND longitude = 0)
      )
    ) NOT VALID,
  ADD CONSTRAINT pessoas_geo_accuracy_check
    CHECK (geo_accuracy_m IS NULL OR geo_accuracy_m > 0) NOT VALID,
  ADD CONSTRAINT pessoas_geo_verified_by_fkey
    FOREIGN KEY (geo_verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID,
  ADD CONSTRAINT pessoas_geo_retry_count_check
    CHECK (geo_retry_count >= 0) NOT VALID,
  ADD CONSTRAINT pessoas_geo_verified_check
    CHECK (
      geo_status <> 'verified'
      OR (
        latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND geo_source IS NOT NULL
        AND geo_precision IS NOT NULL
        AND geo_address_fingerprint IS NOT NULL
        AND geo_checked_at IS NOT NULL
        AND geo_verified_at IS NOT NULL
      )
    ) NOT VALID;

CREATE INDEX IF NOT EXISTS pessoas_geo_status_idx
  ON public.pessoas (geo_status);

CREATE TABLE IF NOT EXISTS public.geocoding_cache (
  address_fingerprint text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('verified', 'failed')),
  provider text,
  result jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.geocoding_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.geocoding_cache TO service_role;

CREATE INDEX IF NOT EXISTS geocoding_cache_expires_at_idx
  ON public.geocoding_cache (expires_at);

CREATE TABLE IF NOT EXISTS public.geocoding_provider_state (
  provider text PRIMARY KEY,
  next_allowed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geocoding_provider_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.geocoding_provider_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.geocoding_provider_state TO service_role;

CREATE OR REPLACE FUNCTION public.claim_geocoding_provider_slot(
  p_provider text,
  p_interval_ms integer
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_slot timestamptz;
BEGIN
  IF NULLIF(BTRIM(p_provider), '') IS NULL THEN
    RAISE EXCEPTION 'Provedor não informado.';
  END IF;

  IF p_interval_ms < 0 OR p_interval_ms > 60000 THEN
    RAISE EXCEPTION 'Intervalo inválido.';
  END IF;

  INSERT INTO public.geocoding_provider_state AS state (
    provider,
    next_allowed_at,
    updated_at
  )
  VALUES (
    BTRIM(p_provider),
    v_now + make_interval(secs => p_interval_ms::double precision / 1000),
    v_now
  )
  ON CONFLICT (provider) DO UPDATE
  SET
    next_allowed_at = GREATEST(state.next_allowed_at, v_now)
      + make_interval(secs => p_interval_ms::double precision / 1000),
    updated_at = v_now
  RETURNING next_allowed_at
    - make_interval(secs => p_interval_ms::double precision / 1000)
  INTO v_slot;

  RETURN v_slot;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_geocoding_provider_slot(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_geocoding_provider_slot(text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.build_address_fingerprint(text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.build_address_fingerprint(text, text, text, text, text, text, text) TO authenticated, service_role;

COMMENT ON COLUMN public.pessoas.geo_status IS
'Qualidade operacional da localização: apenas verified está apta para navegação.';
COMMENT ON COLUMN public.pessoas.geo_address_fingerprint IS
'Fingerprint do endereço ao qual a coordenada e seus metadados pertencem.';
COMMENT ON TABLE public.geocoding_cache IS
'Cache interno de geocodificação, sem vínculo com pessoa e inacessível ao cliente.';

COMMIT;
