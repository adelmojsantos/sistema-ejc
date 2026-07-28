# Novas Funções de Almoxarifado e Financeiro

## Objetivo

As novas funções do módulo de Compras foram criadas para controlar o ciclo completo de materiais e gastos do encontro:

1. Registrar o que existe no estoque.
2. Receber pedidos das equipes.
3. Cruzar pedidos com estoque disponível.
4. Gerar uma lista prática de compras.
5. Finalizar compras atualizando estoque e financeiro.
6. Guardar histórico com comprovantes.

O foco é reduzir controle manual em planilhas, evitar compra duplicada e dar rastreabilidade entre pedido, compra, estoque e caixa.

## Estrutura das Novas Funções

As novas telas estão organizadas em dois blocos:

- **Almoxarifado**: itens, unidades, categorias, estoque, pedidos, lista de compras e compras realizadas.
- **Financeiro**: entradas, saídas, categorias financeiras, lançamentos manuais e lançamentos automáticos vindos das compras.

## Almoxarifado

### 1. Cadastros Base

O almoxarifado possui cadastros próprios para organizar os itens antes de movimentar estoque ou gerar pedidos.

#### Categorias

Categorias agrupam os itens para facilitar filtros, leitura e organização.

Exemplos:

- Comida.
- Higiene.
- Papelaria.
- Uso geral.

Categorias podem ser ativadas ou inativadas. Itens antigos continuam preservados mesmo se a categoria for inativada.

#### Unidades

Unidades definem como o item será medido.

Exemplos:

- Unidade.
- Caixa.
- Pacote.
- Quilo.
- Litro.
- Garrafa.

As unidades evitam ambiguidades na compra e no estoque. Em vez de registrar apenas “10 arroz”, o sistema permite registrar “10 pacotes”, “10 kg” ou outra unidade adequada.

#### Itens

O cadastro de itens define o produto que poderá ser usado no estoque e nos pedidos.

Um item pode ter:

- Nome.
- Categoria.
- Unidade padrão.
- Marca sugerida.
- Fornecedor.
- Equipe/destino padrão.
- Observações.

O item é o cadastro base; o saldo é controlado separadamente.

### 2. Estoque

O estoque representa o que existe disponível para o encontro.

Cada saldo pode considerar:

- Encontro.
- Item.
- Categoria.
- Equipe/destino.
- Marca.
- Fornecedor.
- Validade.
- Quantidade.

Isso permite controlar o mesmo item em contextos diferentes. Por exemplo:

- Café para Café da Manhã.
- Café para Cozinha.
- Papel para Secretaria.

### 3. Movimentações de Estoque

O estoque pode ser alterado por movimentações.

#### Entrada

Usada para adicionar itens ao estoque.

Exemplos:

- Doação recebida.
- Compra finalizada.
- Material que sobrou de outro encontro e foi lançado no estoque atual.

#### Saída

Usada quando itens deixam o estoque.

Exemplos:

- Item entregue para uma equipe.
- Material consumido.
- Item descartado.

#### Ajuste

Usado para corrigir o saldo para uma quantidade exata.

Exemplo:

- O sistema mostra 12 unidades, mas a conferência física encontrou 10. O ajuste define o novo saldo como 10.

O ajuste de estoque não é a mesma coisa que ajuste financeiro.

## Pedidos das Equipes

### Função

Pedidos servem para as equipes informarem o que precisam.

O pedido nasce vinculado a:

- Encontro.
- Equipe solicitante.
- Itens necessários.
- Observações.

Admin e Compras podem criar pedidos para outras equipes. Isso ajuda quando algum coordenador tem dificuldade de acesso ou uso.

### Criação do Pedido

O primeiro campo do pedido é a equipe.

O nome do pedido é opcional. Se não for informado, o sistema gera um nome automático com equipe e data.

Exemplo:

`Pedido Cozinha - 28/07/2026`

### Itens do Pedido

Cada item pedido possui:

- Produto.
- Marca preferida.
- Quantidade necessária.
- Prioridade.
- Observações.

Depois que o item é adicionado, o sistema calcula automaticamente o quanto precisa ser comprado.

## Cruzamento entre Pedido e Estoque

O sistema compara o que a equipe pediu com o que já existe no estoque.

Para cada item, são calculados:

- **Necessário**: quantidade solicitada pela equipe.
- **Disponível líquido**: estoque disponível após considerar outros pedidos ativos.
- **A comprar**: quantidade que ainda precisa ser comprada.

### Exemplo

Estoque disponível:

- 10 caixas de um item.

Pedidos ativos:

- Café pede 6 caixas.
- Cozinha pede 10 caixas.

Resultado:

- O primeiro pedido pode consumir até 6 caixas do estoque.
- O segundo pedido passa a enxergar apenas 4 caixas disponíveis.
- O restante entra como quantidade a comprar.

Isso evita que o mesmo estoque seja usado mentalmente em dois pedidos diferentes.

### Cancelamento e Recalculo

Quando um pedido é cancelado ou um item é removido:

