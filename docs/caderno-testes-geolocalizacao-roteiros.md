# Caderno de testes funcionais — geolocalização e roteiros

Use somente pessoas fictícias. Como o frontend local pode estar conectado ao
banco de produção, não execute estes casos antes de confirmar a publicação da
versão desta branch da Edge Function. As migrations de geolocalização já estão
aplicadas no projeto remoto.

## Preparação

1. Inicie o frontend com `pnpm dev`.
2. Entre com um usuário autorizado nos módulos Secretaria e Visitação.
3. Separe quatro cadastros fictícios:
   - A: endereço completo e válido;
   - B: rua válida sem CEP;
   - C: endereço propositalmente inexistente;
   - D: endereço incompleto.
4. Vincule A e B a uma dupla fictícia.

Não informe neste relatório nomes, endereços, coordenadas ou tokens reais.

## CAD-01 — localização aproximada automática

1. Abra Cadastro de Pessoas e edite A.
2. Observe a seção Endereço.
3. Salve sem usar qualquer ação adicional.
4. Reabra o cadastro e o mapa interno correspondente.

Esperado: não existem botões **Ajustar no mapa** ou **Usar GPS no local**. O
sistema tenta obter a localização automaticamente. Quando há resultado válido,
o mapa mostra **Localização aproximada**; quando não há, o cadastro ainda é salvo
e nenhum marcador é criado no centro da cidade.

## CAD-02 — descobrir o CEP

1. Em B, deixe o CEP vazio e informe UF, cidade e rua.
2. Clique em **Buscar CEP pelo endereço**.
3. Repita com uma rua que possua mais de um CEP.

Esperado: resultado único preenche o CEP; múltiplos resultados exigem seleção
por bairro/trecho; nenhum resultado mantém o campo vazio. O número residencial
não é enviado ao ViaCEP.

## CAD-03 — alteração invalida referências antigas

1. Abra um cadastro fictício que tenha ponto exato ou localização aproximada.
2. Altere número, CEP, rua, bairro, cidade ou UF e salve.
3. Abra os mapas internos.

Esperado: a referência ligada ao endereço anterior não permanece no mapa. Não
surge marcador no centro da cidade.

## VIS-01 — localização aproximada válida

1. Na edição interna da Visitação, abra A.
2. Confirme que a localização foi obtida automaticamente. Se estiver
   indisponível, clique em **Tentar novamente** e salve.
3. Reabra o cadastro e os mapas da dupla/coordenação.

Esperado: o vínculo continua identificado como **Disponível**. No cartão do
mapa aparece somente **Localização aproximada**, sem uma categoria adicional na
legenda e sem botão para remover a localização. O registro não é apresentado
como ponto exato.

## VIS-02 — falha sem endereço fantasma

1. Na edição interna, abra C e use **Tentar novamente**.
2. Salve e abra os mapas.
3. Repita com D.

Esperado: mensagem clara de localização não encontrada ou endereço incompleto;
campos internos de localização permanecem nulos; o endereço pode ser salvo; não há
marcador em Franca nem em qualquer centro padrão; é possível corrigir e tentar
novamente.

## VIS-03 — consistência entre módulos

1. Atualize o endereço de A no Cadastro de Pessoas e salve.
2. Abra A na coordenação de Visitação, Cadastro de Pessoas e mapa da equipe.
3. Altere novamente pela coordenação e reabra na Secretaria.

Esperado: todas as telas leem a mesma localização aproximada persistida. Cadastro
de Pessoas atualiza-a automaticamente e não a transforma em ponto exato.

## VIS-04 — atualização em lote

1. Na Secretaria, filtre somente A, B, C e D.
2. Clique na ação de localizações aproximadas e confirme.

Esperado: a tela esclarece que os pontos são aproximados; A/B podem obter
referência; C fica sem referência; D é pulado como incompleto; uma falha não
interrompe os outros registros; nenhuma coordenada é exibida ao usuário.

## MAP-01 — sem marcador falso

1. Abra os mapas com A/B referenciados, C sem referência e D incompleto.

Esperado: A/B aparecem como disponíveis e seus cartões avisam **Localização
aproximada**; C/D não recebem marcador. O centro inicial do mapa não contém pin
fictício.

## DUP-01 — acesso à troca pelos dois fluxos

1. Selecione o encontro ativo e abra **Painel de Duplas**.
2. Confirme o botão **Trocar entre Duplas** ao lado de **Montar Nova Dupla**.
3. Abra **Vínculo de Encontristas** e confirme o mesmo botão.
4. Abra o modal pelos dois lugares.

Esperado: ambos abrem o mesmo modal, com as mesmas duplas e encontristas.

## DUP-02 — movimento individual e preservação

1. Escolha duas duplas fictícias A e B.
2. Em **Mover Um**, selecione um encontrista de A e mova para B.
3. Reabra A e B e consulte o histórico do encontrista.

Esperado: somente a pessoa selecionada muda de dupla; status, observações,
presenças e fotos da visita permanecem associados ao mesmo registro.

## DUP-03 — mover todos e troca completa

1. Use **Mover Todos A → B** e confira a prévia antes de confirmar.
2. Recarregue a página e confira as duas duplas.
3. Com dados fictícios preparados nos dois lados, use **Trocar A ↔ B**.
4. Recarregue novamente.

Esperado: cada operação termina integralmente e os totais correspondem à prévia;
nunca há parte dos vínculos em estado intermediário.

## DUP-04 — substituição de visitante

1. Adicione um novo integrante fictício à equipe de visitação do encontro ativo.
2. Abra os participantes de uma dupla e substitua um visitante por ele.
3. Tente repetir usando alguém que já pertença a outra dupla.

Esperado: a pessoa livre assume a dupla e o acesso aos encontristas; o nome da
dupla é atualizado. A pessoa ocupada não aparece como opção e o banco rejeita
uma tentativa manual equivalente.

## DUP-05 — encontro histórico somente para consulta

1. Selecione um encontro com estado **Histórico**.
2. Abra o Painel de Duplas, detalhes, vínculos e mapa.
3. Procure ações de criação, renomeação, dissolução, fotos, substituição, troca,
   vínculo, desvínculo e edição de endereço.

Esperado: aparece o aviso **Encontro encerrado**; os dados continuam visíveis,
mas as ações de alteração estão ausentes ou desabilitadas. Chamadas diretas às
operações de composição também são recusadas pelo banco.

## NAV-01 — Maps/Waze não recebem coordenada aproximada

1. Em uma pessoa com apenas localização aproximada, clique em Maps e Waze.
2. Inspecione visualmente o destino/pesquisa aberto.
Esperado: os serviços recebem o endereço escrito completo. O ponto aproximado
mostrado no mapa interno não é usado como destino.

## NAV-02 — localização exata legada/confirmada

1. Use um registro fictício que já possua `geo_status = verified`, fingerprint
   atual e coordenadas exatas válidas.
2. Abra Maps/Waze e o mapa interno.

Esperado: a tela identifica **ponto exato** e os links usam as coordenadas
exatas, nunca a localização aproximada paralela.

## SEC-01 — autorização

1. Com usuário sem permissão, tente atualizar a localização aproximada.
2. Confirme que o planejador de roteiro não aparece para nenhum perfil.

Esperado: operação negada; cache interno inacessível; token e detalhes internos
não aparecem no navegador.

## Evidências

Para cada caso registre: navegador/dispositivo, identificador, resultado
observado e captura de divergência. Falhas em CAD-03, VIS-02, VIS-03, MAP-01,
DUP-02, DUP-03, DUP-04, DUP-05, NAV-01 ou SEC-01 bloqueiam publicação.
