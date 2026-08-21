BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(15);

SELECT extensions.is(
  public.build_address_fingerprint(
    ' Rua das Flores ', '10', NULL, '14400-000', 'Centro', 'Franca', 'sp'
  ),
  public.build_address_fingerprint(
    'rua das flores', '10', '', '14400000', 'centro', 'franca', 'SP'
  ),
  'fingerprint normaliza caixa, espaços e máscara do CEP'
);

SELECT extensions.isnt(
  public.build_address_fingerprint('Rua Um', NULL, '10', NULL, NULL, 'Franca', 'SP'),
  public.build_address_fingerprint('Rua Um', '10', NULL, NULL, NULL, 'Franca', 'SP'),
  'campos vazios preservam sua posição no fingerprint'
);

INSERT INTO public.pessoas (
  id, nome_completo, telefone, endereco, numero, cep, bairro, cidade, estado
)
VALUES (
  '3a000000-0000-0000-0000-000000000001',
  'Pessoa Geo Pendente',
  '16900000001',
  'Rua das Flores',
  '10',
  '14400000',
  'Centro',
  'Franca',
  'SP'
);

SELECT extensions.is(
  (SELECT geo_status FROM public.pessoas WHERE id = '3a000000-0000-0000-0000-000000000001'),
  'pending',
  'pessoa sem coordenadas inicia pendente'
);

UPDATE public.pessoas
SET
  latitude = -20.538,
  longitude = -47.401,
  geo_status = 'verified',
  geo_source = 'manual',
  geo_precision = 'manual',
  geo_address_fingerprint = public.build_address_fingerprint(
    endereco, numero, complemento, cep, bairro, cidade, estado
  ),
  geo_checked_at = now()
WHERE id = '3a000000-0000-0000-0000-000000000001';

SELECT extensions.ok(
  (SELECT
    geo_status = 'verified'
    AND latitude = -20.538
    AND longitude = -47.401
    AND geo_verified_at IS NOT NULL
   FROM public.pessoas
   WHERE id = '3a000000-0000-0000-0000-000000000001'),
  'ponto manual consistente é aceito e recebe data de verificação'
);

UPDATE public.pessoas
SET numero = '20'
WHERE id = '3a000000-0000-0000-0000-000000000001';

SELECT extensions.ok(
  (SELECT
    geo_status = 'pending'
    AND latitude IS NULL
    AND longitude IS NULL
    AND geo_failure_code = 'address_changed'
   FROM public.pessoas
   WHERE id = '3a000000-0000-0000-0000-000000000001'),
  'alterar endereço invalida coordenadas antigas'
);

SELECT extensions.throws_ok(
  $$UPDATE public.pessoas
    SET
      geo_status = 'verified',
      geo_source = 'manual',
      geo_precision = 'manual',
      geo_address_fingerprint = public.build_address_fingerprint(
        endereco, numero, complemento, cep, bairro, cidade, estado
      )
    WHERE id = '3a000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Localização verificada exige latitude e longitude.',
  'status verificado sem par de coordenadas é rejeitado'
);

SELECT extensions.throws_ok(
  $$UPDATE public.pessoas
    SET
      latitude = -20.538,
      longitude = -47.401,
      geo_status = 'verified',
      geo_source = 'manual',
      geo_precision = 'manual',
      geo_address_fingerprint = 'fingerprint-incorreto'
    WHERE id = '3a000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'A localização não corresponde ao endereço atual.',
  'coordenada de outra versão do endereço é rejeitada'
);

SELECT extensions.throws_ok(
  $$INSERT INTO public.pessoas (
      id, nome_completo, telefone, endereco, numero, cidade, estado,
      latitude, longitude, geo_status, geo_source, geo_precision,
      geo_address_fingerprint, geo_checked_at
    )
    VALUES (
      '3a000000-0000-0000-0000-000000000002',
      'Pessoa Geo Fora',
      '16900000002',
      'Rua Um',
      '1',
      'Franca',
      'SP',
      95,
      -47,
      'verified',
      'manual',
      'manual',
      public.build_address_fingerprint('Rua Um', '1', NULL, NULL, NULL, 'Franca', 'SP'),
      now()
    )$$,
  '23514',
  NULL,
  'novas coordenadas fora do intervalo são rejeitadas'
);

UPDATE public.pessoas
SET
  geo_reference_latitude = -20.54,
  geo_reference_longitude = -47.40,
  geo_reference_source = 'nominatim',
  geo_reference_precision = 'street',
  geo_reference_address_fingerprint = public.build_address_fingerprint(
    endereco, numero, complemento, cep, bairro, cidade, estado
  ),
  geo_reference_checked_at = now()
WHERE id = '3a000000-0000-0000-0000-000000000001';

SELECT extensions.ok(
  (SELECT
    geo_reference_latitude = -20.54
    AND geo_reference_longitude = -47.40
    AND geo_reference_precision = 'street'
   FROM public.pessoas
   WHERE id = '3a000000-0000-0000-0000-000000000001'),
  'referência regional de logradouro é persistida separadamente'
);

SELECT extensions.ok(
  (SELECT
    geo_status = 'pending'
    AND latitude IS NULL
    AND longitude IS NULL
   FROM public.pessoas
   WHERE id = '3a000000-0000-0000-0000-000000000001'),
  'referência aproximada não promove a localização para exata'
);

UPDATE public.pessoas
SET bairro = 'Outro Bairro'
WHERE id = '3a000000-0000-0000-0000-000000000001';

SELECT extensions.ok(
  (SELECT
    geo_reference_latitude IS NULL
    AND geo_reference_longitude IS NULL
    AND geo_reference_address_fingerprint IS NULL
   FROM public.pessoas
   WHERE id = '3a000000-0000-0000-0000-000000000001'),
  'alterar endereço invalida a referência regional antiga'
);

SELECT extensions.throws_ok(
  $$UPDATE public.pessoas
    SET
      geo_reference_latitude = -20.54,
      geo_reference_longitude = -47.40,
      geo_reference_source = 'nominatim',
      geo_reference_precision = 'street',
      geo_reference_address_fingerprint = 'fingerprint-incorreto',
      geo_reference_checked_at = now()
    WHERE id = '3a000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'A referência regional não corresponde ao endereço atual.',
  'referência regional de outra versão do endereço é rejeitada'
);

SELECT extensions.ok(
  public.claim_geocoding_provider_slot('nominatim-test', 1100) <= clock_timestamp(),
  'primeiro slot do provedor pode ser usado imediatamente'
);

SELECT extensions.ok(
  public.claim_geocoding_provider_slot('nominatim-test', 1100) > now(),
  'slot seguinte respeita o intervalo global'
);

SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT * FROM public.geocoding_cache$$,
  '42501',
  NULL,
  'cliente autenticado não lê o cache interno'
);

RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
