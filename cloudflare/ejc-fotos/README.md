# Worker de fotos

Entrega as imagens públicas do bucket R2 com cache e restringe uploads e
remoções a usuários autenticados no Supabase.

## Rotas

- `GET /health`: verifica se o Worker está disponível.
- `GET|HEAD /fotos/*`: entrega pública das imagens.
- `PUT /fotos/*`: envia uma imagem com sessão autenticada.
- `DELETE /fotos/*`: remove uma imagem com sessão autenticada.
- `PUT /fotos/*` com `X-Migration-Token`: permite cópia controlada pelo
  script de migração.

O Worker rejeita gravações fora de `fotos/`, impedindo que comprovantes ou
outros documentos privados sejam armazenados no bucket público.

## Configuração

O binding `FOTOS_BUCKET` aponta para `ejc-fotos-producao`. Configure estes
segredos no Worker sem adicioná-los ao repositório:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
MIGRATION_TOKEN
```

`ALLOWED_ORIGINS` contém uma lista separada por vírgulas das origens que podem
enviar ou remover imagens.

## Validação e deploy

Na raiz do repositório:

```bash
pnpm run worker:check
pnpm run worker:deploy
```

## Migração das imagens antigas

Depois de aplicar a migration do Supabase e configurar o mesmo token secreto
no Worker e no terminal local:

```bash
pnpm run migrate:public-images-r2 -- --limit=10
pnpm run migrate:public-images-r2 -- --apply --limit=10
```

Variáveis necessárias no terminal:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PUBLIC_IMAGE_MIGRATION_TOKEN
PUBLIC_IMAGE_BASE_URL
```

`PUBLIC_IMAGE_BASE_URL` pode ser omitida se o destino for
`https://ejc-fotos.ejcsecretaria-sistema.workers.dev`.
