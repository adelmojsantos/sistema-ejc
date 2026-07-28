-- P0 security hardening for public flows.
-- Removes broad anonymous table access and exposes only purpose-built RPCs.

-- Existing external tokens were readable under the previous broad policy.
-- Invalidate them so every public user must authenticate again.
DELETE FROM public.external_sessions;

-- Quadrante policies that exposed complete rows (including sensitive columns).
DROP POLICY IF EXISTS "Allow public select active encounters" ON public.encontros;
DROP POLICY IF EXISTS "Allow public select participants of active encounters" ON public.participacoes;
DROP POLICY IF EXISTS "Allow public select people of active encounters" ON public.pessoas;
DROP POLICY IF EXISTS "Allow public select teams for quadrante" ON public.equipes;
DROP POLICY IF EXISTS "Allow public select circles for quadrante" ON public.circulos;
DROP POLICY IF EXISTS "Allow public select circle relationships" ON public.circulo_participacao;
DROP POLICY IF EXISTS "Allow public select team photos for active quadrantes" ON public.equipe_confirmacoes;
DROP POLICY IF EXISTS "Allow public select active circle mediator photos" ON public.circulo_mediadores_fotos;
DROP POLICY IF EXISTS "Permitir leitura pública de palestras para encontros ativos" ON public.palestras;

-- External form policies that were not bound to the caller's token.
DROP POLICY IF EXISTS "Allow public select by token" ON public.external_sessions;
DROP POLICY IF EXISTS "Allow public select teams" ON public.equipes;
DROP POLICY IF EXISTS "Allow public select participacoes of same encounter" ON public.participacoes;
DROP POLICY IF EXISTS "Allow public select people of same encounter" ON public.pessoas;
DROP POLICY IF EXISTS "Allow public to manage their recreacao_dados" ON public.recreacao_dados;
DROP POLICY IF EXISTS "Allow anon to select their recepcao_dados" ON public.recepcao_dados;
DROP POLICY IF EXISTS "Allow anon to insert their recepcao_dados" ON public.recepcao_dados;
DROP POLICY IF EXISTS "Allow anon to update their recepcao_dados" ON public.recepcao_dados;
DROP POLICY IF EXISTS "Allow anon to delete their recepcao_dados" ON public.recepcao_dados;

-- Defense in depth: anon can only reach these tables through SECURITY DEFINER RPCs.
REVOKE ALL ON TABLE public.external_sessions FROM anon;
REVOKE ALL ON TABLE public.recreacao_dados FROM anon;
REVOKE ALL ON TABLE public.recepcao_dados FROM anon;
REVOKE SELECT ON TABLE public.encontros FROM anon;
REVOKE SELECT ON TABLE public.participacoes FROM anon;
REVOKE SELECT ON TABLE public.pessoas FROM anon;
REVOKE SELECT ON TABLE public.equipes FROM anon;
REVOKE SELECT ON TABLE public.circulos FROM anon;
REVOKE SELECT ON TABLE public.circulo_participacao FROM anon;
REVOKE SELECT ON TABLE public.equipe_confirmacoes FROM anon;
REVOKE SELECT ON TABLE public.circulo_mediadores_fotos FROM anon;
REVOKE SELECT ON TABLE public.palestras FROM anon;

