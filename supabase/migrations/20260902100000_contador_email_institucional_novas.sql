CREATE OR REPLACE FUNCTION public.contar_email_institucional_novas()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_visualizar_email_institucional(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado.' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT count(*)
    FROM public.email_institucional_conversas conversa
    WHERE conversa.status = 'novo'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.contar_email_institucional_novas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contar_email_institucional_novas() TO authenticated;

COMMENT ON FUNCTION public.contar_email_institucional_novas() IS
  'Retorna a quantidade global de conversas novas para usuários autorizados da caixa institucional.';
