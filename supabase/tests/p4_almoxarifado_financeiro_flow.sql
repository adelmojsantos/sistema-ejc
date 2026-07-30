BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(14);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES (
  '14000000-0000-0000-0000-000000000001',
  'p4.purchase-operator@example.test',
  'authenticated',
  'authenticated',
  crypt('fixture-password', gen_salt('bf')),
  now(), now(), now(), false, false
);

INSERT INTO public.grupos (id, nome, descricao)
VALUES (
  '64000000-0000-0000-0000-000000000001',
  'P4 Operação de Compras',
  'Fixture transacional'
);

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '64000000-0000-0000-0000-000000000001', id
FROM public.permissoes
WHERE chave = 'almoxarifado_compras_operar';

INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
VALUES (
  '14000000-0000-0000-0000-000000000001',
  '64000000-0000-0000-0000-000000000001',
  NULL
);

INSERT INTO public.encontros (
  id, nome, data_inicio, data_fim, ativo, edicao
)
VALUES (
  '34000000-0000-0000-0000-000000000001',
  'P4 integrated purchase fixture',
  current_date,
  current_date + 2,
  false,
  999902
);

INSERT INTO public.equipes (id, nome)
VALUES (
  '24000000-0000-0000-0000-000000000001',
  'P4 Equipe Cozinha'
);

INSERT INTO public.almoxarifado_categorias (id, nome)
VALUES (
  '74000000-0000-0000-0000-000000000001',
  'P4 Categoria'
);

INSERT INTO public.almoxarifado_unidades (id, nome, sigla)
VALUES (
  '75000000-0000-0000-0000-000000000001',
  'P4 Unidade',
  'P4U'
);

INSERT INTO public.almoxarifado_itens (
  id, nome, categoria_id, unidade_id
)
VALUES (
  '76000000-0000-0000-0000-000000000001',
  'P4 Item integrado',
  '74000000-0000-0000-0000-000000000001',
  '75000000-0000-0000-0000-000000000001'
);

INSERT INTO public.almoxarifado_pedidos (
  id, encontro_id, solicitante_equipe_id, criado_por_usuario_id,
  status, titulo
)
VALUES (
  '44000000-0000-0000-0000-000000000001',
  '34000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000001',
  '14000000-0000-0000-0000-000000000001',
  'enviado',
  'P4 Pedido integrado'
);

INSERT INTO public.almoxarifado_pedido_itens (
  id, pedido_id, item_id, quantidade_necessaria,
  quantidade_disponivel, quantidade_a_comprar
)
VALUES (
  '45000000-0000-0000-0000-000000000001',
  '44000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000001',
  10,
  0,
  10
);

INSERT INTO public.almoxarifado_compras (
  id, encontro_id, status, criado_por_usuario_id
)
VALUES (
  '46000000-0000-0000-0000-000000000001',
  '34000000-0000-0000-0000-000000000001',
  'aberta',
  '14000000-0000-0000-0000-000000000001'
);

INSERT INTO public.almoxarifado_compra_itens (
  id, compra_id, pedido_item_id, item_id,
  quantidade_a_comprar, quantidade_comprada, status
)
VALUES (
  '47000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000001',
  '45000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000001',
  10,
  10,
  'pendente'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '14000000-0000-0000-0000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $$
    SELECT public.finalizar_compra_almoxarifado(
      '46000000-0000-0000-0000-000000000001',
      '[{
        "id": "47000000-0000-0000-0000-000000000001",
        "status": "comprou",
        "quantidade_comprada": 6,
        "valor_unitario": 2.50,
        "mercado_fornecedor": "Mercado P4",
        "observacoes": "Compra parcial de homologação"
      }]'::jsonb,
      '["https://example.test/comprovante-p4.pdf"]'::jsonb
    )
  $$,
  'authorized operator can finalize an integrated purchase'
);

RESET ROLE;

SELECT extensions.is(
  (
    SELECT status
    FROM public.almoxarifado_compras
    WHERE id = '46000000-0000-0000-0000-000000000001'
  ),
  'finalizada',
  'purchase is finalized'
);
SELECT extensions.is(
  (
    SELECT valor_total_calculado
    FROM public.almoxarifado_compras
    WHERE id = '46000000-0000-0000-0000-000000000001'
  ),
  15.00::numeric,
  'calculated purchase total is persisted'
);
SELECT extensions.is(
  (
    SELECT comprovantes_urls
    FROM public.almoxarifado_compras
    WHERE id = '46000000-0000-0000-0000-000000000001'
  ),
  '["https://example.test/comprovante-p4.pdf"]'::jsonb,
  'purchase proof is persisted'
);
SELECT extensions.ok(
  (
    SELECT estoque_lancado_em IS NOT NULL
    FROM public.almoxarifado_compras
    WHERE id = '46000000-0000-0000-0000-000000000001'
  ),
  'stock posting time is recorded'
);
SELECT extensions.ok(
  (
    SELECT financeiro_lancado_em IS NOT NULL
    FROM public.almoxarifado_compras
    WHERE id = '46000000-0000-0000-0000-000000000001'
  ),
  'finance posting time is recorded'
);
SELECT extensions.is(
  (
    SELECT quantidade
    FROM public.almoxarifado_saldos
    WHERE encontro_id = '34000000-0000-0000-0000-000000000001'
      AND item_id = '76000000-0000-0000-0000-000000000001'
      AND equipe_id = '24000000-0000-0000-0000-000000000001'
  ),
  6.000::numeric,
  'bought quantity enters the destination stock'
);
SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.almoxarifado_movimentacoes
    WHERE encontro_id = '34000000-0000-0000-0000-000000000001'
      AND item_id = '76000000-0000-0000-0000-000000000001'
      AND tipo = 'entrada'
  ),
  1::bigint,
  'exactly one automatic stock movement is created'
);
SELECT extensions.is(
  (
    SELECT status
    FROM public.almoxarifado_pedidos
    WHERE id = '44000000-0000-0000-0000-000000000001'
  ),
  'parcial',
  'order remains partial when only part of the need was bought'
);
SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.financeiro_lancamentos
    WHERE origem = 'almoxarifado_compra'
      AND origem_id = '46000000-0000-0000-0000-000000000001'
      AND status = 'ativo'
  ),
  1::bigint,
  'exactly one active finance posting is created'
);
SELECT extensions.is(
  (
    SELECT valor
    FROM public.financeiro_lancamentos
    WHERE origem = 'almoxarifado_compra'
      AND origem_id = '46000000-0000-0000-0000-000000000001'
      AND status = 'ativo'
  ),
  15.00::numeric,
  'finance posting uses the calculated purchase total'
);
SELECT extensions.is(
  (
    SELECT comprovantes_urls
    FROM public.financeiro_lancamentos
    WHERE origem = 'almoxarifado_compra'
      AND origem_id = '46000000-0000-0000-0000-000000000001'
      AND status = 'ativo'
  ),
  '["https://example.test/comprovante-p4.pdf"]'::jsonb,
  'finance posting keeps the purchase proof'
);

SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$
    SELECT public.finalizar_compra_almoxarifado(
      '46000000-0000-0000-0000-000000000001',
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'P0001',
  'Compra já teve entrada lançada no estoque.',
  'purchase cannot post stock twice'
);
RESET ROLE;

SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.almoxarifado_movimentacoes
    WHERE encontro_id = '34000000-0000-0000-0000-000000000001'
      AND item_id = '76000000-0000-0000-0000-000000000001'
      AND tipo = 'entrada'
  ),
  1::bigint,
  'failed duplicate finalization leaves a single stock movement'
);

SELECT * FROM extensions.finish();
ROLLBACK;
