# E-mail institucional

Worker isolado para receber mensagens do Cloudflare Email Routing, armazenar
conteúdo e anexos de forma privada no R2 e permitir leitura/resposta pelo Sistema
EJC.

## Secrets

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

Cadastre-os com `wrangler secret put` antes do primeiro deploy. O Worker deve ser
homologado com `caixa-teste@ejccapelinha.com.br` antes de substituir a regra atual
de `contato@ejccapelinha.com.br`.

## Validação local

```bash
pnpm exec wrangler deploy --dry-run --config cloudflare/ejc-email/wrangler.jsonc
```
