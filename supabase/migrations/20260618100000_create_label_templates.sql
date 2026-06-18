CREATE TABLE IF NOT EXISTS public.label_templates (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  name text NOT NULL,
  template jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_label_templates_name
  ON public.label_templates (lower(name));

ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "label_templates_select_authenticated" ON public.label_templates;
CREATE POLICY "label_templates_select_authenticated"
ON public.label_templates
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "label_templates_manage_secretaria" ON public.label_templates;
CREATE POLICY "label_templates_manage_secretaria"
ON public.label_templates
FOR ALL
TO authenticated
USING (
  public.has_permission(auth.uid(), 'modulo_admin')
  OR public.has_permission(auth.uid(), 'modulo_secretaria')
  OR public.has_permission(auth.uid(), 'modulo_cadastros')
)
WITH CHECK (
  public.has_permission(auth.uid(), 'modulo_admin')
  OR public.has_permission(auth.uid(), 'modulo_secretaria')
  OR public.has_permission(auth.uid(), 'modulo_cadastros')
);

CREATE OR REPLACE FUNCTION public.set_label_templates_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS label_templates_set_updated_at ON public.label_templates;
CREATE TRIGGER label_templates_set_updated_at
BEFORE UPDATE ON public.label_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_label_templates_updated_at();
