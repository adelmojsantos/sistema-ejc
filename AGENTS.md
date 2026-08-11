# AGENTS.md

## Propósito

Este arquivo define como agentes de desenvolvimento devem trabalhar no **Sistema EJC Capelinha**.

O sistema está em produção e centraliza processos do Encontro de Jovens com Cristo, incluindo inscrições, participantes, equipes, visitação, compras, almoxarifado, financeiro, cronograma, atividades, pós-encontro, biblioteca, relatórios, administração e diagnósticos.

O objetivo do agente não é apenas fazer o código funcionar. Toda alteração deve preservar:

1. regras de negócio existentes;
2. integridade dos dados;
3. segurança e autorização;
4. compatibilidade com o sistema em produção;
5. qualidade e legibilidade do código;
6. experiência responsiva, principalmente em dispositivos móveis;
7. capacidade de validar a mudança por testes, lint e build.

---

## 1. Princípios de trabalho

Ao receber uma tarefa:

1. entenda o problema antes de alterar código;
2. localize o fluxo existente relacionado;
3. procure implementações semelhantes no projeto;
4. identifique regras de negócio e autorização envolvidas;
5. faça a menor alteração capaz de resolver corretamente o problema;
6. adicione ou atualize testes quando apropriado;
7. execute as verificações relevantes;
8. revise o diff antes de concluir.

Não faça refatorações amplas sem relação direta com a solicitação.

Não transforme uma correção localizada em uma reestruturação do projeto.

Não invente regras de negócio.

Quando houver dúvida, procure evidências nesta ordem:

1. código atual;
2. testes;
3. migrations, funções e policies;
4. documentação em `docs/`;
5. padrões de módulos semelhantes.

Se ainda existir ambiguidade relevante, explicite a hipótese adotada.

---

## 2. Stack principal

### Frontend

- React 19
- TypeScript 5.9
- Vite 7
- React Router 7
- Supabase JS
- Framer Motion
- TipTap
- React Markdown
- jsPDF
- SheetJS
- Leaflet / React Leaflet

### Backend e dados

- Supabase Auth
- PostgreSQL
- Row Level Security
- RPCs
- Edge Functions
- Supabase Storage

### Infraestrutura

- Vercel
- Cloudflare Workers
- Cloudflare R2
- GitHub Actions

### Qualidade

- ESLint
- TypeScript strict
- Vitest
- Testing Library
- Playwright
- pgTAP

### Gerenciador de pacotes

Use **pnpm**.

Não troque para npm ou yarn.

---

## 3. Estrutura principal

```text
.
├── .github/workflows/   # CI
├── cloudflare/          # Worker e integração R2
├── docs/                # Documentação funcional/técnica
├── e2e/                 # Testes Playwright
├── public/              # Arquivos públicos
├── scripts/             # Scripts administrativos
├── src/
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── pages/
│   ├── services/
│   ├── types/
│   └── utils/
└── supabase/
    ├── functions/
    ├── migrations/
    └── tests/
```

Há instruções complementares em:

- `src/AGENTS.md`
- `supabase/AGENTS.md`

Siga o arquivo mais específico aplicável à pasta em que estiver trabalhando.

---

## 4. Documentação relevante

Antes de modificar um domínio existente, procure a documentação correspondente.

Arquivos conhecidos:

- `docs/p4-homologacao-resiliencia.md`
- `docs/recuperacao-operacional.md`
- `docs/almoxarifado-fase-3-andamento.md`
- `docs/modulo-compras.md`
- `docs/relatorio-avaliacao-ia.md`
- `docs/supabase-cached-egress.md`
- `supabase/MIGRATIONS.md`

O `README.md` apresenta o sistema. Estes arquivos `AGENTS.md` definem regras de trabalho para agentes.

---

## 5. Escopo

Faça somente alterações necessárias para atender à solicitação.

Evite:

- reorganizar arquivos não relacionados;
- renomear componentes sem necessidade;
- trocar bibliotecas;
- alterar estilos globais para resolver problema local;
- reformatar arquivos inteiros sem necessidade;
- corrigir dívida técnica fora do escopo;
- criar abstrações desnecessárias;
- alterar APIs internas sem justificativa.

Se encontrar um problema fora do escopo, registre-o no resumo final.

---

## 6. Dependências

Antes de instalar uma dependência:

1. procure uma solução nativa;
2. verifique se o projeto já possui biblioteca adequada;
3. avalie impacto em bundle e manutenção;
4. adicione dependência somente quando houver necessidade real.

Nunca atualize dependências em massa como efeito colateral.

---

## 7. TypeScript

O projeto usa TypeScript `strict`.

Evite:

- `any`;
- `@ts-ignore`;
- casts desnecessários;
- duplicação de tipos;
- valores mágicos quando já existe enum ou constante.

Prefira:

