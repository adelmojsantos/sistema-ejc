-- Consolida respostas e preferências dos encontristas sem ampliar acesso direto
-- às tabelas sensíveis da pesquisa e da ficha pós-encontro.

CREATE OR REPLACE FUNCTION public.get_encontrista_team_preferences(
  p_encontro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modulo_cadastros')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para consultar as preferências dos encontristas.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'encontro', jsonb_build_object(
      'id', encontro.id,
      'nome', encontro.nome,
      'edicao', encontro.edicao,
      'dataInicio', encontro.data_inicio,
      'dataFim', encontro.data_fim
    ),
    'encontristas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'participacaoId', participacao.id,
          'pessoaId', participacao.pessoa_id,
          'nome', pessoa.nome_completo,
          'avaliacaoStatus', COALESCE(envio.status, 'pendente'),
          'respostas', COALESCE(envio.respostas, '{}'::jsonb),
          'enviadoEm', envio.enviado_em,
          'tocaInstrumento', COALESCE(ficha.toca_instrumento, false),
          'instrumentos', ficha.instrumentos,
          'temCarro', COALESCE(ficha.tem_carro, false),
          'temMoto', COALESCE(ficha.tem_moto, false),
          'observacoes', ficha.observacoes,
          'preferencias', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'equipeId', preferencia.equipe_id,
                'equipeNome', equipe.nome,
                'ordemPreferencia', preferencia.ordem_preferencia,
                'equipeDisponivel', equipe.deleted_at IS NULL
              )
              ORDER BY preferencia.ordem_preferencia
            )
            FROM public.pos_encontro_ficha_equipes preferencia
            JOIN public.equipes equipe ON equipe.id = preferencia.equipe_id
            WHERE preferencia.ficha_id = ficha.id
          ), '[]'::jsonb)
        )
        ORDER BY pessoa.nome_completo
      )
      FROM public.participacoes participacao
      JOIN public.pessoas pessoa ON pessoa.id = participacao.pessoa_id
      LEFT JOIN public.pesquisa_encontrista_envios envio
        ON envio.encontro_id = participacao.encontro_id
       AND envio.participacao_id = participacao.id
      LEFT JOIN public.pos_encontro_fichas ficha
        ON ficha.encontro_id = participacao.encontro_id
       AND ficha.participacao_id = participacao.id
      WHERE participacao.encontro_id = encontro.id
        AND participacao.participante = true
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.encontros encontro
  WHERE encontro.id = p_encontro_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Encontro não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_encontrista_team_preferences(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_encontrista_team_preferences(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_encontrista_team_preferences(uuid) IS
  'Retorna respostas e preferências de equipe dos encontristas para administração e montagem do encontro seguinte.';

NOTIFY pgrst, 'reload schema';