-- Preserve the existing authenticated application flows explicitly. RLS still
-- decides which rows each signed-in user can see; these grants only prevent the
-- public hardening from being interpreted as a privilege removal for that role.
GRANT SELECT ON TABLE public.encontros TO authenticated;
GRANT SELECT ON TABLE public.participacoes TO authenticated;
GRANT SELECT ON TABLE public.pessoas TO authenticated;
GRANT SELECT ON TABLE public.equipes TO authenticated;
GRANT SELECT ON TABLE public.circulos TO authenticated;
GRANT SELECT ON TABLE public.circulo_participacao TO authenticated;
GRANT SELECT ON TABLE public.equipe_confirmacoes TO authenticated;
GRANT SELECT ON TABLE public.circulo_mediadores_fotos TO authenticated;
GRANT SELECT ON TABLE public.palestras TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_active_registration()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'id', e.id,
        'nome', e.nome,
        'edicao', e.edicao,
        'data_inicio', e.data_inicio,
        'data_fim', e.data_fim,
        'local', e.local,
        'ativo', e.ativo,
        'limite_vagas_online', e.limite_vagas_online
      )
      FROM public.encontros e
      WHERE e.ativo = true
      LIMIT 1
    ),
    'null'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.get_external_form_context(p_encontro_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'encontro', jsonb_build_object(
          'id', e.id,
          'nome', e.nome,
          'data_inicio', e.data_inicio,
          'formulario_publico_ativo', e.formulario_publico_ativo
        ),
        'equipes', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object('id', eq.id, 'nome', eq.nome)
              ORDER BY eq.nome
            )
            FROM public.equipes eq
            WHERE eq.deleted_at IS NULL
              AND EXISTS (
                SELECT 1
                FROM public.participacoes pa
                WHERE pa.encontro_id = e.id
                  AND pa.equipe_id = eq.id
              )
          ),
          '[]'::jsonb
        )
      )
      FROM public.encontros e
      WHERE e.id = p_encontro_id
        AND e.formulario_publico_ativo = true
      LIMIT 1
    ),
    'null'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_external_access(
  p_encontro_id uuid,
  p_equipe_id uuid,
  p_nome text,
  p_telefone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participacao_id uuid;
  v_token uuid;
  v_clean_telefone text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.encontros e
    WHERE e.id = p_encontro_id
      AND e.formulario_publico_ativo = true
  ) THEN
    RAISE EXCEPTION 'Formulário não está ativo para este encontro.';
  END IF;

  v_clean_telefone := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');

  -- Do not accept one or two guessed digits as a valid phone credential.
  IF length(v_clean_telefone) < 8 OR length(v_clean_telefone) > 11 THEN
    RAISE EXCEPTION 'Não foi possível validar seus dados.';
  END IF;

  SELECT pa.id
  INTO v_participacao_id
  FROM public.participacoes pa
  JOIN public.pessoas pe ON pe.id = pa.pessoa_id
  WHERE pa.encontro_id = p_encontro_id
    AND pa.equipe_id = p_equipe_id
    AND unaccent(pe.nome_completo) ILIKE '%' || unaccent(BTRIM(p_nome)) || '%'
    AND right(
      regexp_replace(COALESCE(pe.telefone, ''), '\D', '', 'g'),
      length(v_clean_telefone)
    ) = v_clean_telefone
  LIMIT 1;

  IF v_participacao_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível validar seus dados.';
  END IF;

  DELETE FROM public.external_sessions
  WHERE participacao_id = v_participacao_id;

  INSERT INTO public.external_sessions (
    participacao_id,
    encontro_id,
    expires_at
  )
  VALUES (
    v_participacao_id,
    p_encontro_id,
    now() + interval '2 hours'
  )
  RETURNING token INTO v_token;

  RETURN v_token;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'Formulário não está ativo para este encontro.' THEN
      RAISE EXCEPTION '%', SQLERRM;
    END IF;
    RAISE EXCEPTION 'Não foi possível validar seus dados.';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_external_session(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'id', es.id,
        'participacao_id', es.participacao_id,
        'encontro_id', es.encontro_id,
        'token', es.token,
        'expires_at', es.expires_at,
        'participacoes', jsonb_build_object(
          'pessoa_id', pa.pessoa_id,
          'equipe_id', pa.equipe_id,
          'dados_confirmados', pa.dados_confirmados,
          'pessoas', jsonb_build_object('nome_completo', pe.nome_completo),
          'equipes', CASE
            WHEN eq.id IS NULL THEN NULL
            ELSE jsonb_build_object('nome', eq.nome)
          END
        )
      )
      FROM public.external_sessions es
      JOIN public.participacoes pa
        ON pa.id = es.participacao_id
       AND pa.encontro_id = es.encontro_id
      JOIN public.pessoas pe ON pe.id = pa.pessoa_id
      LEFT JOIN public.equipes eq ON eq.id = pa.equipe_id
      WHERE es.token = p_token
        AND es.expires_at > now()
      LIMIT 1
    ),
    'null'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.get_external_recepcao(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT to_jsonb(rd)
      FROM public.external_sessions es
      JOIN public.recepcao_dados rd ON rd.participacao_id = es.participacao_id
      WHERE es.token = p_token
        AND es.expires_at > now()
      LIMIT 1
    ),
    'null'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.save_external_recepcao(
  p_token uuid,
  p_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participacao_id uuid;
  v_row public.recepcao_dados%ROWTYPE;
  v_tipo text;
  v_modelo text;
  v_cor text;
  v_placa text;
BEGIN
  SELECT es.participacao_id
  INTO v_participacao_id
  FROM public.external_sessions es
  WHERE es.token = p_token
    AND es.expires_at > now();

  IF v_participacao_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.';
  END IF;

  v_tipo := NULLIF(BTRIM(p_data ->> 'veiculo_tipo'), '');
  v_modelo := NULLIF(BTRIM(p_data ->> 'veiculo_modelo'), '');
  v_cor := NULLIF(BTRIM(p_data ->> 'veiculo_cor'), '');
  v_placa := NULLIF(UPPER(BTRIM(p_data ->> 'veiculo_placa')), '');

  IF v_tipo NOT IN ('moto', 'carro')
     OR v_modelo IS NULL
     OR v_cor IS NULL
     OR v_placa IS NULL THEN
    RAISE EXCEPTION 'Dados do veículo inválidos.';
  END IF;

  INSERT INTO public.recepcao_dados (
    participacao_id,
    veiculo_tipo,
    veiculo_modelo,
    veiculo_cor,
    veiculo_placa
  )
  VALUES (
    v_participacao_id,
    v_tipo,
    LEFT(v_modelo, 120),
    LEFT(v_cor, 80),
    LEFT(v_placa, 10)
  )
  ON CONFLICT (participacao_id)
  DO UPDATE SET
    veiculo_tipo = EXCLUDED.veiculo_tipo,
    veiculo_modelo = EXCLUDED.veiculo_modelo,
    veiculo_cor = EXCLUDED.veiculo_cor,
    veiculo_placa = EXCLUDED.veiculo_placa
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_external_recepcao(
  p_token uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.recepcao_dados rd
  USING public.external_sessions es
  WHERE rd.id = p_id
    AND rd.participacao_id = es.participacao_id
    AND es.token = p_token
    AND es.expires_at > now();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_external_recreacao_context(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'encontro', jsonb_build_object(
          'id', e.id,
          'nome', e.nome,
          'data_inicio', e.data_inicio
        ),
        'equipes', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object('id', eq.id, 'nome', eq.nome)
              ORDER BY eq.nome
            )
            FROM public.equipes eq
            WHERE eq.deleted_at IS NULL
              AND EXISTS (
                SELECT 1
                FROM public.participacoes pa2
                WHERE pa2.encontro_id = es.encontro_id
                  AND pa2.equipe_id = eq.id
              )
          ),
          '[]'::jsonb
        ),
        'participantes', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', pa2.id,
                'equipe_id', pa2.equipe_id,
                'pessoas', jsonb_build_object('nome_completo', pe.nome_completo),
                'equipes', CASE
                  WHEN eq.id IS NULL THEN NULL
                  ELSE jsonb_build_object('nome', eq.nome)
                END
              )
              ORDER BY pe.nome_completo
            )
            FROM public.participacoes pa2
            JOIN public.pessoas pe ON pe.id = pa2.pessoa_id
            LEFT JOIN public.equipes eq ON eq.id = pa2.equipe_id
            WHERE pa2.encontro_id = es.encontro_id
          ),
          '[]'::jsonb
        ),
        'criancas', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', rd.id,
                'participacao_id', rd.participacao_id,
                'nome_crianca', rd.nome_crianca,
                'data_nascimento', rd.data_nascimento,
                'idade', rd.idade,
                'outro_responsavel_id', rd.outro_responsavel_id,
                'observacoes', rd.observacoes,
                'created_at', rd.created_at,
                'updated_at', rd.updated_at,
                'participacoes', jsonb_build_object(
                  'equipe_id', owner_pa.equipe_id,
                  'pessoas', jsonb_build_object('nome_completo', owner_pe.nome_completo),
                  'equipes', CASE
                    WHEN owner_eq.id IS NULL THEN NULL
                    ELSE jsonb_build_object('nome', owner_eq.nome)
                  END
                ),
                'outro_responsavel', CASE
                  WHEN other_pa.id IS NULL THEN NULL
                  ELSE jsonb_build_object(
                    'id', other_pa.id,
                    'equipe_id', other_pa.equipe_id,
                    'pessoas', jsonb_build_object('nome_completo', other_pe.nome_completo),
                    'equipes', CASE
                      WHEN other_eq.id IS NULL THEN NULL
                      ELSE jsonb_build_object('nome', other_eq.nome)
                    END
                  )
                END
              )
              ORDER BY rd.created_at
            )
            FROM public.recreacao_dados rd
            JOIN public.participacoes owner_pa ON owner_pa.id = rd.participacao_id
            JOIN public.pessoas owner_pe ON owner_pe.id = owner_pa.pessoa_id
            LEFT JOIN public.equipes owner_eq ON owner_eq.id = owner_pa.equipe_id
            LEFT JOIN public.participacoes other_pa ON other_pa.id = rd.outro_responsavel_id
            LEFT JOIN public.pessoas other_pe ON other_pe.id = other_pa.pessoa_id
            LEFT JOIN public.equipes other_eq ON other_eq.id = other_pa.equipe_id
            WHERE rd.deleted_at IS NULL
              AND (
                rd.participacao_id = es.participacao_id
                OR rd.outro_responsavel_id = es.participacao_id
              )
          ),
          '[]'::jsonb
        )
      )
      FROM public.external_sessions es
      JOIN public.encontros e ON e.id = es.encontro_id
      WHERE es.token = p_token
        AND es.expires_at > now()
      LIMIT 1
    ),
    'null'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.get_external_teams(
  p_token uuid,
  p_only_pos_encontro boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object('id', eq.id, 'nome', eq.nome)
        ORDER BY eq.nome
      )
      FROM public.external_sessions es
      JOIN public.equipes eq
        ON eq.deleted_at IS NULL
       AND (NOT p_only_pos_encontro OR eq.aparece_pos_encontro = true)
      WHERE es.token = p_token
        AND es.expires_at > now()
        AND EXISTS (
          SELECT 1
          FROM public.participacoes pa
          WHERE pa.encontro_id = es.encontro_id
            AND pa.equipe_id = eq.id
        )
    ),
    '[]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.save_external_recreacao(
  p_token uuid,
  p_id uuid,
  p_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participacao_id uuid;
  v_encontro_id uuid;
  v_outro_responsavel_id uuid;
  v_nome text;
  v_data_nascimento date;
  v_idade integer;
  v_observacoes text;
  v_row public.recreacao_dados%ROWTYPE;
