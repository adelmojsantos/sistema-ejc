# Histórico de migrations

O banco de produção foi criado antes de o projeto adotar o histórico da CLI do
Supabase. Em 29/07/2026, o esquema existente foi validado contra uma reconstrução
isolada e as versões já materializadas foram registradas em
`supabase_migrations.schema_migrations` sem reexecutar o SQL antigo.

## Regras

- Toda migration nova deve usar o formato `YYYYMMDDHHMMSS_descricao.sql`.
- Versões nunca podem ser reutilizadas ou renomeadas depois de publicadas.
- Não execute migrations antigas novamente em produção.
- Antes de publicar, execute o job `Banco e autorização` do GitHub Actions.
- Confirme com `supabase db push --linked --dry-run` quais versões estão pendentes.
- Para uma migration isolada em uma emergência, use `supabase db query --linked
  --file <arquivo>` e registre a versão no histórico imediatamente depois.

Os arquivos em `supabase/ci` são exclusivamente fixtures para reconstruir o
legado em um banco vazio. Eles não são migrations de produção.
