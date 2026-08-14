BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(22);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  (
    '18000000-0000-0000-0000-000000000001',
    'finance.reconciliation-manager@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  ),
  (
    '18000000-0000-0000-0000-000000000002',
    'finance.reconciliation-viewer@example.test',
    'authenticated', 'authenticated',
    crypt('fixture-password', gen_salt('bf')),
    now(), now(), now(), false, false
  );

-- O gestor usa o grupo administrativo canônico; o segundo usuário recebe só leitura.
INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES (
  '18000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0002-000000000001',
  NULL
);

-- Grants locais ao teste reproduzem os privilégios de leitura do ambiente
-- Supabase; as policies continuam decidindo quais linhas são visíveis.
GRANT SELECT ON TABLE
  public.financeiro_lancamentos,
  public.financeiro_reconciliacoes,
  public.financeiro_reconciliacao_itens
TO authenticated;

INSERT INTO public.grupos (id, nome, descricao)
VALUES (
  '68000000-0000-0000-0000-000000000001',
  'Financeiro leitura fixture',
  'Acesso sem permissão de gerenciamento'
);

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '68000000-0000-0000-0000-000000000001', id
FROM public.permissoes
WHERE chave = 'modulo_financeiro';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES (
  '18000000-0000-0000-0000-000000000002',
  '68000000-0000-0000-0000-000000000001',
  NULL
);

INSERT INTO public.encontros (
  id, nome, data_inicio, data_fim, ativo, edicao, valor_taxa
)
VALUES (
  '38000000-0000-0000-0000-000000000001',
  'Reconciliação financeira fixture',
  current_date,
  current_date + 2,
  false,
  999905,
  100.00
);

INSERT INTO public.equipes (id, nome)
VALUES (
  '28000000-0000-0000-0000-000000000001',
  'Equipe Financeiro Fixture'
);

INSERT INTO public.pessoas (id, nome_completo, telefone, email)
VALUES
  (
    '29000000-0000-0000-0000-000000000001',
    'Encontreiro Financeiro Fixture',
    '(00) 90000-0001',
    'encontreiro.finance@example.test'
  ),
  (
    '29000000-0000-0000-0000-000000000002',
    'Encontrista Financeiro Fixture',
    '(00) 90000-0002',
    'encontrista.finance@example.test'
  );

INSERT INTO public.participacoes (
  id, pessoa_id, encontro_id, participante, equipe_id,
  dados_confirmados, pago_taxa, pago_camiseta
)
VALUES
  (
    '48000000-0000-0000-0000-000000000001',
    '29000000-0000-0000-0000-000000000001',
    '38000000-0000-0000-0000-000000000001',
    false,
    '28000000-0000-0000-0000-000000000001',
    true,
    true,
    true
  ),
  (
    '48000000-0000-0000-0000-000000000002',
    '29000000-0000-0000-0000-000000000002',
    '38000000-0000-0000-0000-000000000001',
    true,
    NULL,
    false,
    true,
    false
  );

INSERT INTO public.equipe_confirmacoes (
  equipe_id, encontro_id, confirmado_por,
  comprovante_taxas_url, comprovantes_taxas_urls,
  comprovante_camisetas_url, comprovantes_camisetas_urls
)
VALUES (
  '28000000-0000-0000-0000-000000000001',
  '38000000-0000-0000-0000-000000000001',
  '18000000-0000-0000-0000-000000000001',
  'proofs/team-tax.pdf',
  '["proofs/team-tax.pdf"]'::jsonb,
  'proofs/team-shirt.pdf',
  '["proofs/team-shirt.pdf"]'::jsonb
);

INSERT INTO public.visita_grupos (id, encontro_id, nome)
VALUES (
  '58000000-0000-0000-0000-000000000001',
  '38000000-0000-0000-0000-000000000001',
  'Dupla Financeiro Fixture'
);

INSERT INTO public.visita_participacao (
  id, grupo_id, participacao_id, visitante, status, taxa_paga
)
VALUES (
  '59000000-0000-0000-0000-000000000001',
  '58000000-0000-0000-0000-000000000001',
  '48000000-0000-0000-0000-000000000002',
  false,
  'realizada',
  true
);

INSERT INTO public.camiseta_modelos (id, nome, valor, ativo)
VALUES (
  '69000000-0000-0000-0000-000000000001',
  'Modelo Financeiro Fixture',
  35.00,
  true
);

INSERT INTO public.camiseta_config_encontro (encontro_id, modelo_id, valor, ativo)
VALUES (
  '38000000-0000-0000-0000-000000000001',
  '69000000-0000-0000-0000-000000000001',
  40.00,
  true
);

INSERT INTO public.camiseta_pedidos (
  id, participacao_id, modelo_id, tamanho, quantidade
)
VALUES (
  '78000000-0000-0000-0000-000000000001',
  '48000000-0000-0000-0000-000000000001',
  '69000000-0000-0000-0000-000000000001',
  'M',
  2
);

INSERT INTO public.visita_intencao_camiseta (
  id, visita_id, modelo_id, tamanho, quantidade,
  pago, comprovante_url, pago_em, pago_por
)
VALUES (
  '79000000-0000-0000-0000-000000000001',
  '59000000-0000-0000-0000-000000000001',
  '69000000-0000-0000-0000-000000000001',
  'G',
  1,
  true,
  'proofs/visitor-shirt.pdf',
  now(),
  '18000000-0000-0000-0000-000000000001'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '18000000-0000-0000-0000-000000000002',
  true
);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$ SELECT public.listar_financeiro_reconciliacao_pendencias('38000000-0000-0000-0000-000000000001') $$,
  'finance viewer can inspect pending payments'
);

