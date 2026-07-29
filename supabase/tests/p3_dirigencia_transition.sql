-- Transactional integration test for a complete leadership transition.
-- It uses existing accounts as fixtures and rolls every change back.

BEGIN;

CREATE TEMP TABLE p3_dirigencia_test_context (
  current_dirigencia_id uuid NOT NULL,
  next_dirigencia_id uuid NOT NULL,
  caller_user_id uuid NOT NULL,
  permanent_admin_user_id uuid NOT NULL,
  selected_user_id uuid NOT NULL,
  selected_person_id uuid NOT NULL,
  admin_group_id uuid NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  v_current_dirigencia_id uuid;
  v_next_dirigencia_id uuid;
  v_caller_member_id uuid;
  v_caller_user_id uuid;
  v_permanent_admin_user_id uuid;
  v_selected_user_id uuid;
  v_selected_person_id uuid;
  v_admin_group_id uuid :=
    '00000000-0000-0000-0002-000000000001'::uuid;
BEGIN
  SELECT d.id
  INTO v_current_dirigencia_id
  FROM public.dirigencias d
  WHERE d.status = 'ativa'
  LIMIT 1;

  IF v_current_dirigencia_id IS NULL THEN
    RAISE EXCEPTION 'P3 test requires an active leadership';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.grupos g
    WHERE g.id = v_admin_group_id
  ) THEN
    RAISE EXCEPTION 'P3 test requires the canonical Administrator group';
  END IF;

  SELECT dm.id, pr.id
  INTO v_caller_member_id, v_caller_user_id
  FROM public.dirigencia_membros dm
  JOIN public.pessoas pe ON pe.id = dm.pessoa_id
  JOIN public.profiles pr ON lower(pr.email) = lower(pe.email)
  WHERE dm.dirigencia_id = v_current_dirigencia_id
    AND dm.ativo = true
  LIMIT 1;

  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'P3 test requires an active leader with an account';
  END IF;

  PERFORM set_config(
    'request.jwt.claim.sub',
    v_caller_user_id::text,
    true
  );

  SELECT pr.id
  INTO v_permanent_admin_user_id
  FROM public.profiles pr
  JOIN public.pessoas pe ON lower(pe.email) = lower(pr.email)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.dirigencia_membros dm
    WHERE dm.dirigencia_id = v_current_dirigencia_id
      AND dm.pessoa_id = pe.id
      AND dm.ativo = true
  )
  ORDER BY pr.created_at
  LIMIT 1;

  SELECT pr.id, pe.id
  INTO v_selected_user_id, v_selected_person_id
  FROM public.profiles pr
  JOIN public.pessoas pe ON lower(pe.email) = lower(pr.email)
  WHERE pr.id <> v_permanent_admin_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.dirigencia_membros dm
      WHERE dm.dirigencia_id = v_current_dirigencia_id
        AND dm.pessoa_id = pe.id
        AND dm.ativo = true
    )
  ORDER BY pr.created_at
  LIMIT 1;

  IF v_permanent_admin_user_id IS NULL
     OR v_selected_user_id IS NULL
     OR v_selected_person_id IS NULL THEN
    RAISE EXCEPTION 'P3 test requires two accounts outside the current leadership';
  END IF;

  -- Free the unique "in nomination" slot only inside this rolled-back test.
  UPDATE public.dirigencias
  SET status = 'encerrada',
      encerrada_em = now()
  WHERE status = 'indicacao';

  -- A group-based permanent administrator must be recognized even as viewer.
  UPDATE public.profiles
  SET role = 'viewer'
  WHERE id = v_permanent_admin_user_id;

  INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
  VALUES (v_permanent_admin_user_id, v_admin_group_id, NULL)
  ON CONFLICT DO NOTHING;

  -- Service-role callers validate an explicit user without an auth.uid().
  PERFORM set_config('request.jwt.claim.sub', '', true);

  IF NOT public.is_admin(v_permanent_admin_user_id) THEN
    RAISE EXCEPTION 'Service-role admin validation did not recognize the group';
  END IF;

  PERFORM set_config(
    'request.jwt.claim.sub',
    v_caller_user_id::text,
    true
  );

  -- A legacy role value alone must not grant backend administration.
  DELETE FROM public.usuario_grupos ug
  USING public.grupo_permissoes gp, public.permissoes pm
  WHERE ug.usuario_id = v_selected_user_id
    AND gp.grupo_id = ug.grupo_id
    AND pm.id = gp.permissao_id
    AND pm.chave = 'modulo_admin';

  UPDATE public.profiles
  SET role = 'admin'
  WHERE id = v_selected_user_id;

  IF public.is_admin(v_selected_user_id) THEN
    RAISE EXCEPTION 'Legacy role-only account still has administrative authority';
  END IF;

  UPDATE public.profiles
  SET role = 'viewer'
  WHERE id = v_selected_user_id;

  INSERT INTO public.dirigencias (
    nome,
    status,
    indicacoes_finalizadas_em,
    created_by
  )
  VALUES (
    'P3 transactional test',
    'indicacao',
    now(),
    v_caller_user_id
  )
  RETURNING id INTO v_next_dirigencia_id;

  INSERT INTO public.dirigencia_indicacoes (
    dirigencia_origem_id,
    dirigencia_destino_id,
    indicador_membro_id,
    indicado_pessoa_id,
    tipo,
    status,
    created_by
  )
  VALUES (
    v_current_dirigencia_id,
    v_next_dirigencia_id,
    v_caller_member_id,
    v_selected_person_id,
    'regular',
    'selecionada',
    v_caller_user_id
  );

  INSERT INTO p3_dirigencia_test_context (
    current_dirigencia_id,
    next_dirigencia_id,
    caller_user_id,
    permanent_admin_user_id,
    selected_user_id,
    selected_person_id,
    admin_group_id
  )
  VALUES (
    v_current_dirigencia_id,
    v_next_dirigencia_id,
    v_caller_user_id,
    v_permanent_admin_user_id,
    v_selected_user_id,
    v_selected_person_id,
    v_admin_group_id
  );

