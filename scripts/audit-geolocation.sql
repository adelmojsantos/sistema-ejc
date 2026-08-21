-- Auditoria agregada e não destrutiva da qualidade geográfica.
-- Não retorna dados pessoais nem coordenadas individuais.

WITH scoped_people AS (
  SELECT DISTINCT
    e.id AS encontro_id,
    e.nome AS encontro_nome,
    e.ativo,
    pe.id AS pessoa_id,
    NULLIF(BTRIM(pe.endereco), '') AS endereco,
    NULLIF(BTRIM(pe.numero), '') AS numero,
    NULLIF(BTRIM(pe.bairro), '') AS bairro,
    NULLIF(BTRIM(pe.cidade), '') AS cidade,
    NULLIF(BTRIM(pe.estado), '') AS estado,
    NULLIF(regexp_replace(COALESCE(pe.cep, ''), '\D', '', 'g'), '') AS cep,
    pe.latitude::double precision AS latitude,
    pe.longitude::double precision AS longitude
  FROM public.participacoes pa
  JOIN public.pessoas pe ON pe.id = pa.pessoa_id
  JOIN public.encontros e ON e.id = pa.encontro_id
),
coordinate_frequency AS (
  SELECT
    encontro_id,
    latitude,
    longitude,
    count(*) AS people_at_coordinate
  FROM scoped_people
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
  GROUP BY encontro_id, latitude, longitude
),
audited AS (
  SELECT
    scoped_people.*,
    COALESCE(coordinate_frequency.people_at_coordinate, 0) AS people_at_coordinate,
    CASE
      WHEN latitude IS NULL OR longitude IS NULL THEN NULL
      ELSE 6371 * 2 * asin(
        sqrt(
          power(sin(radians(latitude - (-20.5383)) / 2), 2)
          + cos(radians(-20.5383)) * cos(radians(latitude))
          * power(sin(radians(longitude - (-47.4008)) / 2), 2)
        )
      )
    END AS distance_from_reference_km
  FROM scoped_people
  LEFT JOIN coordinate_frequency USING (encontro_id, latitude, longitude)
)
SELECT
  encontro_id,
  encontro_nome,
  ativo,
  count(*) AS pessoas,
  count(*) FILTER (
    WHERE endereco IS NOT NULL
      AND numero IS NOT NULL
      AND cidade IS NOT NULL
      AND estado IS NOT NULL
  ) AS enderecos_completos,
  count(*) FILTER (
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  ) AS pares_coordenadas,
  count(*) FILTER (
    WHERE (latitude IS NULL) <> (longitude IS NULL)
  ) AS coordenadas_parciais,
  count(*) FILTER (
    WHERE latitude NOT BETWEEN -90 AND 90
       OR longitude NOT BETWEEN -180 AND 180
  ) AS coordenadas_fora_intervalo,
  count(*) FILTER (
    WHERE latitude = 0 AND longitude = 0
  ) AS coordenadas_zero,
  count(*) FILTER (
    WHERE distance_from_reference_km <= 0.25
  ) AS proximas_centro_referencia,
  count(*) FILTER (
    WHERE distance_from_reference_km > 100
  ) AS distantes_mais_100km,
  count(*) FILTER (
    WHERE people_at_coordinate > 1
  ) AS pessoas_em_coordenadas_duplicadas
FROM audited
GROUP BY encontro_id, encontro_nome, ativo
ORDER BY ativo DESC, encontro_nome;
