-- Read-only authorization smoke test for the P3 helper functions.
-- Every session change is scoped to a transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT p.id
  INTO v_user_id
  FROM public.profiles p
  WHERE public.is_admin(p.id)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P3 smoke test requires an administrator profile';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
END;
$$;

SET LOCAL ROLE authenticated;

SELECT
  'administrator' AS scenario,
  public.can_read_camiseta_catalog() AS can_read_shirt_catalog,
  public.can_manage_camiseta_catalog() AS can_manage_shirt_catalog,
  public.can_access_operational_participation(
    (SELECT id FROM public.participacoes LIMIT 1),
    'modulo_recepcao',
    true
  ) AS can_access_reception;

ROLLBACK;

BEGIN;

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT p.id
  INTO v_user_id
  FROM public.profiles p
  WHERE NOT public.is_admin(p.id)
    AND NOT public.has_permission(p.id, 'modulo_admin')
    AND NOT public.has_permission(p.id, 'modulo_secretaria')
    AND NOT public.has_permission(p.id, 'modulo_recepcao')
    AND NOT public.has_permission(p.id, 'modulo_recreacao')
    AND NOT public.has_permission(p.id, 'modulo_visitacao_coordenar')
    AND NOT public.has_permission(p.id, 'modulo_visitacao_duplas')
    AND NOT public.has_permission(p.id, 'modulo_coordenador')
    AND NOT public.has_permission(p.id, 'modulo_compras')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P3 smoke test requires an unauthorized profile';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
END;
$$;

SET LOCAL ROLE authenticated;

SELECT
  'unauthorized' AS scenario,
  public.can_read_camiseta_catalog() AS can_read_shirt_catalog,
  public.can_manage_camiseta_catalog() AS can_manage_shirt_catalog,
  public.can_access_operational_participation(
    (SELECT id FROM public.participacoes LIMIT 1),
    'modulo_recepcao',
    true
  ) AS can_access_reception;

ROLLBACK;