END;
$$;

GRANT SELECT ON p3_dirigencia_test_context TO authenticated;

SET LOCAL ROLE authenticated;

SELECT public.ativar_nova_dirigencia(next_dirigencia_id)
FROM p3_dirigencia_test_context;

RESET ROLE;

DO $$
DECLARE
  v_context p3_dirigencia_test_context%ROWTYPE;
BEGIN
  SELECT *
  INTO v_context
  FROM p3_dirigencia_test_context;

  IF (
    SELECT status <> 'encerrada'
    FROM public.dirigencias
    WHERE id = v_context.current_dirigencia_id
  ) THEN
    RAISE EXCEPTION 'Previous leadership was not closed';
  END IF;

  IF (
    SELECT status <> 'ativa'
    FROM public.dirigencias
    WHERE id = v_context.next_dirigencia_id
  ) THEN
    RAISE EXCEPTION 'New leadership was not activated';
  END IF;

  IF (SELECT count(*) FROM public.dirigencias WHERE status = 'ativa') <> 1 THEN
    RAISE EXCEPTION 'Transition did not preserve the single-active invariant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.dirigencia_membros dm
    JOIN public.pessoas pe ON pe.id = dm.pessoa_id
    JOIN public.profiles pr ON lower(pr.email) = lower(pe.email)
    JOIN public.usuario_grupos ug ON ug.usuario_id = pr.id
    WHERE dm.dirigencia_id = v_context.current_dirigencia_id
      AND ug.grupo_id = v_context.admin_group_id
      AND ug.encontro_id IS NULL
  ) THEN
    RAISE EXCEPTION 'An outgoing leader retained the leadership admin group';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.dirigencia_membros dm
    JOIN public.pessoas pe ON pe.id = dm.pessoa_id
    JOIN public.profiles pr ON lower(pr.email) = lower(pe.email)
    WHERE dm.dirigencia_id = v_context.current_dirigencia_id
      AND pr.role <> 'viewer'
  ) THEN
    RAISE EXCEPTION 'An outgoing leader retained the legacy admin role';
  END IF;

  IF public.is_admin(v_context.caller_user_id) THEN
    RAISE EXCEPTION 'Outgoing leader retained backend administration';
  END IF;

  PERFORM set_config(
    'request.jwt.claim.sub',
    v_context.permanent_admin_user_id::text,
    true
  );

  IF NOT public.is_admin(v_context.permanent_admin_user_id) THEN
    RAISE EXCEPTION 'Independent permanent administrator lost access';
  END IF;

  PERFORM set_config(
    'request.jwt.claim.sub',
    v_context.selected_user_id::text,
    true
  );

  IF NOT public.is_admin(v_context.selected_user_id) THEN
    RAISE EXCEPTION 'Selected incoming leader did not receive administration';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_grupos ug
    WHERE ug.usuario_id = v_context.selected_user_id
      AND ug.grupo_id = v_context.admin_group_id
      AND ug.encontro_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Selected incoming leader did not receive the admin group';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dirigencia_eventos de
    WHERE de.dirigencia_id = v_context.next_dirigencia_id
      AND de.tipo = 'dirigencia_ativada'
  ) THEN
    RAISE EXCEPTION 'Transition audit event was not recorded';
  END IF;
END;
$$;

SELECT
  'passed' AS result,
  'role-only denied; outgoing revoked; incoming granted; permanent preserved'
    AS assertions;

ROLLBACK;
