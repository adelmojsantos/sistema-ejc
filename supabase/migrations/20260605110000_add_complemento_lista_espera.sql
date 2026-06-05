ALTER TABLE public.lista_espera
ADD COLUMN IF NOT EXISTS complemento text;

NOTIFY pgrst, 'reload schema';
