# Relatório estruturado de avaliações com IA

## Arquitetura

O processamento permanece no backend. O navegador somente inicia e solicita a
próxima unidade de trabalho; respostas, prompts, chave da IA e gravações são
tratados pela Edge Function `gerar-resumo-avaliacao`.

Uma geração segue este fluxo:

1. `start` cria um relatório e uma seção para cada pergunta.
2. `process` reserva atomicamente uma seção.
3. A seção processa até 60 respostas por chamada e salva o JSON parcial.
4. Se houver mais de um lote, uma chamada adicional consolida a pergunta.
5. Depois de todas as perguntas, outra chamada produz a visão geral.
6. O relatório recebe `completed` e o JSON final.

Essa granularidade evita manter uma Edge Function aberta durante todo o
relatório. Se a aba fechar, os parciais permanecem no banco e o botão
“Continuar relatório” retoma a fila.

## Persistência e concorrência

`avaliacao_resumos_ia` foi mantida para preservar os resumos Markdown antigos e
passou a representar uma execução de relatório. Ela armazena status, progresso,
erro, versão, timestamps e `resultado` JSON.

`avaliacao_resumo_ia_secoes` armazena o progresso e o resultado de cada
pergunta. A função SQL `claim_avaliacao_resumo_ia_secao` usa `FOR UPDATE SKIP
LOCKED`, impedindo que duas requisições processem a mesma etapa. Um índice
parcial permite somente um relatório `pending`/`generating` por encontro.

Os status são:

- `pending`: execução criada, aguardando processamento;
- `generating`: há lotes ou consolidações em andamento;
- `completed`: JSON final disponível;
- `error`: falha persistida e apta a nova tentativa.

## Privacidade e fidelidade

Antes do envio ao Gemini, HTML é removido, respostas são limitadas em tamanho e
nomes conhecidos, e-mails, telefones e documentos são anonimizados. Os
resultados parciais não armazenam as respostas originais.

Os pontos negativos usam `equipesOrigem`: equipes dos respondentes que
relataram o tema, acompanhadas da quantidade aproximada de relatos. Essa
informação não atribui responsabilidade pelo problema. O relatório não infere
criticidade, causas ou equipes responsáveis.

Os prompts tratam as respostas como conteúdo não confiável, proíbem fatos e
contagens inventados e exigem JSON conforme schema. Os schemas e os dois
prompts (pergunta/consolidação geral) ficam na própria Edge Function.

## Limites e custo

O custo aproximado é uma chamada por lote de 60 respostas, mais uma consolidação
para cada pergunta com múltiplos lotes e uma consolidação geral. O lote limita
tokens sem descartar respostas nem usar apenas as primeiras ocorrências.

O frontend conduz a fila para não depender de uma execução longa. Para
processamento totalmente autônomo mesmo sem uma aba aberta, a mesma ação
`process` pode ser chamada por um worker ou agendamento; a reserva atômica já
torna esse consumidor seguro.

As chamadas são espaçadas para respeitar limites por minuto. Quando o Gemini
responde `429`, a Edge Function lê o `RetryInfo`, devolve `retryAfterMs` sem
marcar a etapa como erro e o frontend retoma automaticamente depois da janela
indicada. Respostas `5xx` recebem tentativas curtas antes do fallback de modelo.

Antes de consolidar vários lotes, os parciais são normalizados e compactados
(limites de itens, exemplos e tamanho de texto). Isso evita crescimento
quadrático do prompt e saídas truncadas. Um timeout do provedor também devolve a
etapa para `pending`, permitindo nova tentativa sem descartar resultados já
concluídos.

## Implantação

1. Aplicar a migration `20260630120000_structured_ai_evaluation_reports.sql`.
2. Implantar a Edge Function `gerar-resumo-avaliacao`.
3. Confirmar os secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `GEMINI_API_KEY` e, opcionalmente, `GEMINI_MODEL`.
4. Implantar o frontend.
