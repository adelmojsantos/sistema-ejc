DROP VIEW IF EXISTS public.ausentes_por_dia;
DROP TABLE IF EXISTS public.checkins;

CREATE TABLE IF NOT EXISTS public.encontro_presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
  participacao_id uuid NOT NULL REFERENCES public.participacoes(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.visita_grupos(id) ON DELETE SET NULL,
  data date NOT NULL,
  presente boolean NOT NULL DEFAULT false,
  observacao text,
  marcado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  marcado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encontro_id, participacao_id, data)
);

CREATE INDEX IF NOT EXISTS idx_encontro_presencas_encontro_data
ON public.encontro_presencas (encontro_id, data, presente);

CREATE INDEX IF NOT EXISTS idx_encontro_presencas_grupo_data
ON public.encontro_presencas (grupo_id, data);

CREATE INDEX IF NOT EXISTS idx_encontro_presencas_participacao
ON public.encontro_presencas (participacao_id);

DROP TRIGGER IF EXISTS encontro_presencas_set_updated_at ON public.encontro_presencas;
CREATE TRIGGER encontro_presencas_set_updated_at
BEFORE UPDATE ON public.encontro_presencas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.encontro_presencas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visitacao_can_read_encontro_presencas" ON public.encontro_presencas;
CREATE POLICY "visitacao_can_read_encontro_presencas"
ON public.encontro_presencas FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.has_permission(auth.uid(), 'modulo_visitacao_coordenar')
  OR public.has_permission(auth.uid(), 'modulo_visitacao_duplas')
  OR public.has_permission(auth.uid(), 'modulo_ligacao')
);

DROP POLICY IF EXISTS "visitacao_can_manage_encontro_presencas" ON public.encontro_presencas;
CREATE POLICY "visitacao_can_manage_encontro_presencas"
ON public.encontro_presencas FOR ALL TO authenticated
USING (
  public.is_admin()
  OR public.has_permission(auth.uid(), 'modulo_visitacao_coordenar')
  OR public.has_permission(auth.uid(), 'modulo_visitacao_duplas')
)
WITH CHECK (
  public.is_admin()
  OR public.has_permission(auth.uid(), 'modulo_visitacao_coordenar')
  OR public.has_permission(auth.uid(), 'modulo_visitacao_duplas')
);