SELECT extensions.throws_ok(
  $$
    SELECT public.criar_financeiro_reconciliacao(
      '38000000-0000-0000-0000-000000000001',
      'taxa',
      '[{"fonte":"participacao_taxa","fonte_id":"48000000-0000-0000-0000-000000000001"}]'::jsonb,
      100.00,
      current_date,
      NULL
    )
  $$,
  'P0001',
  'Usuário sem permissão para gerenciar o financeiro.',
  'finance viewer cannot reconcile a payment'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '18000000-0000-0000-0000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  jsonb_array_length(public.listar_financeiro_reconciliacao_pendencias('38000000-0000-0000-0000-000000000001') -> 'taxas'),
  2,
  'both paid participation fees are pending'
);

SELECT extensions.is(
  jsonb_array_length(public.listar_financeiro_reconciliacao_pendencias('38000000-0000-0000-0000-000000000001') -> 'camisetas'),
  2,
  'formal and visit shirt orders are pending'
);

SELECT extensions.is(
  (
    SELECT sum((item ->> 'valor_esperado')::numeric)
    FROM jsonb_array_elements(public.listar_financeiro_reconciliacao_pendencias('38000000-0000-0000-0000-000000000001') -> 'taxas') item
  ),
  200.00::numeric,
  'fee total is recalculated from the encounter value'
);

SELECT extensions.is(
  (
    SELECT sum((item ->> 'valor_esperado')::numeric)
    FROM jsonb_array_elements(public.listar_financeiro_reconciliacao_pendencias('38000000-0000-0000-0000-000000000001') -> 'camisetas') item
  ),
  120.00::numeric,
  'shirt total uses configured price and quantities'
);

SELECT extensions.lives_ok(
  $$
    SELECT public.criar_financeiro_reconciliacao(
      '38000000-0000-0000-0000-000000000001',
      'taxa',
      '[{"fonte":"participacao_taxa","fonte_id":"48000000-0000-0000-0000-000000000001"}]'::jsonb,
      100.00,
      current_date,
      NULL
    )
  $$,
  'manager can reconcile a partial batch of fees'
);

SELECT extensions.is(
  (SELECT count(*) FROM public.financeiro_reconciliacoes WHERE tipo = 'taxa' AND status = 'ativo'),
  1::bigint,
  'one active fee reconciliation is recorded'
);

SELECT extensions.is(
  (SELECT valor FROM public.financeiro_lancamentos WHERE origem = 'taxa' AND status = 'ativo'),
  100.00::numeric,
  'fee reconciliation creates one receipt with the received value'
);

SELECT extensions.is(
  jsonb_array_length(public.listar_financeiro_reconciliacao_pendencias('38000000-0000-0000-0000-000000000001') -> 'taxas'),
  1,
  'only the unreconciled fee remains pending'
);

