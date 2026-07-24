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

## Ainda pendente na Fase 3

- Finalizar compra.
- Ao finalizar, dar entrada automática no estoque para itens comprados.
- Atualizar pedidos para parcial/finalizado conforme os itens comprados.
- Upload de comprovante da compra.
- Campo de valor total informado da nota e conferência de diferença.
- Avaliar se a lista deve consolidar itens iguais de pedidos diferentes ou manter rastreabilidade por pedido.

## Migrations criadas

- `supabase/migrations/20260724100000_create_almoxarifado_phase1.sql`
- `supabase/migrations/20260724110000_create_almoxarifado_pedidos_phase2.sql`
- `supabase/migrations/20260724112000_fix_pedido_stock_reservations.sql`
- `supabase/migrations/20260724113000_fix_pedido_stock_allocation_order.sql`
- `supabase/migrations/20260724120000_create_almoxarifado_compras_phase3.sql`

