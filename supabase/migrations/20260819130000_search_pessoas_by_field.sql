-- Busca paginada de pessoas com regras específicas por tipo de dado.

BEGIN;

CREATE OR REPLACE FUNCTION public.search_pessoas_by_field(
  p_search_field text DEFAULT 'nome',
  p_search_term text DEFAULT '',
  p_encontro_id uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_field text := lower(btrim(COALESCE(p_search_field, '')));
  v_term text := btrim(COALESCE(p_search_term, ''));
  v_text_pattern text;
  v_email_pattern text;
  v_digits text;
  v_offset integer;
  v_result jsonb;
BEGIN
  IF v_field NOT IN ('nome', 'email', 'telefone', 'cpf', 'endereco') THEN
    RAISE EXCEPTION 'Filtro de busca inválido.' USING ERRCODE = '22023';
  END IF;

  IF p_page < 1 THEN
    RAISE EXCEPTION 'Página inválida.' USING ERRCODE = '22023';
  END IF;

  IF p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'Tamanho de página inválido.' USING ERRCODE = '22023';
  END IF;

  v_text_pattern := '%' || replace(
    replace(replace(unaccent(lower(v_term)), E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  ) || '%';
  v_email_pattern := '%' || replace(
    replace(replace(lower(v_term), E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  ) || '%';
  v_digits := regexp_replace(v_term, '\D', '', 'g');
  v_offset := (p_page - 1) * p_page_size;

  WITH filtered AS MATERIALIZED (
    SELECT person.*
    FROM public.pessoas person
    WHERE (
      p_encontro_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.participacoes participation
        WHERE participation.pessoa_id = person.id
          AND participation.encontro_id = p_encontro_id
      )
    )
      AND (
        v_term = ''
        OR CASE v_field
          WHEN 'nome' THEN
            unaccent(lower(COALESCE(person.nome_completo, ''))) LIKE v_text_pattern ESCAPE E'\\'
          WHEN 'email' THEN
            lower(COALESCE(person.email, '')) LIKE v_email_pattern ESCAPE E'\\'
          WHEN 'telefone' THEN
            v_digits <> ''
            AND regexp_replace(COALESCE(person.telefone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
          WHEN 'cpf' THEN
            v_digits <> ''
            AND regexp_replace(COALESCE(person.cpf, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
          WHEN 'endereco' THEN
            unaccent(lower(concat_ws(
              ' ',
              person.endereco,
              person.numero,
              person.complemento,
              person.bairro,
              person.cidade,
              person.estado,
              person.cep
            ))) LIKE v_text_pattern ESCAPE E'\\'
            OR (
              v_digits <> ''
              AND v_term !~ '[[:alpha:]]'
              AND (
                regexp_replace(COALESCE(person.cep, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
                OR regexp_replace(COALESCE(person.numero, ''), '\D', '', 'g') = v_digits
              )
            )
          ELSE false
        END
      )
  ), paged AS (
    SELECT filtered.*
    FROM filtered
    ORDER BY filtered.nome_completo, filtered.id
    OFFSET v_offset
    LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (SELECT jsonb_agg(to_jsonb(paged) ORDER BY paged.nome_completo, paged.id) FROM paged),
      '[]'::jsonb
    ),
    'count', (SELECT count(*) FROM filtered)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.search_pessoas_by_field(text, text, uuid, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_pessoas_by_field(text, text, uuid, integer, integer)
  TO authenticated;

COMMENT ON FUNCTION public.search_pessoas_by_field(text, text, uuid, integer, integer) IS
'Busca pessoas por um campo explicitamente permitido, respeitando RLS, encontro, paginação e normalização adequada.';

COMMIT;
