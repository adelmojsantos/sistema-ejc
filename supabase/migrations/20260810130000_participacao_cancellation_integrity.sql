-- Protege o fluxo de inscrição e torna o cancelamento de participação reversível.

CREATE OR REPLACE FUNCTION public.prevent_repeated_encontrista()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.participante, false)
     AND EXISTS (
       SELECT 1
       FROM public.participacoes previous_participation
       WHERE previous_participation.pessoa_id = NEW.pessoa_id
         AND previous_participation.participante = true
         AND previous_participation.id <> NEW.id
     ) THEN
    RAISE EXCEPTION 'Esta pessoa já participou do EJC como encontrista';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_repeated_encontrista ON public.participacoes;
CREATE TRIGGER prevent_repeated_encontrista
BEFORE INSERT OR UPDATE OF pessoa_id, participante ON public.participacoes
FOR EACH ROW EXECUTE FUNCTION public.prevent_repeated_encontrista();

-- A inscrição pública não pode recriar uma solicitação quando a pessoa já está
-- na lista (inclusive reprovada) ou já possui participação no mesmo encontro.
CREATE OR REPLACE FUNCTION public.check_duplicate_registration(
  p_encontro_id uuid,
  p_email varchar,
  p_cpf varchar,
  p_telefone varchar
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lista_espera waitlist
    WHERE waitlist.encontro_id = p_encontro_id
      AND (
        (NULLIF(btrim(p_email), '') IS NOT NULL AND lower(waitlist.email) = lower(btrim(p_email)))
        OR (NULLIF(regexp_replace(COALESCE(p_cpf, ''), '\\D', '', 'g'), '') IS NOT NULL
            AND regexp_replace(COALESCE(waitlist.cpf, ''), '\\D', '', 'g') = regexp_replace(p_cpf, '\\D', '', 'g'))
        OR (NULLIF(regexp_replace(COALESCE(p_telefone, ''), '\\D', '', 'g'), '') IS NOT NULL
            AND regexp_replace(COALESCE(waitlist.telefone, ''), '\\D', '', 'g') = regexp_replace(p_telefone, '\\D', '', 'g'))
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.participacoes participation
    JOIN public.pessoas person ON person.id = participation.pessoa_id
    WHERE participation.encontro_id = p_encontro_id
      AND (
        (NULLIF(btrim(p_email), '') IS NOT NULL AND lower(person.email) = lower(btrim(p_email)))
        OR (NULLIF(regexp_replace(COALESCE(p_cpf, ''), '\\D', '', 'g'), '') IS NOT NULL
            AND regexp_replace(COALESCE(person.cpf, ''), '\\D', '', 'g') = regexp_replace(p_cpf, '\\D', '', 'g'))
        OR (NULLIF(regexp_replace(COALESCE(p_telefone, ''), '\\D', '', 'g'), '') IS NOT NULL
            AND regexp_replace(COALESCE(person.telefone, ''), '\\D', '', 'g') = regexp_replace(p_telefone, '\\D', '', 'g'))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.cancelar_participacao(
  p_participacao_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participacao public.participacoes%ROWTYPE;
  v_motivo text := btrim(COALESCE(p_motivo, ''));
  v_is_admin_or_secretaria boolean;
  v_can_manage_visitation boolean;
  v_grupo_id uuid;
  v_status_visita text;
  v_snapshot jsonb;
  v_cancelamento_id uuid;
  v_encontro_ativo boolean;
BEGIN
  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento (mínimo de 5 caracteres)';
  END IF;

  SELECT * INTO v_participacao
  FROM public.participacoes
  WHERE id = p_participacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participação não encontrada';
  END IF;

  SELECT ativo INTO v_encontro_ativo
  FROM public.encontros
  WHERE id = v_participacao.encontro_id;

  IF COALESCE(v_encontro_ativo, false) = false THEN
    RAISE EXCEPTION 'Cancelamentos só podem ser feitos no encontro ativo';
  END IF;

  v_is_admin_or_secretaria := public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_secretaria');

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    JOIN public.pessoas visitor_person ON lower(visitor_person.email) = lower(profile.email)
    JOIN public.participacoes visitor_participation
      ON visitor_participation.pessoa_id = visitor_person.id
     AND visitor_participation.encontro_id = v_participacao.encontro_id
    JOIN public.visita_participacao visitor_link
      ON visitor_link.participacao_id = visitor_participation.id
     AND visitor_link.visitante = true
    JOIN public.visita_participacao target_link
      ON target_link.grupo_id = visitor_link.grupo_id
     AND target_link.participacao_id = v_participacao.id
     AND target_link.visitante = false
    WHERE profile.id = auth.uid()
      AND public.has_permission(auth.uid(), 'modulo_visitacao_duplas')
  ) INTO v_can_manage_visitation;

  IF NOT v_is_admin_or_secretaria AND NOT (v_participacao.participante = true AND v_can_manage_visitation) THEN
    RAISE EXCEPTION 'Você não possui permissão para cancelar esta participação';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.participacoes_canceladas cancellation
    WHERE cancellation.pessoa_id = v_participacao.pessoa_id
      AND cancellation.encontro_id = v_participacao.encontro_id
      AND cancellation.revertido_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Esta participação já possui um cancelamento ativo';
  END IF;

  SELECT link.grupo_id, link.status::text
  INTO v_grupo_id, v_status_visita
  FROM public.visita_participacao link
  WHERE link.participacao_id = v_participacao.id
    AND link.visitante = false
  ORDER BY link.created_at
  LIMIT 1;

  SELECT jsonb_build_object(
    'version', 2,
    'participacao', to_jsonb(v_participacao),
    'visitas', COALESCE((SELECT jsonb_agg(to_jsonb(link)) FROM public.visita_participacao link WHERE link.participacao_id = v_participacao.id), '[]'::jsonb),
    'intencoes_camiseta', COALESCE((SELECT jsonb_agg(to_jsonb(intent)) FROM public.visita_intencao_camiseta intent JOIN public.visita_participacao link ON link.id = intent.visita_id WHERE link.participacao_id = v_participacao.id), '[]'::jsonb),
    'circulos', COALESCE((SELECT jsonb_agg(to_jsonb(circle_link)) FROM public.circulo_participacao circle_link WHERE circle_link.participacao = v_participacao.id), '[]'::jsonb),
    'camisetas', COALESCE((SELECT jsonb_agg(to_jsonb(order_item)) FROM public.camiseta_pedidos order_item WHERE order_item.participacao_id = v_participacao.id), '[]'::jsonb),
    'recepcao', COALESCE((SELECT jsonb_agg(to_jsonb(reception)) FROM public.recepcao_dados reception WHERE reception.participacao_id = v_participacao.id), '[]'::jsonb),
    'recreacao', COALESCE((SELECT jsonb_agg(to_jsonb(recreation)) FROM public.recreacao_dados recreation WHERE recreation.participacao_id = v_participacao.id OR recreation.outro_responsavel_id = v_participacao.id), '[]'::jsonb),
    'presencas', COALESCE((SELECT jsonb_agg(to_jsonb(attendance)) FROM public.encontro_presencas attendance WHERE attendance.participacao_id = v_participacao.id), '[]'::jsonb)
  ) INTO v_snapshot;

  INSERT INTO public.participacoes_canceladas (
    pessoa_id, encontro_id, grupo_id, status_visita, observacoes,
    data_cancelamento, cancelado_por, dados_snapshot, motivo_cancelamento
  ) VALUES (
    v_participacao.pessoa_id, v_participacao.encontro_id, v_grupo_id, v_status_visita,
    NULL, now(), auth.uid(), v_snapshot, v_motivo
  ) RETURNING id INTO v_cancelamento_id;

  -- A FK de visita pode ser restritiva; remova os vínculos depois do snapshot.
  DELETE FROM public.visita_participacao WHERE participacao_id = v_participacao.id;
  DELETE FROM public.participacoes WHERE id = v_participacao.id;

  RETURN jsonb_build_object('cancelamento_id', v_cancelamento_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.restaurar_participacao_cancelada(p_cancelamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
  v_can_restore_visitation boolean;
  v_cancelamento public.participacoes_canceladas%ROWTYPE;
  v_snapshot jsonb;
  v_item jsonb;
  v_participacao_id uuid;
  v_encontro_ativo boolean;
BEGIN
  SELECT * INTO v_cancelamento
  FROM public.participacoes_canceladas
  WHERE id = p_cancelamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancelamento não encontrado';
  END IF;

  SELECT ativo INTO v_encontro_ativo
  FROM public.encontros
  WHERE id = v_cancelamento.encontro_id;

  IF COALESCE(v_encontro_ativo, false) = false THEN
    RAISE EXCEPTION 'Restaurações só podem ser feitas no encontro ativo';
  END IF;

  v_allowed := public.is_admin()
    OR public.has_permission(auth.uid(), 'modulo_admin')
    OR public.has_permission(auth.uid(), 'modulo_secretaria');

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    JOIN public.pessoas visitor_person ON lower(visitor_person.email) = lower(profile.email)
    JOIN public.participacoes visitor_participation
      ON visitor_participation.pessoa_id = visitor_person.id
     AND visitor_participation.encontro_id = v_cancelamento.encontro_id
    JOIN public.visita_participacao visitor_link
      ON visitor_link.participacao_id = visitor_participation.id
     AND visitor_link.visitante = true
     AND visitor_link.grupo_id = v_cancelamento.grupo_id
    WHERE profile.id = auth.uid()
      AND public.has_permission(auth.uid(), 'modulo_visitacao_duplas')
  ) INTO v_can_restore_visitation;

  IF NOT v_allowed
     AND NOT (
       COALESCE((v_cancelamento.dados_snapshot -> 'participacao' ->> 'participante')::boolean, false)
       AND v_can_restore_visitation
     ) THEN
    RAISE EXCEPTION 'Você não possui permissão para restaurar esta participação';
  END IF;

  IF v_cancelamento.revertido_em IS NOT NULL THEN
    RETURN jsonb_build_object('participacao_id', v_cancelamento.participacao_restaurada_id, 'already_reverted', true);
  END IF;

  v_snapshot := v_cancelamento.dados_snapshot;
  IF COALESCE(v_snapshot ->> 'version', '') <> '2' THEN
    RETURN public.desfazer_desistencia(p_cancelamento_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.participacoes
    WHERE pessoa_id = v_cancelamento.pessoa_id
      AND encontro_id = v_cancelamento.encontro_id
  ) THEN
    RAISE EXCEPTION 'Esta pessoa já possui uma participação ativa neste encontro';
  END IF;

  INSERT INTO public.participacoes
  SELECT (jsonb_populate_record(NULL::public.participacoes, v_snapshot -> 'participacao')).*
  RETURNING id INTO v_participacao_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_snapshot -> 'visitas', '[]'::jsonb)) LOOP
    INSERT INTO public.visita_participacao
    SELECT (jsonb_populate_record(NULL::public.visita_participacao, v_item)).*
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_snapshot -> 'intencoes_camiseta', '[]'::jsonb)) LOOP
    INSERT INTO public.visita_intencao_camiseta
    SELECT (jsonb_populate_record(NULL::public.visita_intencao_camiseta, v_item)).*
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_snapshot -> 'circulos', '[]'::jsonb)) LOOP
    INSERT INTO public.circulo_participacao
    SELECT (jsonb_populate_record(NULL::public.circulo_participacao, v_item)).*
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_snapshot -> 'camisetas', '[]'::jsonb)) LOOP
    INSERT INTO public.camiseta_pedidos
    SELECT (jsonb_populate_record(NULL::public.camiseta_pedidos, v_item)).*
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_snapshot -> 'recepcao', '[]'::jsonb)) LOOP
    INSERT INTO public.recepcao_dados
    SELECT (jsonb_populate_record(NULL::public.recepcao_dados, v_item)).*
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_snapshot -> 'recreacao', '[]'::jsonb)) LOOP
    INSERT INTO public.recreacao_dados
    SELECT (jsonb_populate_record(NULL::public.recreacao_dados, v_item)).*
    ON CONFLICT (id) DO UPDATE
      SET outro_responsavel_id = EXCLUDED.outro_responsavel_id;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_snapshot -> 'presencas', '[]'::jsonb)) LOOP
    INSERT INTO public.encontro_presencas
    SELECT (jsonb_populate_record(NULL::public.encontro_presencas, v_item)).*
    ON CONFLICT (encontro_id, participacao_id, data) DO NOTHING;
  END LOOP;

  UPDATE public.participacoes_canceladas
  SET revertido_em = now(),
      revertido_por = auth.uid(),
      participacao_restaurada_id = v_participacao_id
  WHERE id = p_cancelamento_id;

  RETURN jsonb_build_object('participacao_id', v_participacao_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_participacao(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restaurar_participacao_cancelada(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_participacao(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurar_participacao_cancelada(uuid) TO authenticated;
