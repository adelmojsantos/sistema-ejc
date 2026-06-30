# Estratégia para reduzir Cached Egress no Supabase

## Diagnóstico

O principal vetor de consumo é o Storage, não a Edge Function de IA. O bucket público
`galeria` concentra fotos de participantes, equipes, palestrantes, círculos, mediadores,
duplas de visita e famílias. Cada `<img>` aponta diretamente para o CDN do Supabase.

A página pública `QuadrantePage.tsx` amplifica o consumo porque reúne muitas dessas
imagens em uma única visita. Antes desta revisão, várias imagens eram carregadas
imediatamente, inclusive fora da área visível. Os uploads também preservavam os arquivos
originais, que podem ter vários megabytes.

No plano Free, a franquia é dividida em 5 GB de egress em cache e 5 GB sem cache. Um
`HIT` do CDN ainda conta como Cached Egress; cache melhora latência e reduz trabalho na
origem, mas não torna a transferência gratuita.

### Buckets encontrados

| Bucket | Acesso | Conteúdo | Avaliação |
|---|---|---|---|
| `galeria` | Público | Fotos e alguns comprovantes | Principal fonte provável; comprovantes não deveriam ser públicos |
| `financeiro` | Público | QR codes | Baixo volume, mas deve usar cache longo |
| `biblioteca` | Privado | Documentos/PDFs | Boa estratégia: URL assinada somente quando o usuário abre |
| `pos-encontros` | Privado | Documentos do pós-encontro | Boa estratégia: URL assinada sob demanda |

Os PDFs privados não são carregados automaticamente nas listagens. O comprovante em PDF
também é aberto por ação do usuário. Portanto, eles não explicam sozinhos o Cached Egress.

### Consultas ao banco

Há telas administrativas que carregam listas completas e algumas consultas com `select('*')`.
Isso deve ser tratado com paginação e seleção de colunas, mas afeta principalmente Database
Egress. Não é a causa mais provável de um alerta especificamente classificado como Cached
Egress.

## Mudanças implementadas

1. Fotos novas são redimensionadas no navegador para no máximo 1600 px e convertidas
   para WebP antes do upload.
2. Há limite de 15 MB para a imagem de entrada. Documentos da biblioteca, pós-encontro e
   comprovantes também ganharam limites explícitos.
3. Novos objetos públicos recebem `Cache-Control: max-age=31536000` e usam caminhos
   versionados, sem sobrescrever o mesmo objeto.
4. Imagens das páginas com maior volume agora usam `loading="lazy"` e `decoding="async"`.
   O carregamento eager é mantido apenas durante a preparação para impressão do quadrante.
5. O endpoint `/storage/v1/render/image` deixou de ser usado. As transformações de imagem
   do Supabase não estão disponíveis no plano Free; a otimização precisa ocorrer antes do
   upload.

Essas mudanças reduzem imediatamente o tamanho e a quantidade de transferências futuras.
Elas não alteram os arquivos antigos já armazenados.

## Como medir os arquivos responsáveis

No Dashboard, abra **Logs Explorer** e execute o modelo oficial de Storage:

```sql
select
  request.method as http_verb,
  request.path as filepath,
  (responseHeaders.cf_cache_status = 'HIT') as cached,
  count(*) as num_requests
from edge_logs
cross join unnest(metadata) as metadata
cross join unnest(metadata.request) as request
cross join unnest(metadata.response) as response
cross join unnest(response.headers) as responseHeaders
where
  (path like '%storage/v1/object/%' or path like '%storage/v1/render/%')
  and request.method = 'GET'
group by 1, 2, 3
order by num_requests desc
limit 100;
```

Exporte semanalmente os 100 primeiros resultados. Para cada objeto mais acessado, multiplique:

```text
egress aproximado = número de GETs × tamanho do arquivo
```

Um log criado apenas no aplicativo não capturaria imagens públicas carregadas diretamente
pelo navegador. O Edge Logs do Supabase é, portanto, a fonte correta para esse diagnóstico.

