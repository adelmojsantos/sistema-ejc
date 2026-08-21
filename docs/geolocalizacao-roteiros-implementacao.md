# Geolocalização e roteiros de visitas

## Decisão funcional

O sistema separa dois conceitos que não podem ser confundidos:

1. **localização exata**: ponto confirmado, armazenado em `latitude` e
   `longitude`, que pode ser enviado ao Maps/Waze como destino;
2. **localização aproximada**: ponto de rua ou CEP, armazenado internamente em
   `geo_reference_*` e usado somente para visualizar a região nos mapas.

Um retorno público de Nominatim, CEP Aberto ou AwesomeAPI nunca vira localização
exata. Se nenhum provedor encontrar uma referência coerente, os campos ficam
nulos. O sistema não cria marcador no centro da cidade como fallback.

## Fase 0 — diagnóstico

O baseline usava Leaflet/React Leaflet, OpenStreetMap, ViaCEP, Nominatim e
AwesomeAPI. Havia risco de tratar centroide de CEP/rua como residência, além de
não existir proveniência suficiente para coordenadas antigas. A auditoria
agregada e sem dados pessoais permanece em `scripts/audit-geolocation.sql`.

## Fase 1 — modelo e integridade

As migrations de 17/08/2026 criaram os metadados de qualidade, cache interno,
controle global do Nominatim, proteção por fingerprint e ordem do roteiro. A
migration `20260819120000_geolocation_regional_references.sql` acrescenta a
localização aproximada separada, com:

- par obrigatório e intervalos válidos;
- origem limitada a `nominatim`, `cepaberto` ou `awesomeapi`;
- precisão limitada a `street` ou `cep`;
- fingerprint e data obrigatórios quando há referência;
- invalidação automática ao mudar qualquer parte do endereço;
- persistência transacional pela RPC de visitação.

A migration de 19/08 é aditiva e já foi aplicada no projeto remoto, junto das
três migrations de 17/08. A publicação do frontend continua condicionada à
confirmação da versão da Edge Function.

## Fase 2 — obtenção e atualização

- Cadastros e edições normais de pessoas tentam obter automaticamente uma
  localização aproximada quando há logradouro, cidade e UF. O endereço continua
  sendo salvo normalmente quando nenhum provedor responde ou encontra resultado.
- A efetivação de inscrição pública executa a mesma tentativa depois que a RPC
  transacional cria ou atualiza a pessoa. Uma falha não desfaz a aprovação.
- Importações em massa não geocodificam durante a inclusão para evitar lentidão,
  timeouts e bloqueio dos serviços públicos gratuitos.
- A busca de CEP por endereço usa UF, cidade e logradouro, nunca o número. Com
  mais de um resultado, o operador escolhe bairro/trecho; sem resultado, o CEP
  permanece vazio.
- Os fluxos internos de Visitação e Secretaria mantêm **Tentar novamente** para
  endereços cuja localização aproximada não pôde ser obtida automaticamente.
- A Edge Function não envia o número residencial ao Nominatim. ViaCEP valida a
  compatibilidade entre CEP, cidade e UF antes de aceitar candidatos de CEP.
- Ausência ou indisponibilidade do provedor não impede salvar o endereço.
- Nenhum token fica no frontend, no banco de cache ou nos logs.

## Fase 3 — mapas e navegação

- Mapas internos tratam vínculos não realizados como **Disponível**. Quando o
  ponto é regional, o cartão informa apenas **Localização aproximada**, sem criar
  outra categoria funcional na legenda.
- Registros sem nenhum dos dois tipos não recebem marcador; o centro padrão é
  apenas o enquadramento inicial do mapa vazio.
- Maps e Waze recebem coordenadas somente quando o ponto é exato. Caso contrário,
  recebem o endereço textual completo. Coordenadas `geo_reference_*` nunca são
  colocadas em links externos.
- O planejador de roteiro não é exibido em nenhuma tela. Seus componentes,
  serviços e estrutura de dados permanecem preservados para avaliação futura.

## Gestão segura das duplas

A migration local `20260820120000_active_visitation_group_management.sql`, ainda
não aplicada remotamente, protege a composição das duplas:

- encontros históricos (`ativo = false`) permanecem somente para consulta;
- substituição de visitante aceita apenas encontreiro livre do mesmo encontro;
- movimentos individuais, em lote e troca completa usam uma única RPC
  transacional;
- alterações diretas das duplas ou de sua composição também são bloqueadas no
  histórico;
- o mesmo modal **Trocar entre Duplas** é acessível pelo Painel de Duplas e pelo
  fluxo de Vínculo de Encontristas.

## Custos e limites

A implementação não adiciona serviço pago. Usa ViaCEP, OpenStreetMap/Nominatim,
CEP Aberto opcional, AwesomeAPI, Leaflet e deep links oficiais. Serviços públicos
não possuem SLA; por isso o endereço textual é sempre o fallback operacional.
O Nominatim é serializado globalmente em aproximadamente uma requisição por
segundo.

## Segurança e publicação

- `geocode-address` exige JWT e autorização modular ou administrativa;
- cache e token permanecem no backend;
- as quatro migrations estão aplicadas e `geocode-address` possui uma versão
  ativa no projeto remoto; antes do frontend, a versão local desta revisão deve
  ser publicada ou comparada com a ativa;
- sequência restante de publicação: Edge Function e, por último, frontend;
- o token do CEP Aberto anteriormente compartilhado em conversa deve ser
  rotacionado antes de uso em produção.

## Validação

Os testes unitários cobrem a criação automática da localização aproximada,
falha não bloqueante, aprovação de inscrição pública, separação entre localização
aproximada e ponto exato e garantia de que coordenadas aproximadas não aparecem
nos links de navegação. Os testes pgTAP cobrem fingerprint, invalidação e
persistência transacional.

Resultado local atualizado em 21/08/2026:

- `pnpm exec tsc --noEmit`: passou;
- `pnpm test`: 28 arquivos e 161 testes passaram, incluindo localização
  automática, falha não bloqueante, aprovação pública e gestão das duplas;
- `pnpm lint`: passou sem erros; 67 warnings preexistentes fora do escopo;
- `pnpm run build`: passou; permaneceu o aviso conhecido de chunk acima de
  500 kB;
- `git diff --check`: passou;
- `supabase migration list --linked`: confirmou as quatro migrations de
  geolocalização no remoto. O dry-run geral ficou impedido porque a migration de
  Storage `20260819150000`, aplicada em outra branch, ainda não existe na
  `origin/master`;
- pgTAP: o novo arquivo possui 16 asserções de troca, rollback e bloqueio
  histórico, mas não pôde ser executado porque não há Docker, Podman ou
  PostgreSQL/Supabase local acessível neste computador;
- Deno check: não executado, pois o runtime Deno não está instalado.