SELECT extensions.throws_ok(
  $$
    SELECT public.criar_financeiro_reconciliacao(
      '38000000-0000-0000-0000-000000000001',
      'taxa',
      '[
        {"fonte":"participacao_taxa","fonte_id":"48000000-0000-0000-0000-000000000002"},
        {"fonte":"participacao_taxa","fonte_id":"48000000-0000-0000-0000-000000000002"}
      ]'::jsonb,
      200.00,
      current_date,
      NULL
    )
  $$,
  'P0001',
  'O mesmo pagamento foi informado mais de uma vez no lote.',
  'the same source cannot be repeated within a batch'
);

SELECT extensions.throws_ok(
  $$
    SELECT public.criar_financeiro_reconciliacao(
      '38000000-0000-0000-0000-000000000001',
      'camiseta',
      '[
        {"fonte":"camiseta_pedido","fonte_id":"78000000-0000-0000-0000-000000000001"},
        {"fonte":"visita_camiseta","fonte_id":"79000000-0000-0000-0000-000000000001"}
      ]'::jsonb,
      119.00,
      current_date,
      NULL
    )
  $$,
  'P0001',
  'Informe a justificativa para a diferença entre o valor esperado e o recebido.',
  'a difference cannot be reconciled without justification'
);

SELECT extensions.lives_ok(
  $$
    SELECT public.criar_financeiro_reconciliacao(
      '38000000-0000-0000-0000-000000000001',
      'camiseta',
      '[
        {"fonte":"camiseta_pedido","fonte_id":"78000000-0000-0000-0000-000000000001"},
        {"fonte":"visita_camiseta","fonte_id":"79000000-0000-0000-0000-000000000001"}
      ]'::jsonb,
      119.00,
      current_date,
      'Tarifa descontada no recebimento'
    )
  $$,
  'manager can reconcile a justified difference'
);

SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.financeiro_reconciliacao_itens item
    JOIN public.financeiro_reconciliacoes lote ON lote.id = item.reconciliacao_id
    WHERE lote.tipo = 'camiseta' AND item.status = 'ativo'
  ),
  2::bigint,
  'shirt reconciliation preserves both source snapshots'
);

SELECT extensions.is(
  (SELECT valor FROM public.financeiro_lancamentos WHERE origem = 'camiseta' AND status = 'ativo'),
  119.00::numeric,
  'shirt receipt uses the amount actually received'
);

SELECT extensions.is(
  (
    SELECT jsonb_array_length(comprovantes_urls)
    FROM public.financeiro_reconciliacoes
    WHERE tipo = 'camiseta' AND status = 'ativo'
  ),
  2,
  'duplicate proof references are normalized in the batch'
);

SELECT extensions.is(
  jsonb_array_length(public.listar_financeiro_reconciliacao_pendencias('38000000-0000-0000-0000-000000000001') -> 'camisetas'),
  0,
  'reconciled shirt sources leave the pending list'
);

SELECT extensions.lives_ok(
  $$
    SELECT public.cancelar_financeiro_reconciliacao(
      (SELECT id FROM public.financeiro_reconciliacoes WHERE tipo = 'taxa' AND status = 'ativo')
    )
  $$,
  'manager can cancel an active reconciliation'
);

SELECT extensions.is(
  (SELECT status FROM public.financeiro_lancamentos WHERE origem = 'taxa'),
  'cancelado',
  'cancelling reconciliation cancels its finance receipt'
);

SELECT extensions.is(
  (
    SELECT status
    FROM public.financeiro_reconciliacao_itens
    WHERE fonte = 'participacao_taxa'
      AND fonte_id = '48000000-0000-0000-0000-000000000001'
  ),
  'cancelado',
  'cancelling reconciliation keeps an auditable cancelled source snapshot'
);

SELECT extensions.is(
  jsonb_array_length(public.listar_financeiro_reconciliacao_pendencias('38000000-0000-0000-0000-000000000001') -> 'taxas'),
  2,
  'cancelled sources become available for a new reconciliation'
);

SELECT extensions.throws_ok(
  $$
    SELECT public.cancelar_financeiro_reconciliacao(
      (SELECT id FROM public.financeiro_reconciliacoes WHERE tipo = 'taxa' AND status = 'cancelado')
    )
  $$,
  'P0001',
  'A reconciliação já está cancelada.',
  'a reconciliation cannot be cancelled twice'
);

RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
