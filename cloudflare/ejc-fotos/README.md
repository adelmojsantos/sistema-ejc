# Worker de fotos

Entrega as imagens públicas do bucket R2 com cache e restringe uploads e
remoções a usuários autenticados no Supabase.

## Rotas

- `GET /health`: verifica se o Worker está disponível.
- `GET|HEAD /fotos/*`: entrega pública das imagens.
- `PUT /fotos/*`: envia uma imagem com sessão autenticada.
- `DELETE /fotos/*`: remove uma imagem com sessão autenticada.

O Worker rejeita gravações fora de `fotos/`, impedindo que comprovantes ou
outros documentos privados sejam armazenados no bucket público.

## Configuração

O binding `FOTOS_BUCKET` aponta para `ejc-fotos-producao`. Configure estes
segredos no Worker sem adicioná-los ao repositório:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

`ALLOWED_ORIGINS` contém uma lista separada por vírgulas das origens que podem
enviar ou remover imagens.

## Validação e deploy

Na raiz do repositório:

```bash
pnpm run worker:check
pnpm run worker:deploy
```
