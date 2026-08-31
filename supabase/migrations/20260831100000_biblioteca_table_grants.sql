BEGIN;

-- As policies de RLS da biblioteca continuam decidindo quais linhas cada
-- usuário pode consultar ou alterar. Estes privilégios apenas permitem que o
-- PostgreSQL chegue à avaliação dessas policies para sessões autenticadas.
REVOKE ALL ON TABLE public.biblioteca_pastas FROM anon;
REVOKE ALL ON TABLE public.biblioteca_arquivos FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.biblioteca_pastas
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.biblioteca_arquivos
  TO authenticated;

COMMIT;
