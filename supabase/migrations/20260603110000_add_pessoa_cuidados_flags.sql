ALTER TABLE public.pessoas
ADD COLUMN IF NOT EXISTS possui_restricao_alimentar boolean,
ADD COLUMN IF NOT EXISTS possui_alergia boolean,
ADD COLUMN IF NOT EXISTS usa_medicamento_continuo boolean,
ADD COLUMN IF NOT EXISTS possui_observacao_saude boolean;

CREATE OR REPLACE FUNCTION public._normalizar_cuidado_texto(p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT BTRIM(
    REGEXP_REPLACE(
      TRANSLATE(
        LOWER(BTRIM(COALESCE(p_valor, ''))),
        'áàãâäéèêëíìîïóòõôöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

UPDATE public.pessoas
SET possui_restricao_alimentar = CASE
  WHEN restricao_alimentar IS NULL OR BTRIM(restricao_alimentar) = '' THEN NULL
  WHEN public._normalizar_cuidado_texto(restricao_alimentar) IN (
    'nao',
    'n',
    'nenhum',
    'nenhuma',
    'nada',
    'na',
    'n a'
  )
  OR public._normalizar_cuidado_texto(restricao_alimentar) LIKE 'sem restricao%'
  OR public._normalizar_cuidado_texto(restricao_alimentar) LIKE 'sem restricoes%'
  OR public._normalizar_cuidado_texto(restricao_alimentar) LIKE 'nao possui%'
  OR public._normalizar_cuidado_texto(restricao_alimentar) LIKE 'nao tem%'
  OR public._normalizar_cuidado_texto(restricao_alimentar) LIKE 'nao ha%' THEN false
  ELSE true
END
WHERE possui_restricao_alimentar IS NULL;

UPDATE public.pessoas
SET possui_alergia = CASE
  WHEN alergia IS NULL OR BTRIM(alergia) = '' THEN NULL
  WHEN public._normalizar_cuidado_texto(alergia) IN (
    'nao',
    'n',
    'nenhum',
    'nenhuma',
    'nada',
    'na',
    'n a'
  )
  OR public._normalizar_cuidado_texto(alergia) LIKE 'sem alergia%'
  OR public._normalizar_cuidado_texto(alergia) LIKE 'sem alergias%'
  OR public._normalizar_cuidado_texto(alergia) LIKE 'nao possui%'
  OR public._normalizar_cuidado_texto(alergia) LIKE 'nao tem%'
  OR public._normalizar_cuidado_texto(alergia) LIKE 'nao ha%' THEN false
  ELSE true
END
WHERE possui_alergia IS NULL;

UPDATE public.pessoas
SET usa_medicamento_continuo = CASE
  WHEN medicamento_continuo IS NULL OR BTRIM(medicamento_continuo) = '' THEN NULL
  WHEN public._normalizar_cuidado_texto(medicamento_continuo) IN (
    'nao',
    'n',
    'nenhum',
    'nenhuma',
    'nada',
    'na',
    'n a'
  )
  OR public._normalizar_cuidado_texto(medicamento_continuo) LIKE 'sem medicamento%'
  OR public._normalizar_cuidado_texto(medicamento_continuo) LIKE 'nao possui%'
  OR public._normalizar_cuidado_texto(medicamento_continuo) LIKE 'nao usa%'
  OR public._normalizar_cuidado_texto(medicamento_continuo) LIKE 'nao toma%'
  OR public._normalizar_cuidado_texto(medicamento_continuo) LIKE 'nao tem%'
  OR public._normalizar_cuidado_texto(medicamento_continuo) LIKE 'nao ha%' THEN false
  ELSE true
END
WHERE usa_medicamento_continuo IS NULL;

UPDATE public.pessoas
SET possui_observacao_saude = CASE
  WHEN observacoes_saude IS NULL OR BTRIM(observacoes_saude) = '' THEN NULL
  WHEN public._normalizar_cuidado_texto(observacoes_saude) IN (
    'nao',
    'n',
    'nenhum',
    'nenhuma',
    'nada',
    'na',
    'n a'
  )
  OR public._normalizar_cuidado_texto(observacoes_saude) LIKE 'sem observacao%'
  OR public._normalizar_cuidado_texto(observacoes_saude) LIKE 'sem observacoes%'
  OR public._normalizar_cuidado_texto(observacoes_saude) LIKE 'nao possui%'
  OR public._normalizar_cuidado_texto(observacoes_saude) LIKE 'nao tem%'
  OR public._normalizar_cuidado_texto(observacoes_saude) LIKE 'nao ha%' THEN false
  ELSE true
END
WHERE possui_observacao_saude IS NULL;

DROP FUNCTION public._normalizar_cuidado_texto(text);

NOTIFY pgrst, 'reload schema';
