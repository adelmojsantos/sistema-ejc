-- Exclusão definitiva de pessoas restrita a administradores. O diagnóstico e
-- a exclusão usam a mesma regra de autorização e a operação destrutiva exige
-- confirmação pelo nome completo para reduzir exclusões acidentais.

CREATE OR REPLACE FUNCTION public.get_exclusao_pessoa_impacto(p_pessoa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_pessoa public.pessoas%ROWTYPE;
  v_usuario_vinculado boolean;
BEGIN
  IF NOT (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modulo_admin')
  ) THEN
    RAISE EXCEPTION 'Somente administradores podem excluir pessoas definitivamente'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pessoa
  FROM public.pessoas
  WHERE id = p_pessoa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pessoa não encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.pessoa_id = v_pessoa.id
       OR (
         profile.pessoa_id IS NULL
         AND NULLIF(btrim(v_pessoa.email), '') IS NOT NULL
         AND lower(btrim(profile.email)) = lower(btrim(v_pessoa.email))
       )
  ) INTO v_usuario_vinculado;

  RETURN jsonb_build_object(
    'pessoa_id', v_pessoa.id,
    'nome_completo', v_pessoa.nome_completo,
    'usuario_vinculado', v_usuario_vinculado,
    'participacoes', (SELECT count(*) FROM public.participacoes p WHERE p.pessoa_id = v_pessoa.id),
    'cancelamentos', (SELECT count(*) FROM public.participacoes_canceladas c WHERE c.pessoa_id = v_pessoa.id),
    'visitas', (
      SELECT count(*)
      FROM public.visita_participacao v
      JOIN public.participacoes p ON p.id = v.participacao_id
      WHERE p.pessoa_id = v_pessoa.id
    ),
    'circulos', (
      SELECT count(*)
      FROM public.circulo_participacao c
      JOIN public.participacoes p ON p.id = c.participacao
      WHERE p.pessoa_id = v_pessoa.id
    ),
    'recepcao', (
      SELECT count(*)
      FROM public.recepcao_dados r
      JOIN public.participacoes p ON p.id = r.participacao_id
      WHERE p.pessoa_id = v_pessoa.id
    ),
    'recreacao', (
      SELECT count(*)
      FROM public.recreacao_dados r
      LEFT JOIN public.participacoes principal ON principal.id = r.participacao_id
      LEFT JOIN public.participacoes secundario ON secundario.id = r.outro_responsavel_id
      WHERE principal.pessoa_id = v_pessoa.id OR secundario.pessoa_id = v_pessoa.id
    ),
    'dirigencia', (
      (SELECT count(*) FROM public.dirigencia_membros m WHERE m.pessoa_id = v_pessoa.id)
      +
      (
        SELECT count(*)
        FROM public.dirigencia_indicacoes i
        WHERE i.indicado_pessoa_id = v_pessoa.id
           OR i.indicador_membro_id IN (
             SELECT m.id
             FROM public.dirigencia_membros m
             WHERE m.pessoa_id = v_pessoa.id
           )
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_pessoa_definitivamente(
  p_pessoa_id uuid,
  p_nome_confirmacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_pessoa public.pessoas%ROWTYPE;
  v_impacto jsonb;
BEGIN
  IF NOT (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modulo_admin')
  ) THEN
    RAISE EXCEPTION 'Somente administradores podem excluir pessoas definitivamente'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pessoa
  FROM public.pessoas
  WHERE id = p_pessoa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pessoa não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF btrim(COALESCE(p_nome_confirmacao, '')) IS DISTINCT FROM btrim(v_pessoa.nome_completo) THEN
    RAISE EXCEPTION 'Digite o nome completo exatamente como exibido para confirmar a exclusão'
      USING ERRCODE = '22023';
  END IF;

  v_impacto := public.get_exclusao_pessoa_impacto(v_pessoa.id);

  IF COALESCE((v_impacto->>'usuario_vinculado')::boolean, false) THEN
    RAISE EXCEPTION 'Esta pessoa possui uma conta de acesso vinculada. Desvincule ou exclua o usuário antes de continuar'
      USING ERRCODE = '23503';
  END IF;

  -- A indicação referencia opcionalmente um membro como indicador. Remova as
  -- indicações da pessoa antes de apagar seus registros de membro dirigente.
  DELETE FROM public.dirigencia_indicacoes
  WHERE indicado_pessoa_id = v_pessoa.id
     OR indicador_membro_id IN (
       SELECT id FROM public.dirigencia_membros WHERE pessoa_id = v_pessoa.id
     );

  DELETE FROM public.dirigencia_membros
  WHERE pessoa_id = v_pessoa.id;

  DELETE FROM public.participacoes_canceladas
  WHERE pessoa_id = v_pessoa.id;

  -- visita_participacao é propositalmente RESTRICT. Os demais registros
  -- operacionais vinculados à participação usam CASCADE ou SET NULL.
  DELETE FROM public.visita_participacao visit
  USING public.participacoes participation
  WHERE visit.participacao_id = participation.id
    AND participation.pessoa_id = v_pessoa.id;

  DELETE FROM public.participacoes
  WHERE pessoa_id = v_pessoa.id;

  DELETE FROM public.pessoas
  WHERE id = v_pessoa.id;

  RETURN v_impacto || jsonb_build_object('excluida', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_exclusao_pessoa_impacto(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.excluir_pessoa_definitivamente(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exclusao_pessoa_impacto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_pessoa_definitivamente(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.excluir_pessoa_definitivamente(uuid, text) IS
  'Exclui definitivamente uma pessoa e seus históricos. Exclusivo para administradores e bloqueado para contas vinculadas.';
