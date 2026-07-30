# P4 — Homologação e resiliência operacional

## Objetivo

Confirmar que os fluxos críticos funcionam com os perfis reais, principalmente em
celulares, e que uma falha pode ser identificada e recuperada sem improvisação.

Os testes automatizados usam dados descartáveis e transações com `ROLLBACK`. O
roteiro manual deve usar registros de homologação claramente identificados e nunca
alterar um encontro encerrado.

## Critérios automatizados

A publicação só pode seguir quando a CI concluir:

- lint, testes unitários e build;
- jornadas públicas no Chromium em viewport móvel e desktop;
- reconstrução do banco desde as migrations;
- matriz de autorização de Administrador, Desenvolvedor, Coordenador,
  Almoxarifado, Financeiro e usuário sem permissão;
- troca transacional de Dirigência;
- finalização de compra com entrada no estoque, atualização do pedido e lançamento
  financeiro, sem duplicidade.

## Roteiro manual — acesso e senha

- [ ] Abrir a raiz do sistema no celular e confirmar o redirecionamento ao login.
- [ ] Solicitar primeiro acesso e confirmar que o e-mail fala em cadastrar senha.
- [ ] Abrir um link válido, cadastrar uma senha e entrar.
- [ ] Informar uma senha já cadastrada e confirmar que a tela oferece seguir para o
  login.
- [ ] Abrir um link expirado e confirmar a opção para solicitar outro.
- [ ] Confirmar que páginas públicas não geram chamadas autenticadas com `401`.

## Roteiro manual — perfis

- [ ] Usuário sem permissão não abre módulos internos.
- [ ] Administrador acessa a administração, mas não recebe Diagnósticos por herança.
- [ ] Desenvolvedor com `modulo_diagnosticos` acessa os registros de erro.
- [ ] Coordenador visualiza o estoque e cria pedidos, mas não administra cadastros
  nem opera a lista de compras sem permissão específica.
- [ ] Responsável pelo Almoxarifado opera a compra sem obter acesso administrativo.
- [ ] Responsável pelo Financeiro consulta e gerencia o livro-caixa sem obter acesso
  ao Almoxarifado.

## Roteiro manual — compra integrada

Usar um pedido de homologação com quantidade e valores pequenos:

- [ ] Criar e enviar um pedido.
- [ ] Gerar a lista de compras e marcar apenas parte da quantidade como comprada.
- [ ] Informar quantidade, valor unitário, fornecedor, valor da nota e comprovante.
- [ ] Finalizar e confirmar uma única entrada no estoque.
- [ ] Confirmar que o pedido ficou `parcial`.
- [ ] Confirmar uma única despesa no Financeiro, com o mesmo total e comprovante.
- [ ] Gerar a compra residual e concluir o restante.
- [ ] Confirmar que o pedido ficou `finalizado` e que os saldos foram consolidados.
- [ ] Tentar repetir a finalização e confirmar que o sistema impede duplicidade.

## Roteiro manual — troca de Dirigência

Executar somente quando a troca real estiver autorizada:

- [ ] Conferir os selecionados antes de finalizar as indicações.
- [ ] Preparar os acessos pendentes e concluir os primeiros acessos.
- [ ] Ativar a nova Dirigência.
- [ ] Confirmar que existe somente uma Dirigência ativa.
- [ ] Confirmar a remoção administrativa dos dirigentes anteriores.
- [ ] Confirmar o acesso dos novos dirigentes.
- [ ] Confirmar que administradores permanentes e Desenvolvedores foram preservados.
- [ ] Conferir o evento de auditoria da ativação.

## Registro do resultado

Para cada falha, registrar:

- data, usuário e perfil;
- rota e ação executada;
- resultado esperado e observado;
- captura de tela sem dados pessoais sensíveis;
- horário aproximado para correlação em Diagnósticos.

Uma falha em autorização, duplicidade financeira, estoque ou troca de Dirigência
bloqueia a publicação até a correção.
