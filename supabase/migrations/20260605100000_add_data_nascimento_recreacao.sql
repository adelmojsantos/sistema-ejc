ALTER TABLE public.recreacao_dados
ADD COLUMN IF NOT EXISTS data_nascimento date;

NOTIFY pgrst, 'reload schema';
