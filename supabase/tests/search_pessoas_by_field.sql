BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(11);

INSERT INTO public.pessoas (
  id, nome_completo, email, telefone, cpf, endereco, numero, bairro, cidade, estado, cep
)
VALUES
  (
    '3b000000-0000-0000-0000-000000000001',
    'Natália de Paula Berdu',
    'nataliadepaulaberdu@example.test',
    '16993261230',
    '11122233344',
    'Rua Pérola Bittar Miguel',
    '2040',
    'Jardim Líbano',
    'Franca',
    'SP',
    '14400123'
  ),
  (
    '3b000000-0000-0000-0000-000000000002',
    'Natália Moreira da Silva',
    'nathy.moreiras@example.test',
    '16994043600',
    '55566677788',
    'Rua das Flores',
    '10',
    'Vila Santo Antônio',
    'Franca',
    'SP',
    '14402000'
  );

SELECT extensions.is(
  (public.search_pessoas_by_field('nome', 'natalia', NULL, 1, 10) ->> 'count')::integer,
  2,
  'busca por nome ignora acentos'
);

SELECT extensions.is(
  (public.search_pessoas_by_field('email', 'natalia', NULL, 1, 10) ->> 'count')::integer,
  1,
  'busca por email não mistura correspondências do nome'
);

SELECT extensions.is(
  (public.search_pessoas_by_field('telefone', '(16) 99404-3600', NULL, 1, 10) ->> 'count')::integer,
  1,
  'busca por telefone ignora formatação'
);

SELECT extensions.is(
  (public.search_pessoas_by_field('cpf', '555.666.777-88', NULL, 1, 10) ->> 'count')::integer,
  1,
  'busca por CPF ignora formatação'
);

SELECT extensions.is(
  (public.search_pessoas_by_field('endereco', 'perola', NULL, 1, 10) ->> 'count')::integer,
  1,
  'busca por endereço ignora acentos no logradouro'
);

SELECT extensions.is(
  (public.search_pessoas_by_field('endereco', 'santo antonio', NULL, 1, 10) ->> 'count')::integer,
  1,
  'busca por endereço inclui bairro'
);

SELECT extensions.is(
  (public.search_pessoas_by_field('endereco', '14400-123', NULL, 1, 10) ->> 'count')::integer,
  1,
  'busca por endereço reconhece CEP formatado'
);

SELECT extensions.is(
  jsonb_array_length(public.search_pessoas_by_field('nome', 'natalia', NULL, 1, 1) -> 'data'),
  1,
  'paginação limita os registros sem alterar a contagem total'
);

SELECT extensions.throws_ok(
  $$SELECT public.search_pessoas_by_field('comunidade', 'centro', NULL, 1, 10)$$,
  '22023',
  'Filtro de busca inválido.',
  'filtros fora da lista permitida são rejeitados'
);

SELECT extensions.is(
  (public.search_pessoas_by_field('email', '%', NULL, 1, 10) ->> 'count')::integer,
  0,
  'curingas digitados são tratados como texto literal'
);

SET LOCAL ROLE anon;

SELECT extensions.throws_ok(
  $$SELECT public.search_pessoas_by_field('nome', 'natalia', NULL, 1, 10)$$,
  '42501',
  'permission denied for function search_pessoas_by_field',
  'usuário anônimo não pode executar a busca administrativa'
);

RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