- tipos explícitos nas fronteiras;
- inferência local quando clara;
- funções pequenas;
- early return;
- código legível.

Não silencie erros do compilador apenas para fazer o build passar.

---

## 8. Segurança

O sistema manipula dados pessoais e operações administrativas.

Nunca:

- exponha secrets;
- copie tokens para documentação;
- registre senhas ou tokens em logs;
- exponha `SUPABASE_SERVICE_ROLE_KEY` ao frontend;
- utilize credenciais privilegiadas em variáveis `VITE_*`;
- desative RLS para resolver um problema;
- torne uma policy mais permissiva sem analisar impacto;
- use dados pessoais reais em testes.

Arquivos `.env`, `.env.local` e equivalentes devem ser tratados como secretos.

É permitido usar nomes de variáveis em documentação e exemplos, mas nunca seus valores reais.

Se encontrar um secret aparentemente versionado, sinalize imediatamente.

---

## 9. Banco de dados

Mudanças estruturais devem ser realizadas por migration.

Nunca edite uma migration que já foi aplicada.

Correções de estrutura devem gerar uma nova migration.

Antes de alterar o banco:

1. leia `supabase/MIGRATIONS.md`;
2. identifique tabelas, views, funções, triggers e policies relacionadas;
3. avalie compatibilidade com dados existentes;
4. avalie RLS e autorização;
5. atualize testes SQL quando necessário.

Nunca aplique alterações no banco remoto sem solicitação explícita.

É aceitável executar validações não destrutivas, como dry-run, quando o ambiente permitir.

---

## 10. Regras de negócio

Não invente regras.

Antes de modificar uma regra:

1. encontre onde ela é aplicada;
2. procure testes existentes;
3. procure documentação;
4. verifique RPCs, functions, triggers ou policies relacionadas;
5. verifique outros módulos que dependem dela.

Preserve comportamento existente que não faz parte da solicitação.

---

## 11. Refatorações

Refatoração só deve ocorrer quando:

- for necessária para implementar a mudança com segurança;
- reduzir complexidade real;
- eliminar duplicação relevante;
- melhorar testabilidade;
- corrigir problema estrutural diretamente relacionado.

Refatorações devem preservar comportamento.

Não faça reestruturações preventivas ou especulativas.

---

## 12. Testes

Toda correção de bug deve considerar um teste que reproduza o problema.

Toda nova regra de negócio deve possuir teste quando tecnicamente viável.

Escolha o nível apropriado:

- função/utilitário: Vitest;
- componente: Testing Library;
- jornada crítica: Playwright;
- banco/RLS/RPC: pgTAP.

Não altere testes simplesmente para fazer uma implementação incorreta passar.

Se um teste contradiz a solicitação, investigue a regra antes de removê-lo.

---

## 13. Validação

Use os comandos adequados à mudança.

### Frontend

```bash
pnpm lint
pnpm test
pnpm run build
```

### Jornadas críticas

```bash
pnpm test:e2e
```

### Worker

```bash
pnpm worker:check
```

Não considere a tarefa concluída se a mudança introduzir erro de lint, TypeScript, teste ou build.

Erros ou warnings preexistentes devem ser diferenciados dos introduzidos pela alteração.

---

## 14. Git

Não faça automaticamente:

- push;
- merge;
- rebase;
- force push;
- deploy;
- alteração direta em `master`.

Não descarte mudanças existentes do usuário.

Nunca execute sem autorização explícita:

```bash
git reset --hard
git clean -fd
```

Antes de finalizar, revise:

```bash
git diff
```

Procure por:

- alterações fora do escopo;
- secrets;
- `console.log`;
- código temporário;
- TODOs acidentais;
- arquivos gerados indevidamente;
- mudanças de formatação sem necessidade.

---

## 15. Deploy e produção

O sistema está em produção.

Não execute deploy automaticamente.

Mudanças de frontend e banco devem permanecer compatíveis durante a janela de publicação.

Não introduza dependência de uma migration que ainda não esteja disponível quando isso puder quebrar o frontend atual.

Mudanças destrutivas exigem atenção especial a compatibilidade e rollback.

---

## 16. Critério de conclusão

Uma tarefa está concluída quando:

- a solicitação foi atendida;
- a alteração está limitada ao escopo;
- regras existentes foram preservadas;
- segurança foi considerada;
- TypeScript está válido;
- testes relevantes passam;
- lint passa quando aplicável;
- build passa quando aplicável;
- migrations estão corretas quando houver alteração de banco;
- o diff foi revisado.

---

## 17. Resposta final do agente

Ao concluir, informe objetivamente:

1. o que foi alterado;
2. principais arquivos modificados;
3. decisões importantes;
4. testes/verificações executados;
5. riscos, limitações ou pendências.

Nunca diga que algo foi validado se o comando correspondente não foi executado.
