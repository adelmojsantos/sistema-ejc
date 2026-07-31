BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(3);

SELECT extensions.has_function(
  'public',
  'aprovar_lista_espera',
  ARRAY['uuid', 'uuid'],
  'aprovar_lista_espera existe com suporte a nova pessoa ou pessoa existente'
);

SELECT extensions.ok(
  NOT has_function_privilege(
  'anon',
  'public.aprovar_lista_espera(uuid, uuid)',
  'EXECUTE'
  ),
  'usuários anônimos não podem aprovar inscrições online'
);

SELECT extensions.ok(
  has_function_privilege(
  'authenticated',
  'public.aprovar_lista_espera(uuid, uuid)',
  'EXECUTE'
  ),
  'a RPC está disponível somente para autorização interna'
);

SELECT * FROM finish();
ROLLBACK;
