# PLANS.md

## Propósito

Este arquivo define como agentes devem planejar alterações complexas no Sistema EJC Capelinha.

Não é necessário criar um plano formal para toda tarefa.

Use este processo quando a alteração envolver múltiplos módulos, banco de dados, autorização, migrações, regras de negócio relevantes ou risco elevado de regressão.

---

## Quando criar um plano

Crie um plano explícito quando a tarefa envolver um ou mais destes casos:

- novo módulo;
- mudança ampla de fluxo;
- alteração de banco + frontend;
- alteração de RLS;
- nova RPC;
- integração externa;
- migração de dados;
- alteração de arquitetura;
- mudança em processo financeiro;
- alteração em compras/almoxarifado;
- autenticação/autorização;
- mudança que atinja várias páginas;
- correção cuja causa raiz ainda não esteja clara.

Para alterações simples e localizadas, trabalhe diretamente.

---

## Estrutura recomendada

### 1. Objetivo

Descreva o comportamento que deve existir ao final.

Evite descrever apenas arquivos que serão alterados.

### 2. Estado atual

Registre:

- como o fluxo funciona hoje;
- arquivos relevantes;
- tabelas/RPCs envolvidas;
- regras e permissões existentes;
- testes existentes.

### 3. Problema

Explique a causa que precisa ser tratada.

Diferencie sintoma de causa raiz.

### 4. Estratégia

Defina a menor solução completa.

Informe:

- mudanças de frontend;
- mudanças de banco;
- mudanças de autorização;
- migração de dados;
- testes necessários;
- compatibilidade com produção.

### 5. Implementação

Divida em passos executáveis.

Exemplo:

1. criar migration;
2. atualizar RPC;
3. atualizar tipos;
4. atualizar service;
5. atualizar interface;
6. adicionar testes;
7. executar validações;
8. revisar diff.

### 6. Riscos

Considere:

- perda de dados;
- regressão;
- permissões;
- incompatibilidade de deploy;
- usuários antigos;
- registros legados;
- falha de serviços externos.

### 7. Validação

Liste exatamente como confirmar a implementação.

Exemplo:

```bash
pnpm lint
pnpm test
pnpm run build
pnpm test:e2e
```

Quando houver banco:

- testes pgTAP;
- Supabase local quando disponível;
- `db push --linked --dry-run`.

---

## Regras para execução

O plano é um guia, não uma justificativa para ampliar escopo.

Durante a implementação:

- atualize a estratégia se descobrir informação nova;
- preserve decisões já confirmadas;
- não continue uma abordagem claramente incorreta só porque estava no plano;
- documente mudanças relevantes de direção.

---

## Exemplo

### Objetivo

Permitir que coordenadores visualizem avaliações de sua própria equipe sem obter acesso às avaliações de outras equipes.

### Estado atual

- avaliações estão em tabela protegida por RLS;
- dirigentes possuem acesso amplo;
- coordenadores possuem vínculo com equipe/encontro;
- frontend oculta a página para usuários não autorizados.

### Problema

A interface pode ser ajustada, mas apenas isso não garante segurança. É necessária autorização efetiva no banco.

### Estratégia

1. identificar vínculo coordenador-equipe;
2. criar policy ou função reutilizando a matriz de permissões existente;
3. limitar SELECT às avaliações da equipe vinculada;
4. liberar rota/interface somente quando houver permissão;
5. adicionar teste pgTAP para coordenador da equipe e coordenador de outra equipe;
6. adicionar teste frontend se houver lógica de interface nova.

### Validação

- coordenador A vê equipe A;
- coordenador A não vê equipe B;
- dirigente mantém acesso atual;
- usuário sem perfil continua sem acesso;
- lint, testes e build passam.

---

## Definição de pronto

O plano só é considerado executado quando:

- comportamento final foi implementado;
- segurança foi verificada;
- testes relevantes passam;
- build/lint necessários passam;
- mudanças fora do escopo não foram incluídas;
- riscos restantes foram reportados.
