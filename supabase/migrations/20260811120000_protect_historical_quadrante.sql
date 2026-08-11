-- Preserva o conteúdo publicado de Quadrantes históricos, mantendo disponíveis
-- apenas as ações necessárias para revogar ou reforçar a segurança do acesso.

CREATE OR REPLACE FUNCTION public.protect_historical_quadrante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_is_historical boolean;
  v_editorial_changed boolean;
  v_access_changed boolean;
BEGIN
  v_is_historical := (
    NOT COALESCE(OLD.ativo, false)
    AND OLD.data_fim IS NOT NULL
    AND OLD.data_fim < CURRENT_DATE
  );

  IF NOT v_is_historical THEN
    RETURN NEW;
  END IF;

  v_editorial_changed := (
    NEW.logo_url IS DISTINCT FROM OLD.logo_url
    OR NEW.simbologia_texto IS DISTINCT FROM OLD.simbologia_texto
    OR NEW.tematica_texto IS DISTINCT FROM OLD.tematica_texto
    OR NEW.musica_letra IS DISTINCT FROM OLD.musica_letra
    OR NEW.quadrante_visibilidade IS DISTINCT FROM OLD.quadrante_visibilidade
  );

  v_access_changed := (
    NEW.quadrante_ativo IS DISTINCT FROM OLD.quadrante_ativo
    OR NEW.quadrante_pin IS DISTINCT FROM OLD.quadrante_pin
    OR NEW.quadrante_token IS DISTINCT FROM OLD.quadrante_token
  );

  IF NOT v_editorial_changed AND NOT v_access_changed THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores e dirigentes podem alterar a segurança de um Quadrante histórico.';
  END IF;

  IF v_editorial_changed THEN
    RAISE EXCEPTION 'O conteúdo de um Quadrante histórico é somente leitura.';
  END IF;

  IF NOT COALESCE(OLD.quadrante_ativo, false) AND COALESCE(NEW.quadrante_ativo, false) THEN
    RAISE EXCEPTION 'Um Quadrante histórico desativado não pode ser reativado.';
  END IF;

  IF NEW.quadrante_pin IS DISTINCT FROM OLD.quadrante_pin
     AND NOT COALESCE(OLD.quadrante_ativo, false) THEN
    RAISE EXCEPTION 'O PIN só pode ser alterado enquanto o Quadrante histórico estiver publicado.';
  END IF;

  IF NEW.quadrante_token IS DISTINCT FROM OLD.quadrante_token
     AND NEW.quadrante_token IS NULL THEN
    RAISE EXCEPTION 'O token de segurança do Quadrante não pode ser removido.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_historical_quadrante_trigger ON public.encontros;

CREATE TRIGGER protect_historical_quadrante_trigger
BEFORE UPDATE OF
  quadrante_ativo,
  quadrante_pin,
  quadrante_token,
  logo_url,
  simbologia_texto,
  tematica_texto,
  musica_letra,
  quadrante_visibilidade
ON public.encontros
FOR EACH ROW
EXECUTE FUNCTION public.protect_historical_quadrante();

REVOKE ALL ON FUNCTION public.protect_historical_quadrante() FROM PUBLIC;
