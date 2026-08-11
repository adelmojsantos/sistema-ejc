# AGENTS.md — Frontend

Estas instruções complementam o `AGENTS.md` da raiz e se aplicam ao conteúdo de `src/`.

## 1. Arquitetura

O frontend utiliza React + TypeScript + Vite.

A estrutura principal é:

```text
src/
├── components/
├── contexts/
├── hooks/
├── pages/
├── services/
├── types/
└── utils/
```

Antes de criar algo novo, procure implementações equivalentes nessas pastas.

---

## 2. Componentes

Antes de criar um novo componente:

1. procure componente reutilizável existente;
2. observe componentes do mesmo módulo;
3. preserve padrão visual e comportamento responsivo;
4. evite duplicação de lógica.

Componentes devem permanecer focados em apresentação e interação sempre que possível.

Evite componentes excessivamente grandes. Extraia partes quando houver responsabilidade claramente independente.

Não crie abstrações genéricas para um único uso sem benefício concreto.

---

## 3. Hooks e estado

Use hooks para lógica reutilizável.

Evite:

- `useEffect` para valores que podem ser derivados diretamente;
- sincronização manual de estados redundantes;
- estado global sem necessidade;
- efeitos com dependências incorretas;
- mutação direta de objetos/arrays de estado.

Antes de criar Context novo, verifique se a necessidade realmente é global.

---

## 4. Acesso a dados

Quando o módulo possuir `service` ou hook de dados, mantenha o acesso ao Supabase nessa camada.

Evite espalhar chamadas diretas ao Supabase em componentes de apresentação.

Prefira uma separação clara entre:

- interface;
- estado;
- regra de negócio;
- acesso a dados.

Quando já existir padrão diferente no módulo, preserve consistência local antes de criar uma nova arquitetura.

---

## 5. Autorização

Permissões verificadas no frontend existem para experiência do usuário, não para segurança definitiva.

Nunca trate ocultar um botão como substituto para RLS ou validação no backend.

Ao adicionar ação administrativa:

1. verifique a permissão usada pela interface;
2. verifique a proteção correspondente no banco/RPC;
3. preserve o comportamento para perfis sem acesso.

---

## 6. TypeScript

Evite `any`.

Se um dado externo não possuir tipo confiável:

- crie tipo apropriado;
- valide quando necessário;
- use `unknown` em fronteiras realmente desconhecidas.

Não use casts apenas para contornar erro.

Prefira tipos compartilhados em `src/types/` quando o mesmo contrato for utilizado em múltiplos módulos.

Tipos locais podem permanecer próximos do componente quando exclusivos daquele contexto.

---

## 7. UI e responsividade

O sistema é utilizado em desktop e celular.

Toda alteração de UI deve considerar:

- largura pequena;
- textos longos;
- botões acessíveis;
- overflow;
- modais/dialogs;
- tabelas;
- formulários;
- estados vazios;
- loading;
- erros.

Não presuma viewport desktop.

Preserve os padrões visuais existentes do módulo.

---

## 8. Formulários

Ao alterar formulários:

- preserve validações existentes;
- mantenha mensagens de erro compreensíveis;
- evite submissão duplicada;
- desabilite ação enquanto operação crítica estiver em andamento quando necessário;
- preserve dados digitados quando ocorrer erro recuperável.

Não remova validação de frontend sem verificar se existe validação correspondente no backend.

---

## 9. Erros

Não silencie exceções sem motivo.

Ao capturar erros:

- apresente feedback adequado ao usuário quando necessário;
- preserve informações úteis para diagnóstico;
- nunca exponha tokens, credenciais ou dados sensíveis;
- utilize o mecanismo existente de diagnóstico/log remoto quando aplicável.

Evite `console.log` permanente em produção.

---

## 10. Performance

Evite otimização prematura.

Antes de adicionar `useMemo`, `useCallback` ou memoização, verifique se existe benefício real.

Para listas grandes:

- utilize chaves estáveis;
- evite processamento pesado durante cada render;
- reutilize cálculos quando necessário.

Preserve lazy loading existente nas páginas.

---

## 11. CSS e layout

Evite alterações globais para resolver problema local.

Antes de criar novo estilo:

1. procure classe/padrão existente;
2. preserve convenções do módulo;
3. teste comportamento mobile;
4. evite valores arbitrários repetidos quando já existe padrão equivalente.

Não faça reformat visual de telas não relacionadas.

---

## 12. Bibliotecas

Use as bibliotecas existentes quando adequado.

Entre as já disponíveis estão:

- Framer Motion;
- Lucide React;
- Phosphor Icons;
- TipTap;
- React Markdown;
- DOMPurify;
- jsPDF;
- SheetJS;
- React Leaflet;
- React Hot Toast.

Não instale biblioteca duplicando funcionalidade já presente.

---

## 13. Testes frontend

Para funções e hooks:

```bash
pnpm test
```

Para componentes, use Testing Library.

Teste comportamento observável, não detalhes internos de implementação.

Quando corrigir bug, prefira adicionar teste que falharia antes da correção.

Para jornadas críticas ou públicas, avalie Playwright.

---

## 14. Checklist frontend

Antes de concluir:

- [ ] comportamento solicitado funciona;
- [ ] TypeScript continua válido;
- [ ] não foi introduzido `any` sem justificativa;
- [ ] layout mobile foi considerado;
- [ ] permissões continuam corretas;
- [ ] estados loading/erro/vazio foram considerados;
- [ ] testes relevantes foram executados;
- [ ] `pnpm lint` passa;
- [ ] `pnpm run build` passa quando aplicável;
- [ ] diff não contém alterações não relacionadas.
