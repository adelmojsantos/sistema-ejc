BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(3);

SELECT extensions.has_function(
  'public',
  'aprovar_lista_espera',
  ARRAY['uuid', 'uuid'],
  'aprovar_lista_espera existe com suporte a nova pessoa ou pessoa existente'
);

SELECT has_function_privilege(
  'anon',
  'public.aprovar_lista_espera(uuid, uuid)',
  'EXECUTE',
  false,
  'usuários anônimos não podem aprovar inscrições online'
);

SELECT has_function_privilege(
  'authenticated',
  'public.aprovar_lista_espera(uuid, uuid)',
  'EXECUTE',
  true,
  'a RPC está disponível somente para autorização interna'
);

SELECT * FROM finish();
ROLLBACK;
