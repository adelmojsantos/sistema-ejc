ALTER TABLE public.label_templates
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.label_templates
  ALTER COLUMN id TYPE text USING id::text;

ALTER TABLE public.label_templates
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);