Referências: [Bandwidth & Storage Egress](https://supabase.com/docs/guides/storage/serving/bandwidth),
[Manage Egress usage](https://supabase.com/docs/guides/platform/manage-your-usage/egress) e
[Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations).

## Migração segura das imagens existentes

Não sobrescrever objetos antigos é importante porque o CDN pode continuar entregando a
versão em cache.

1. Inventariar URLs nas colunas:
   `participacoes.foto_url`, `equipe_confirmacoes.foto_url`,
   `equipe_confirmacoes.criancas_recreacao_foto_url`,
   `palestras.palestrante_foto_url`, `circulos.imagem_url`,
   `circulo_mediadores_fotos.foto_url`, `visita_grupos.foto_url`,
   `visita_participacao.foto_familia_url` e `encontros.logo_url`.
2. Baixar cada original uma única vez em um job administrativo.
3. Gerar WebP com dimensão máxima de 1600 px e, se necessário, uma miniatura de 320 px.
4. Enviar para um caminho novo, por exemplo `v2/<categoria>/<id>-<hash>.webp`, com cache de
   um ano.
5. Atualizar a URL no banco somente depois de confirmar o novo objeto.
6. Manter o original por 7 a 14 dias para rollback e depois removê-lo.
7. Fazer lotes pequenos, registrar `old_url`, `new_url`, status e erro, e permitir retomada.

Antes da migração, faça backup das relações URL/registro. GIF e SVG devem ser avaliados
separadamente para não perder animação ou conteúdo vetorial.

## Privacidade dos comprovantes

Novos comprovantes devem ir para um bucket privado dedicado, por exemplo
`comprovantes`, com URL assinada curta gerada somente para usuários autorizados. A migração
de comprovantes já existentes no `galeria` deve ser feita em uma fase própria, pois trocar
o bucket exige atualizar URLs e políticas sem interromper o fluxo financeiro.

## Alternativas de arquitetura

| Serviço | Melhor uso neste projeto | Observação |
|---|---|---|
| Cloudflare R2 | Fotos públicas e documentos com muito download | Recomendação principal: egress gratuito e camada gratuita de 10 GB, mas exige adaptar upload/URLs |
| Cloudinary | Imagens com transformação pronta e pouca manutenção | Implementação simples; plano gratuito trabalha com créditos |
| Bunny Storage + CDN | Tráfego previsível pago e barato | Custo baixo, cobrança mínima e tráfego CDN separado |
| AWS S3 + CDN | Operação madura/enterprise | Flexível, porém mais complexo e com egress tradicional |
| Vercel Blob | Aplicação já hospedada integralmente na Vercel | Conveniente, mas transferência continua limitada/medida |

Se, após otimizar e migrar os originais, o consumo continuar próximo de 5 GB/mês, a melhor
evolução é:

```text
Supabase (banco, autenticação e metadados)
              |
              +-- bucket privado: comprovantes e documentos sensíveis
              |
              +-- Cloudflare R2: imagens públicas versionadas
                              |
                              +-- domínio CDN próprio
```

O banco continua guardando apenas a URL e os metadados. A mudança pode ser gradual porque
as telas aceitam URLs absolutas tanto do Supabase quanto do novo CDN.

Referências de custo: [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/),
[Cloudinary](https://cloudinary.com/pricing),
[Bunny Storage](https://docs.bunny.net/storage/pricing),
[Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing) e
[AWS S3](https://aws.amazon.com/s3/pricing/).

## Plano por prioridade

### Agora

- Publicar a otimização de upload, lazy loading e limites de arquivo.
- Rodar o relatório do Logs Explorer e guardar uma linha de base de sete dias.
- Identificar os 20 objetos com maior produto `requisições × tamanho`.

### Próxima etapa

- Executar a migração versionada das imagens antigas.
- Criar o bucket privado de comprovantes e migrar o fluxo.
- Paginar as maiores listagens administrativas e substituir `select('*')` por colunas
  necessárias.

### Se ainda exceder a franquia

- Mover imagens públicas para R2.
- Manter documentos sensíveis privados e entregar por URLs curtas.
- Definir alertas em 60%, 80% e 90% da franquia mensal.

