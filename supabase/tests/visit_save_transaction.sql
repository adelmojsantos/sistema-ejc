BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(18);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES (
  '19000000-0000-0000-0000-000000000001',
  'visit-save-manager@example.test',
  'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')),
  now(), now(), now(), false, false
);

INSERT INTO public.grupos (id, nome, descricao)
VALUES ('69000000-0000-0000-0000-000000000001', 'Teste salvamento de visita', 'Fixture transacional');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '69000000-0000-0000-0000-000000000001'::uuid, id
FROM public.permissoes
WHERE chave = 'modulo_admin';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES (
  '19000000-0000-0000-0000-000000000001',
  '69000000-0000-0000-0000-000000000001',
  NULL
);

INSERT INTO public.encontros (id, nome, data_inicio, data_fim, ativo, edicao)
VALUES
  ('29000000-0000-0000-0000-000000000001', 'Teste visita ativa', current_date, current_date + 2, true, 99401),
  ('29000000-0000-0000-0000-000000000002', 'Teste visita histórica', current_date - 10, current_date - 8, false, 99402);

INSERT INTO public.pessoas (id, nome_completo, telefone, cpf)
VALUES
  ('39000000-0000-0000-0000-000000000001', 'Encontrista Ativo', '16900000001', '99400000001'),
  ('39000000-0000-0000-0000-000000000002', 'Encontrista Histórico', '16900000002', '99400000002');

INSERT INTO public.participacoes (
  id, pessoa_id, encontro_id, participante, coordenador, pago_taxa, foto_url
)
VALUES
  ('49000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', true, false, false, NULL),
  ('49000000-0000-0000-0000-000000000002', '39000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-000000000002', true, false, false, NULL);

INSERT INTO public.visita_participacao (
  id, grupo_id, participacao_id, visitante, status, observacoes, taxa_paga
)
VALUES
  ('59000000-0000-0000-0000-000000000001', NULL, '49000000-0000-0000-0000-000000000001', false, 'pendente', 'Antes da visita', false),
  ('59000000-0000-0000-0000-000000000002', NULL, '49000000-0000-0000-0000-000000000002', false, 'realizada', 'Histórico preservado', true);

INSERT INTO public.camiseta_modelos (id, nome, valor, ativo)
VALUES ('79000000-0000-0000-0000-000000000001', 'Modelo teste visita 99401', 40, true);

SELECT set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.salvar_visita_completa_v2(
    '59000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'status', 'realizada',
      'observacoes', 'Família confirmou presença',
      'foto_familia_url', 'r2://fixture/familia.webp',
      'foto_participacao_url', 'r2://fixture/encontrista.webp',
      'taxa_paga', true,
      'data_visita', '2026-08-10T18:00:00Z',
      'pessoa', jsonb_build_object(
        'nome_completo', 'Encontrista Atualizado',
        'telefone', '(16) 99999-9999',
        'endereco', 'Rua das Flores',
        'numero', '10',
        'cep', '14400000',
        'bairro', 'Centro',
        'cidade', 'Franca',
        'estado', 'SP',
        'latitude', -20.538,
        'longitude', -47.401,
        'geo_status', 'verified',
        'geo_source', 'manual',
        'geo_precision', 'manual',
        'geo_address_fingerprint', public.build_address_fingerprint(
          'Rua das Flores', '10', NULL, '14400000', 'Centro', 'Franca', 'SP'
        ),
        'geo_checked_at', now(),
        'geo_verified_at', now(),
        'geo_reference_latitude', -20.54,
        'geo_reference_longitude', -47.40,
        'geo_reference_source', 'nominatim',
        'geo_reference_precision', 'street',
        'geo_reference_address_fingerprint', public.build_address_fingerprint(
          'Rua das Flores', '10', NULL, '14400000', 'Centro', 'Franca', 'SP'
        ),
        'geo_reference_checked_at', now(),
        'possui_alergia', true,
        'alergia', 'Dipirona'
      ),
      'intencoes', jsonb_build_array(jsonb_build_object(
        'modelo_id', '79000000-0000-0000-0000-000000000001',
        'tamanho', 'M',
        'quantidade', 2
      ))
    )
  )$$,
  'visita completa é salva por uma única transação'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT status FROM public.visita_participacao WHERE id = '59000000-0000-0000-0000-000000000001'),
  'realizada',
  'status da visita é persistido'
);

SELECT extensions.is(
  (SELECT observacoes FROM public.visita_participacao WHERE id = '59000000-0000-0000-0000-000000000001'),
  'Família confirmou presença',
  'observações da visita são persistidas'
);

SELECT extensions.is(
  (SELECT nome_completo FROM public.pessoas WHERE id = '39000000-0000-0000-0000-000000000001'),
  'Encontrista Atualizado',
  'dados cadastrais são atualizados na mesma operação'
);

SELECT extensions.ok(
  (SELECT geo_status = 'verified' AND latitude = -20.538 AND longitude = -47.401
   FROM public.pessoas
   WHERE id = '39000000-0000-0000-0000-000000000001'),
  'salvamento da visita persiste somente a localização marcada como verificada'
);

