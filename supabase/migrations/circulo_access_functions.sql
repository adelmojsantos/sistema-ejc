-- ============================================================
-- FUNÇÕES PARA ACESSO PÚBLICO À FICHA PÓS-ENCONTRO POR CÍRCULO
-- Execute este arquivo inteiro no SQL Editor do Supabase
-- ============================================================


-- -------------------------------------------------------
-- FUNÇÃO 1: Retorna informações públicas de um círculo
-- (nome do círculo, mediadores e lista de participantes)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_circulo_public_info(
  p_circulo_id bigint,
  p_encontro_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_circulo_nome text;
  v_mediadores   json;
  v_participantes json;
BEGIN
  -- Busca o nome do círculo
  SELECT nome INTO v_circulo_nome
  FROM circulos
  WHERE id = p_circulo_id AND deleted_at IS NULL;

  IF v_circulo_nome IS NULL THEN
    RAISE EXCEPTION 'Círculo não encontrado';
  END IF;

  -- Busca os mediadores do círculo neste encontro
  SELECT json_agg(json_build_object('nome', pe.nome_completo) ORDER BY pe.nome_completo)
  INTO v_mediadores
  FROM circulo_participacao cp
  JOIN participacoes pa ON pa.id = cp.participacao
  JOIN pessoas pe ON pe.id = pa.pessoa_id
  WHERE cp.circulo_id = p_circulo_id
    AND cp.mediador = true
    AND pa.encontro_id = p_encontro_id;

  -- Busca os participantes (não-mediadores) — apenas nome e participacao_id (sem dados sensíveis)
  SELECT json_agg(
    json_build_object(
      'participacao_id', pa.id,
      'nome', pe.nome_completo
    )
    ORDER BY pe.nome_completo
  )
  INTO v_participantes
  FROM circulo_participacao cp
  JOIN participacoes pa ON pa.id = cp.participacao
  JOIN pessoas pe ON pe.id = pa.pessoa_id
  WHERE cp.circulo_id = p_circulo_id
    AND cp.mediador = false
    AND pa.encontro_id = p_encontro_id;

  RETURN json_build_object(
    'circulo_nome',  v_circulo_nome,
    'mediadores',    COALESCE(v_mediadores, '[]'::json),
    'participantes', COALESCE(v_participantes, '[]'::json)
  );
END;
$$;


-- -------------------------------------------------------
-- FUNÇÃO 2: Valida identidade do encontrista e gera token
-- (valida participacao_id no círculo + data_nascimento + 4 últimos dígitos do telefone)
-- Token válido por 24 horas
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_circulo_access(
  p_circulo_id      bigint,
  p_encontro_id     uuid,
  p_participacao_id uuid,
  p_data_nascimento date,
  p_telefone_fim    text   -- 4 últimos dígitos
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pessoa_id        uuid;
  v_pessoa_telefone  text;
  v_pessoa_nascimento date;
  v_token            uuid;
BEGIN
  -- 1. Confirma que a participação pertence a este círculo e encontro (apenas encontristas, não mediadores)
  SELECT pa.pessoa_id INTO v_pessoa_id
  FROM circulo_participacao cp
  JOIN participacoes pa ON pa.id = cp.participacao
  WHERE cp.circulo_id  = p_circulo_id
    AND cp.participacao = p_participacao_id
    AND pa.encontro_id  = p_encontro_id
    AND cp.mediador     = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dados inválidos';
  END IF;

  -- 2. Busca data de nascimento e telefone da pessoa
  SELECT data_nascimento, telefone
  INTO v_pessoa_nascimento, v_pessoa_telefone
  FROM pessoas
  WHERE id = v_pessoa_id;

  -- 3. Valida data de nascimento
  IF v_pessoa_nascimento IS NULL OR v_pessoa_nascimento != p_data_nascimento THEN
    RAISE EXCEPTION 'Dados inválidos';
  END IF;

  -- 4. Valida os 4 últimos dígitos do telefone (ignora caracteres não numéricos)
  IF RIGHT(REGEXP_REPLACE(COALESCE(v_pessoa_telefone, ''), '[^0-9]', '', 'g'), 4) !=
     RIGHT(REGEXP_REPLACE(p_telefone_fim, '[^0-9]', '', 'g'), 4) THEN
    RAISE EXCEPTION 'Dados inválidos';
  END IF;

  -- 5. Remove sessões antigas expiradas deste participante (limpeza)
  DELETE FROM external_sessions
  WHERE participacao_id = p_participacao_id
    AND expires_at < now();

  -- 6. Gera token UUID e insere sessão com validade de 24 horas
  v_token := gen_random_uuid();

  INSERT INTO external_sessions (participacao_id, encontro_id, token, expires_at)
  VALUES (p_participacao_id, p_encontro_id, v_token, now() + interval '24 hours');

  -- 7. Retorna o token como texto para o frontend
  RETURN v_token::text;
END;
$$;
