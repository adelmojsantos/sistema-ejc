# AGENTS.md — Supabase

Estas instruções complementam o `AGENTS.md` da raiz e se aplicam ao conteúdo de `supabase/`.

Mudanças nesta pasta podem afetar diretamente dados e segurança de produção.

## 1. Regra principal

Toda alteração estrutural de banco deve ser feita por uma **nova migration**.

Nunca edite uma migration já aplicada para corrigir comportamento atual.

Leia sempre:

```text
supabase/MIGRATIONS.md
```

antes de mudanças estruturais.

---

## 2. Nome das migrations

Use o padrão:

```text
YYYYMMDDHHMMSS_descricao_da_mudanca.sql
```

A versão deve ser única.

Use nomes objetivos e relacionados à alteração.

---

## 3. Segurança

Nunca:

- desabilite RLS como solução;
- exponha `service_role`;
- torne policies amplamente permissivas por conveniência;
- confie apenas na autorização do frontend;
- registre secrets;
- coloque dados pessoais reais em fixtures;
- use `SECURITY DEFINER` sem analisar implicações.

Toda operação administrativa deve possuir controle de autorização efetivo no banco ou servidor.

---

## 4. Row Level Security

Antes de alterar uma policy:

1. identifique a tabela afetada;
2. liste operações envolvidas: SELECT, INSERT, UPDATE e DELETE;
3. identifique grupos/perfis envolvidos;
4. procure policies existentes;
5. procure funções auxiliares de autorização;
6. procure testes pgTAP relacionados;
7. verifique impacto em fluxos públicos e autenticados.

Não amplie uma policy para resolver um caso particular se for possível representar a regra corretamente.

---

## 5. RPCs e funções PostgreSQL

Ao alterar RPC ou função:

- preserve contratos utilizados pelo frontend;
- verifique parâmetros e tipos de retorno;
- procure chamadas existentes antes de mudar assinatura;
- avalie `SECURITY INVOKER` vs `SECURITY DEFINER`;
- defina `search_path` de forma segura quando necessário;
- valide autorização internamente quando a função executar operação privilegiada.

Não confie em parâmetros enviados pelo cliente para determinar autorização.

---

## 6. SECURITY DEFINER

Use apenas quando necessário.

Quando utilizar:

1. explique no SQL ou documentação a razão;
2. restrinja execução;
3. valide explicitamente o usuário chamador;
4. configure `search_path` seguro;
5. evite SQL dinâmico desnecessário;
6. teste usuários autorizados e não autorizados.

Uma função `SECURITY DEFINER` não deve virar atalho para contornar RLS.

---

## 7. Integridade dos dados

Antes de modificar coluna, constraint ou relacionamento:

- verifique dados existentes;
- considere valores nulos;
- considere registros legados;
- considere foreign keys;
- considere cascatas;
- considere índices;
- considere triggers;
- considere views e funções dependentes.

Evite operações destrutivas quando uma migração em etapas puder preservar compatibilidade.

---

## 8. Compatibilidade de deploy

Frontend e banco podem não ser publicados exatamente no mesmo instante.

Por isso:

- prefira mudanças retrocompatíveis;
- adicione antes de remover;
- evite renomear diretamente campos usados pelo frontend;
- considere migração em duas etapas para mudanças incompatíveis.

Exemplo preferido:

1. adicionar nova coluna;
2. adaptar código;
3. migrar dados;
4. remover coluna antiga em alteração futura.

---

## 9. Idempotência

Quando fizer sentido, escreva SQL tolerante à reaplicação controlada.

Use com cuidado:

- `IF EXISTS`;
- `IF NOT EXISTS`;
- blocos `DO`;
- verificações explícitas.

Idempotência não deve esconder erro de modelagem ou inconsistência histórica.

---

## 10. Dados existentes

Nunca presuma banco vazio.

O Sistema EJC possui dados de produção.

Antes de usar:

```sql
ALTER TABLE ... SET NOT NULL
```

garanta que registros existentes atendam à regra.

Antes de adicionar constraint, valide dados legados.

Antes de remover coluna/tabela, procure referências em:

- frontend;
- RPCs;
- functions;
- triggers;
- views;
- testes;
- scripts;
- documentação.

---

## 11. Edge Functions

Para `supabase/functions/`:

- secrets devem vir do ambiente;
- nunca coloque credenciais no código;
- valide entrada;
- trate erros externos;
- evite retornar detalhes internos;
- mantenha autorização explícita;
- considere timeout e falhas de integração;
- não torne fluxo administrativo essencial dependente de IA externa sem fallback adequado.

Ao alterar integração com Gemini ou serviços externos, preserve comportamento dos fluxos essenciais quando o serviço estiver indisponível.

---

## 12. Storage

Ao trabalhar com Supabase Storage:

- verifique políticas do bucket;
- diferencie conteúdo público e privado;
- não torne bucket privado público por conveniência;
- use URLs assinadas quando apropriado;
- preserve controles de acesso a comprovantes e documentos privados.

Imagens públicas podem utilizar a infraestrutura Cloudflare Worker + R2 conforme arquitetura existente.

---

## 13. Testes de banco

Mudanças de:

- RLS;
- autorização;
- RPC;
- trigger;
- função;
- regra crítica;

devem considerar testes em `supabase/tests/`.

Use pgTAP quando aplicável.

Teste pelo menos:

- caso autorizado;
- caso não autorizado;
- caso limite relevante.

Não remova teste de segurança para fazer migration passar.

---

## 14. Validação de migration

Quando disponível, execute primeiro:

```bash
pnpm dlx supabase@2.110.0 db push --linked --dry-run
```

Não execute:

```bash
pnpm dlx supabase@2.110.0 db push --linked
```

sem solicitação explícita do usuário.

Não aplique migration diretamente em produção por iniciativa própria.

---

## 15. Rollback e recuperação

Para mudanças arriscadas, considere previamente como reverter.

PostgreSQL migrations de produção não devem depender da ideia de que um rollback automático sempre será possível.

Prefira migrations corretivas e estratégias compatíveis com dados existentes.

Consulte `docs/recuperacao-operacional.md` para incidentes e recuperação.

---

## 16. Checklist Supabase

Antes de concluir:

- [ ] nova migration criada quando necessário;
- [ ] migrations antigas não foram editadas;
- [ ] compatibilidade com dados existentes foi analisada;
- [ ] RLS foi avaliada;
- [ ] RPCs/functions dependentes foram verificadas;
- [ ] nenhuma credencial foi adicionada;
- [ ] alterações destrutivas foram evitadas ou justificadas;
- [ ] testes pgTAP foram adicionados/atualizados quando pertinente;
- [ ] dry-run foi executado quando disponível;
- [ ] nenhum push remoto foi executado sem autorização;
- [ ] diff foi revisado.
