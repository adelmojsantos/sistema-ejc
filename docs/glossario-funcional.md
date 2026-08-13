# Glossário funcional

Este documento define os termos exibidos na interface do Sistema EJC Capelinha.
Os nomes técnicos legados podem permanecer no código e no banco para preservar
compatibilidade, mas não devem alterar a linguagem apresentada ao usuário.

## Pessoas e papéis no encontro

### Encontrista

Pessoa inscrita para vivenciar o encontro. Tecnicamente, é a participação cujo
campo `participante` é `true`.

O encontrista é **visitado** pela equipe de Visitação. Ele não deve ser chamado
de visitante. Círculos, visita, intenção de camiseta e fotos da família estão
associados a esse papel quando aplicável.

### Encontreiro

Pessoa que trabalha em uma equipe do encontro. Tecnicamente, é a participação
cujo campo `participante` é `false` e que possui vínculo de trabalho no encontro.

Confirmação de dados da equipe, pedido de camiseta, veículo da Recepção e filhos
na Recreação Infantil são informações relacionadas a encontreiros.

### Visitante

Integrante da equipe de trabalho Visitação que realiza as visitas aos
encontristas. Os visitantes são organizados em Duplas de Visitação.

## Camisetas

### Intenção de camiseta

Interesse informado por um encontrista durante a visita. Não é pedido formal e
pode permanecer sem pagamento.

### Pedido de camiseta

Solicitação feita por um encontreiro por meio de sua equipe. Não se deve
converter automaticamente uma intenção de encontrista em pedido.

Quando uma tela reúne os dois fluxos, use **pedidos e intenções de camisetas** e
identifique a origem de cada registro.

## Situação da participação

### Desistente

Encontrista marcado pela Visitação como desistente, antes ou depois de a visita
ser realizada. A ação deve ser apresentada como **Marcar como desistente**.

### Participação cancelada

Cancelamento administrativo feito por quem possui acesso direto aos cadastros,
como Administração ou Secretaria. A ação deve ser apresentada como **Cancelar
participação**.

Os dois eventos podem compartilhar estruturas técnicas de histórico, mas não
devem receber o mesmo nome na interface.

## Financeiro

### Conciliação

Processo de conferir os pagamentos recebidos e registrar o lançamento
financeiro correspondente. Use **Conciliar** para a ação, **Conciliação
registrada** para o estado ativo e **Conciliação cancelada** quando revertida.

O termo **reconciliação** pode permanecer em identificadores técnicos legados,
mas não deve ser exibido na interface.

## Confirmação e contexto

- **Dados confirmados:** confirmação individual dos dados cadastrais.
- **Confirmação da equipe finalizada:** revisão, correção quando necessária e
  conclusão da equipe pelo coordenador.
- **Edição selecionada:** encontro que fornece o contexto atual da tela.
- **Ativo** e **Histórico:** estados visuais da edição selecionada.
