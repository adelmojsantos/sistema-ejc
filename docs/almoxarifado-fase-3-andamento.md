# Almoxarifado — andamento até a Fase 3

## Contexto

O módulo de Almoxarifado foi criado dentro do hub de Compras para controlar estoque contínuo, pedidos por equipe e lista operacional de compras.

## Fase 1 — Estoque

- Criado submódulo de Estoque/Almoxarifado.
- Criados cadastros de categorias, unidades e itens.
- Estoque trabalha com saldos por encontro, item, equipe/destino, marca, fornecedor e validade.
- Movimentações de entrada, saída e ajuste ficam auditadas.
- UI responsiva com cards no mobile e tabela no desktop.

## Fase 2 — Pedidos

- Criada tela de Pedidos no sub-hub do Almoxarifado.
- Pedido usa equipe solicitante como primeiro campo.
- Nome do pedido é opcional; quando vazio, é gerado automaticamente.
- Admin/Compras podem criar pedido para qualquer equipe.
- Campo de origem/observação aparece apenas para Admin/Compras/gerência.
- Itens do pedido cruzam com estoque disponível.
- Cálculo considera outros pedidos ativos do mesmo item/marca, alocando estoque por ordem de criação.
- Cancelar pedido libera estoque reservado e recalcula pedidos relacionados.
- Remover item também recalcula pedidos relacionados.
- Duplo clique em ações críticas foi bloqueado.

## Fase 3 — Lista de Compras

- Criada tela Lista de Compras no sub-hub do Almoxarifado.
- Gera checklist a partir de pedidos enviados.
- Cada item tem quantidade a comprar, quantidade comprada, valor unitário, valor total, mercado/fornecedor e status.
- Edição passou a ser inline na própria linha, sem modal.
- Status usa checkboxes: Comprou e Não comprou.
- Ao lançar quantidade e valor unitário, o item é marcado automaticamente como comprado.
- Total calculado da compra é atualizado a partir dos itens comprados.

## Complementos concluídos após a Fase 3

- Finalização transacional da compra.
- Entrada automática no estoque para os itens comprados.
- Atualização dos pedidos para parcial ou finalizado.
- Upload de mais de um comprovante por compra.
- Valor total informado da nota e conferência da diferença para o valor calculado.
- Lançamento automático da despesa no livro-caixa do Financeiro.
- Proteção contra lançamento duplicado no estoque e no Financeiro.
- Manutenção da rastreabilidade por item de pedido. Itens iguais podem compartilhar o
  mesmo saldo físico, mas a origem da necessidade continua identificável.

## Homologação operacional

A implementação está concluída. A validação com os responsáveis por Almoxarifado e
Financeiro deve seguir o roteiro de
[`p4-homologacao-resiliencia.md`](./p4-homologacao-resiliencia.md).

## Migrations criadas

- `supabase/migrations/20260724100000_create_almoxarifado_phase1.sql`
- `supabase/migrations/20260724110000_create_almoxarifado_pedidos_phase2.sql`
- `supabase/migrations/20260724112000_fix_pedido_stock_reservations.sql`
- `supabase/migrations/20260724113000_fix_pedido_stock_allocation_order.sql`
- `supabase/migrations/20260724120000_create_almoxarifado_compras_phase3.sql`
- `supabase/migrations/20260727100000_fix_almoxarifado_compra_residual.sql`
- `supabase/migrations/20260727102000_add_almoxarifado_compra_comprovantes_urls.sql`
- `supabase/migrations/20260727103000_finalize_almoxarifado_compra_stock.sql`
- `supabase/migrations/20260727104000_consolidate_almoxarifado_auto_stock.sql`
- `supabase/migrations/20260727110000_create_financeiro_livro_caixa.sql`
- `supabase/migrations/20260727111000_integrate_almoxarifado_compra_financeiro.sql`