- A reserva lógica daquele pedido deixa de contar.
- Os pedidos relacionados são recalculados.
- Outros pedidos podem voltar a enxergar estoque disponível.

## Lista de Compras

### Função

A Lista de Compras transforma pedidos enviados em uma lista prática para quem vai comprar.

Ela mostra apenas itens com quantidade pendente de compra.

### Campos Operacionais

Cada item da lista permite informar:

- Comprado ou não comprado.
- Quantidade comprada.
- Valor unitário.
- Local da compra.
- Total calculado.

O campo **Local da compra** registra onde o item foi comprado.

Exemplos:

- Mercado A.
- Atacado.
- Açougue.
- Padaria.

Isso é útil porque uma mesma compra pode passar por vários locais buscando melhor preço.

### Compra Parcial

Se a quantidade comprada for menor que a quantidade necessária, o sistema mantém o restante como pendente.

Exemplo:

- Era necessário comprar 8 caixas.
- Foram compradas 4 caixas.
- A compra finaliza com 4 caixas.
- As outras 4 caixas continuam aparecendo como pendência em uma próxima lista.

### Finalizar Compra

Ao finalizar uma compra:

- Itens comprados entram automaticamente no estoque.
- Pedidos relacionados são atualizados.
- Quantidades pendentes continuam abertas.
- O total comprado gera uma saída automática no financeiro.

## Compras Realizadas

### Função

A tela de Compras Realizadas guarda o histórico das compras já finalizadas.

Ela permite abrir uma compra para conferência detalhada.

### Detalhes da Compra

Ao abrir uma compra realizada, é possível ver:

- Data.
- Valor total.
- Quantidade de itens.
- Itens comprados.
- Quantidade por item.
- Valor unitário.
- Local da compra.
- Total por item.
- Comprovantes anexados.

### Comprovantes

Uma compra pode ter vários comprovantes.

Esse comportamento foi pensado para uma situação comum:

- A equipe sai com uma lista.
- Compra parte dos itens em um mercado.
- Compra outros itens em outro mercado.
- Compra carne ou pão em outro local.
- Ao final, anexa todos os comprovantes na mesma compra realizada.

É possível:

- Anexar comprovantes depois da compra finalizada.
- Anexar mais de um comprovante.
- Remover comprovantes anexados.

## Financeiro

### Função

O financeiro registra o livro-caixa do encontro.

Ele trabalha com dois tipos:

- **Entrada**: soma no saldo.
- **Saída**: subtrai do saldo.

Não existe mais o tipo financeiro “Ajuste”. Se for necessário registrar um ajuste financeiro, a orientação é criar uma categoria chamada `Ajuste` e lançar como Entrada ou Saída.

### Categorias Financeiras

Categorias financeiras servem para classificar lançamentos.

Cada categoria pode ser vinculada a:

- Entrada.
- Saída.
- Todos os tipos.

Exemplos:

- Doações.
- Almoxarifado / Compras.
- Reembolso.
- Sobras de caixa.
- Ajuste.

### Lançamentos Manuais

Lançamentos manuais podem ser usados para registrar movimentações que não nasceram automaticamente de uma compra.

Campos principais:

- Tipo.
- Categoria.
- Descrição.
- Valor.
- Data.
- Observações.
- Comprovantes.

Lançamentos manuais podem ser editados ou cancelados.

### Lançamentos Automáticos

Quando uma compra é finalizada no almoxarifado, o sistema gera uma saída automática no financeiro.

Esse lançamento mantém vínculo com a compra de origem.

Por isso, se houver erro em uma compra, a correção deve acontecer no fluxo da compra/almoxarifado, não diretamente no lançamento financeiro automático.

## Integração entre Almoxarifado e Financeiro

O fluxo integrado funciona assim:

1. Equipe cria ou solicita um pedido.
2. O sistema cruza pedido com estoque.
3. Compras gera lista do que falta comprar.
4. Compras registra quantidade, valor e local.
5. Compra é finalizada.
6. Estoque recebe entrada automática.
7. Financeiro recebe saída automática.
8. Compra realizada fica disponível para conferência e comprovantes.

## Boas Práticas

- Conferir o estoque antes de criar compras grandes.
- Usar unidades bem definidas para evitar erro de quantidade.
- Criar pedidos por equipe para manter rastreabilidade.
- Registrar local da compra em cada item.
- Finalizar compra apenas depois de revisar quantidades e valores.
- Anexar todos os comprovantes relacionados à compra.
- Usar categorias financeiras claras.
- Evitar permissões globais quando o acesso deve valer apenas para um encontro.

## Resumo Rápido

- **Almoxarifado** controla itens e estoque.
- **Pedidos** dizem o que as equipes precisam.
- **Cruzamento de estoque** evita compra desnecessária.
- **Lista de Compras** orienta quem está comprando.
- **Finalização** atualiza estoque e financeiro.
- **Compras Realizadas** guardam histórico e comprovantes.
- **Financeiro** consolida entradas, saídas e saldo.