BEGIN
  SELECT es.participacao_id, es.encontro_id
  INTO v_participacao_id, v_encontro_id
  FROM public.external_sessions es
  WHERE es.token = p_token
    AND es.expires_at > now();

  IF v_participacao_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.';
  END IF;

  v_nome := NULLIF(BTRIM(p_data ->> 'nome_crianca'), '');
  v_data_nascimento := NULLIF(p_data ->> 'data_nascimento', '')::date;
  v_idade := COALESCE(NULLIF(p_data ->> 'idade', '')::integer, 0);
  v_observacoes := NULLIF(BTRIM(p_data ->> 'observacoes'), '');
  v_outro_responsavel_id := NULLIF(p_data ->> 'outro_responsavel_id', '')::uuid;

  IF v_nome IS NULL OR v_data_nascimento IS NULL OR v_idade < 0 OR v_idade > 17 THEN
    RAISE EXCEPTION 'Dados da criança inválidos.';
  END IF;

  IF v_outro_responsavel_id IS NOT NULL THEN
    IF v_outro_responsavel_id = v_participacao_id OR NOT EXISTS (
      SELECT 1
      FROM public.participacoes pa
      WHERE pa.id = v_outro_responsavel_id
        AND pa.encontro_id = v_encontro_id
    ) THEN
      RAISE EXCEPTION 'Segundo responsável inválido.';
    END IF;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.recreacao_dados (
      participacao_id,
      nome_crianca,
      data_nascimento,
      idade,
      outro_responsavel_id,
      observacoes
    )
    VALUES (
      v_participacao_id,
      LEFT(v_nome, 160),
      v_data_nascimento,
      v_idade,
      v_outro_responsavel_id,
      LEFT(v_observacoes, 2000)
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.recreacao_dados rd
    SET
      nome_crianca = LEFT(v_nome, 160),
      data_nascimento = v_data_nascimento,
      idade = v_idade,
      outro_responsavel_id = v_outro_responsavel_id,
      observacoes = LEFT(v_observacoes, 2000)
    WHERE rd.id = p_id
      AND rd.participacao_id = v_participacao_id
      AND rd.deleted_at IS NULL
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'Cadastro não encontrado ou sem permissão.';
    END IF;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_external_recreacao(
  p_token uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.recreacao_dados rd
  SET deleted_at = now()
  FROM public.external_sessions es
  WHERE rd.id = p_id
    AND rd.participacao_id = es.participacao_id
    AND rd.deleted_at IS NULL
    AND es.token = p_token
    AND es.expires_at > now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quadrante_public_payload(
  p_token uuid,
  p_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encontro public.encontros%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT e.*
  INTO v_encontro
  FROM public.encontros e
  WHERE e.quadrante_token = p_token
    AND e.quadrante_ativo = true
    AND (
      e.quadrante_pin IS NULL
      OR e.quadrante_pin = ''
      OR e.quadrante_pin = p_pin
    )
  LIMIT 1;

  IF v_encontro.id IS NULL THEN
    RAISE EXCEPTION 'Quadrante inválido, inativo ou código incorreto.';
  END IF;

  SELECT jsonb_build_object(
    'encontro', jsonb_build_object(
      'id', e.id,
      'nome', e.nome,
      'tema', e.tema,
      'data_inicio', e.data_inicio,
      'data_fim', e.data_fim,
      'local', e.local,
      'edicao', e.edicao,
      'quadrante_ativo', e.quadrante_ativo,
      'logo_url', e.logo_url,
      'simbologia_texto', e.simbologia_texto,
      'tematica_texto', e.tematica_texto,
      'musica', e.musica,
      'musica_letra', e.musica_letra,
      'link_youtube', e.link_youtube,
      'link_musica', e.link_musica,
      'quadrante_visibilidade', e.quadrante_visibilidade
    ),
    'participacoes', COALESCE(
      (
        SELECT jsonb_agg(item.payload ORDER BY item.nome)
        FROM (
          SELECT
            pe.nome_completo AS nome,
            jsonb_build_object(
              'id', pa.id,
              'foto_url', pa.foto_url,
              'foto_posicao_y', pa.foto_posicao_y,
              'participante', pa.participante,
              'equipe_id', pa.equipe_id,
              'pessoas', jsonb_build_object('nome_completo', pe.nome_completo),
              'equipes', CASE
                WHEN eq.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                  'nome', eq.nome,
                  'foto_url', COALESCE(ec.foto_url, eq.foto_url),
                  'foto_posicao_y', COALESCE(ec.foto_posicao_y, 50)
                )
              END,
              'circulo_participacao', CASE
                WHEN ci.id IS NULL THEN '[]'::jsonb
                ELSE jsonb_build_array(
                  jsonb_build_object(
                    'circulos', jsonb_build_object(
                      'id', ci.id,
                      'nome', ci.nome,
                      'imagem_url', ci.imagem_url
                    )
                  )
                )
              END,
              'circulo_mediadores_foto', CASE
                WHEN cmf.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                  'foto_url', cmf.foto_url,
                  'foto_posicao_y', cmf.foto_posicao_y
                )
              END,
              'recreacao_criancas_foto', CASE
                WHEN pa.participante = false
                  AND ec.criancas_recreacao_foto_url IS NOT NULL
                THEN jsonb_build_object(
                  'foto_url', ec.criancas_recreacao_foto_url,
                  'foto_posicao_y', ec.criancas_recreacao_foto_posicao_y
                )
                ELSE NULL
              END
            ) AS payload
          FROM public.participacoes pa
          JOIN public.pessoas pe ON pe.id = pa.pessoa_id
          LEFT JOIN public.equipes eq ON eq.id = pa.equipe_id
          LEFT JOIN public.equipe_confirmacoes ec
            ON ec.encontro_id = pa.encontro_id
           AND ec.equipe_id = pa.equipe_id
          LEFT JOIN public.circulo_participacao cp ON cp.participacao = pa.id
          LEFT JOIN public.circulos ci ON ci.id = cp.circulo_id
          LEFT JOIN public.circulo_mediadores_fotos cmf
            ON cmf.encontro_id = pa.encontro_id
           AND cmf.circulo_id = ci.id
          WHERE pa.encontro_id = e.id
        ) item
      ),
      '[]'::jsonb
    ),
    'palestras', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'encontro_id', p.encontro_id,
            'pessoa_id', p.pessoa_id,
            'titulo', p.titulo,
            'palestrante_nome', p.palestrante_nome,
            'palestrante_foto_url', p.palestrante_foto_url,
            'palestrante_foto_posicao_y', p.palestrante_foto_posicao_y,
            'resumo', p.resumo,
            'ordem', p.ordem
          )
          ORDER BY p.ordem
        )
        FROM public.palestras p
        WHERE p.encontro_id = e.id
      ),
      '[]'::jsonb
    ),
    'criancas', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', rd.id,
            'nome_crianca', rd.nome_crianca,
            'participacoes', jsonb_build_object(
              'pessoas', jsonb_build_object('nome_completo', owner_pe.nome_completo),
              'equipes', CASE
                WHEN owner_eq.id IS NULL THEN NULL
                ELSE jsonb_build_object('nome', owner_eq.nome)
              END
            ),
            'outro_responsavel', CASE
              WHEN other_pa.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'pessoas', jsonb_build_object('nome_completo', other_pe.nome_completo),
                'equipes', CASE
                  WHEN other_eq.id IS NULL THEN NULL
                  ELSE jsonb_build_object('nome', other_eq.nome)
                END
              )
            END
          )
          ORDER BY rd.nome_crianca
        )
        FROM public.recreacao_dados rd
        JOIN public.participacoes owner_pa ON owner_pa.id = rd.participacao_id
        JOIN public.pessoas owner_pe ON owner_pe.id = owner_pa.pessoa_id
        LEFT JOIN public.equipes owner_eq ON owner_eq.id = owner_pa.equipe_id
        LEFT JOIN public.participacoes other_pa ON other_pa.id = rd.outro_responsavel_id
        LEFT JOIN public.pessoas other_pe ON other_pe.id = other_pa.pessoa_id
        LEFT JOIN public.equipes other_eq ON other_eq.id = other_pa.equipe_id
        WHERE owner_pa.encontro_id = e.id
          AND rd.deleted_at IS NULL
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.encontros e
  WHERE e.id = v_encontro.id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_active_registration() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_external_form_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_external_access(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_external_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_external_recepcao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_external_recepcao(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_external_recepcao(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_external_recreacao_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_external_teams(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_external_recreacao(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_external_recreacao(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_quadrante_public_payload(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_active_registration() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_external_form_context(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_external_access(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_external_session(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_external_recepcao(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_external_recepcao(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_external_recepcao(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_external_recreacao_context(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_external_teams(uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_external_recreacao(uuid, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_external_recreacao(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quadrante_public_payload(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
