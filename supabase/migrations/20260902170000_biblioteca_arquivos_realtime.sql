BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'biblioteca_arquivos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.biblioteca_arquivos;
  END IF;
END;
$$;

COMMIT;