SELECT extensions.is(
  (SELECT geo_verified_by FROM public.pessoas WHERE id = '39000000-0000-0000-0000-000000000001'),
  '19000000-0000-0000-0000-000000000001'::uuid,
  'confirmação manual registra o usuário autenticado no banco'
);

SELECT extensions.ok(
  (SELECT geo_reference_latitude = -20.54 AND geo_reference_precision = 'street'
   FROM public.pessoas
   WHERE id = '39000000-0000-0000-0000-000000000001'),
  'salvamento transacional preserva a referência regional separada'
);

SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$SELECT public.atualizar_endereco_visitacao_v2(
    '49000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'endereco', 'Rua das Flores',
      'numero', '10',
      'cep', '14400000',
      'bairro', 'Centro',
      'cidade', 'Franca',
      'estado', 'SP',
      'latitude', -20.538,
      'longitude', -47.401,
      'geo_status', 'verified',
      'geo_source', 'manual',
      'geo_precision', 'manual',
      'geo_address_fingerprint', public.build_address_fingerprint(
        'Rua das Flores', '10', NULL, '14400000', 'Centro', 'Franca', 'SP'
      ),
      'geo_checked_at', now(),
      'geo_verified_at', now()
    )
  )$$,
  'cliente anterior à migration pode salvar sem enviar os novos campos'
);

RESET ROLE;

SELECT extensions.ok(
  (SELECT geo_reference_latitude = -20.54 AND geo_reference_precision = 'street'
   FROM public.pessoas
   WHERE id = '39000000-0000-0000-0000-000000000001'),
  'RPC preserva referência regional quando cliente antigo omite os campos'
);

SELECT extensions.ok(
  (SELECT pago_taxa AND foto_url = 'r2://fixture/encontrista.webp'
   FROM public.participacoes
   WHERE id = '49000000-0000-0000-0000-000000000001'),
  'taxa e foto da participação são persistidas'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.visita_intencao_camiseta
   WHERE visita_id = '59000000-0000-0000-0000-000000000001'
     AND tamanho = 'M'
     AND quantidade = 2),
  1,
  'intenção de camiseta é persistida sem virar pedido formal'
);

SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.salvar_visita_completa(
    '59000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'status', 'ausente',
      'observacoes', 'Não deve permanecer',
      'taxa_paga', false,
      'pessoa', jsonb_build_object('nome_completo', 'Também não deve permanecer'),
      'intencoes', jsonb_build_array(jsonb_build_object(
        'modelo_id', '79000000-0000-0000-0000-000000000099',
        'tamanho', 'G',
        'quantidade', 1
      ))
    )
  )$$,
  'P0001',
  'Modelo de camiseta inválido.',
  'falha em um bloco rejeita a operação completa'
);

RESET ROLE;

SELECT extensions.ok(
  (SELECT status = 'realizada' AND observacoes = 'Família confirmou presença'
   FROM public.visita_participacao
   WHERE id = '59000000-0000-0000-0000-000000000001'),
  'falha da intenção desfaz alterações anteriores da visita'
);

SELECT extensions.is(
  (SELECT nome_completo FROM public.pessoas WHERE id = '39000000-0000-0000-0000-000000000001'),
  'Encontrista Atualizado',
  'falha da intenção também desfaz alterações da pessoa'
);

SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.salvar_visita_completa_v2(
    '59000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'status', 'ausente',
      'observacoes', 'Não deve persistir por falha geográfica',
      'taxa_paga', true,
      'pessoa', jsonb_build_object(
        'nome_completo', 'Encontrista Atualizado',
        'telefone', '16999999999',
        'endereco', 'Rua Alterada',
        'numero', '99',
        'cidade', 'Franca',
        'estado', 'SP',
        'latitude', -20.5,
        'longitude', -47.4,
        'geo_status', 'verified',
        'geo_source', 'manual',
        'geo_precision', 'manual',
        'geo_address_fingerprint', 'incorreto',
        'geo_checked_at', now(),
        'geo_verified_at', now()
      ),
      'intencoes', '[]'::jsonb
    )
  )$$,
  'P0001',
  'A localização não corresponde ao endereço atual.',
  'fingerprint divergente rejeita toda a transação da visita'
);

RESET ROLE;

SELECT extensions.ok(
  (SELECT status = 'realizada' AND observacoes = 'Família confirmou presença'
   FROM public.visita_participacao
   WHERE id = '59000000-0000-0000-0000-000000000001'),
  'falha geográfica também desfaz as alterações operacionais da visita'
);

SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  $$SELECT public.salvar_visita_completa(
    '59000000-0000-0000-0000-000000000002',
    '{"status":"ausente","pessoa":{"nome_completo":"Alterado"},"intencoes":[]}'::jsonb
  )$$,
  'P0001',
  'Não é possível alterar uma visita de encontro histórico.',
  'encontro histórico rejeita alteração com mensagem de domínio'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT observacoes FROM public.visita_participacao WHERE id = '59000000-0000-0000-0000-000000000002'),
  'Histórico preservado',
  'visita histórica permanece inalterada'
);

SELECT * FROM extensions.finish();
ROLLBACK;
