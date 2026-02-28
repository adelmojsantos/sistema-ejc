# EJC - Encontro de Jovens com Cristo (Capelinha)

Este é o sistema de gestão do **EJC Capelinha**, desenvolvido para facilitar o cadastro de participantes, montagem de equipes e coordenação de eventos.

## 🚀 Funcionalidades

- **Autenticação Segura**: Login e controle de acesso integrados ao Supabase.
- **Cadastro de Pessoas**: Gestão completa de participantes (dados pessoais, contatos, etc.).
- **Montagem de Equipes**: Ferramenta para organizar equipes de trabalho para os encontros.
- **Interface Responsiva**: Design moderno e otimizado para dispositivos móveis (mobile-first).
- **Gestão de Eventos**: (Em desenvolvimento) Controle de datas e locais.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend/Database**: [Supabase](https://supabase.com/)
- **Roteamento**: [React Router DOM](https://reactrouter.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Estilização**: Vanilla CSS (CSS Puro)

## 📦 Como Instalar e Rodar

### Pré-requisitos
- Node.js (v18+)
- pnpm (recomendado) ou npm/yarn

### Passos
1. Clone o repositório.
2. Instale as dependências:
   ```bash
   pnpm install
   ```
3. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na raiz do projeto com as credenciais do Supabase:
   ```env
   VITE_SUPABASE_URL=sua_url_do_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   pnpm dev
   ```

## 🏗️ Estrutura do Projeto

- `src/components`: Componentes reutilizáveis da interface.
- `src/pages`: Páginas da aplicação.
- `src/contexts`: Contextos do React (Auth, Theme, etc.).
- `src/services`: Integrações com APIs e Supabase.
- `src/types`: Definições de tipos TypeScript.
- `src/assets`: Imagens e recursos estáticos.

---
Desenvolvido para o **EJC Capelinha**.
