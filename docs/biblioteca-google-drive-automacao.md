# Automação da Biblioteca com Google Drive

## Escopo

A integração usa uma conta Google central, que permanece proprietária dos arquivos.
O sistema pode criar Documentos e Planilhas Google e converter compartilhamentos
por grupo de acesso ou equipe em permissões individuais no Drive.
Usuários autorizados a gerenciar a Biblioteca recebem acesso de editor aos
arquivos gerenciados, inclusive quando não fazem parte de um compartilhamento.

Arquivos vinculados manualmente continuam manuais. Somente registros com
`google_managed = true`, criados pela integração, têm permissões gerenciadas.

## Destino por tipo de arquivo

- `DOC`, `DOCX` e `TXT` são convertidos em Documentos Google;
- `CSV` e `XLSX` são convertidos em Planilhas Google;
- PDFs, imagens e demais formatos enviados pela Biblioteca permanecem no bucket
  privado do Supabase;
- fotos públicas dos demais módulos continuam no Cloudflare R2.

O botão `Enviar Arquivo` sempre mantém o conteúdo no Sistema EJC. O envio e a
conversão direta são feitos somente pela ação explícita `Enviar ao Google`.
Arquivos editáveis já armazenados podem ser movidos pela ação `Mover para o
Google`. O arquivo original permanece no Storage até a criação e a sincronização
no Drive terminarem sem erro.
Recursos avançados e macros dos formatos de origem podem não ser preservados pela
conversão do Google.

## Segurança adotada

- OAuth 2.0 com o escopo limitado `drive.file`;
- refresh token criptografado com AES-GCM antes de ser salvo;
- credenciais e tokens acessíveis somente à Edge Function com `service_role`;
- ações interativas exigem usuário com permissão para gerenciar a Biblioteca;
- sincronização agendada exige um segredo próprio no cabeçalho;
- remoção desfaz somente permissões criadas ou elevadas pelo sistema;
- exclusão move o arquivo para a lixeira do Drive, permitindo recuperação.
- o compartilhamento não envia e-mails de notificação; se o endereço não estiver
  associado a uma Conta Google, o arquivo permanece sincronizado e o próprio
  usuário recebe uma orientação ao tentar abri-lo.

## Configuração necessária no Google Cloud

1. Criar ou selecionar um projeto no Google Cloud Console.
2. Ativar a Google Drive API.
3. Configurar a tela de consentimento OAuth.
4. Criar um cliente OAuth do tipo aplicação Web.
5. Cadastrar como URI de redirecionamento:
   `https://<project-ref>.supabase.co/functions/v1/google-drive/callback`.
6. Enquanto o aplicativo OAuth estiver em modo de teste, cadastrar o e-mail
   central como usuário de teste. Para uso contínuo, publicar o aplicativo;
   autorizações de aplicativos externos em teste podem expirar.

## Variáveis da Edge Function

Além das variáveis padrão fornecidas pelo Supabase, configurar:

- `GOOGLE_DRIVE_CLIENT_ID`;
- `GOOGLE_DRIVE_CLIENT_SECRET`;
- `GOOGLE_TOKEN_ENCRYPTION_KEY`: 32 bytes aleatórios codificados em Base64;
- `GOOGLE_DRIVE_SYNC_SECRET`: segredo aleatório independente para o agendador;
- `PUBLIC_APP_URL`: URL pública do sistema, sem caminho final.
- `GOOGLE_PICKER_API_KEY`: chave de navegador restrita ao domínio do sistema e à Google Picker API;
- `GOOGLE_PICKER_APP_ID`: número do projeto Google Cloud usado pelo Picker.

Nunca utilizar nomes `VITE_*` para essas credenciais.

## Importação excepcional de outra conta

A ação **Importar de outro Drive** fica em `Biblioteca > Configurações do Google
Drive > Ferramentas avançadas` e exige `modulo_admin`. Ela usa uma conexão OAuth
temporária separada da conta central, com validade de 24 horas. O token é
criptografado, não é exposto ao frontend (exceto pelo access token curto exigido
pelo Google Picker) e é removido e revogado ao desconectar ou expirar.

A conexão temporária usa `drive.readonly`, pois `drive.file` não concede acesso
automático aos itens preexistentes dentro de uma pasta selecionada pelo Picker.
O acesso é somente leitura, expira em 24 horas e a operação trabalha apenas com
a pasta explicitamente escolhida. A conta institucional permanece no escopo
reduzido `drive.file`.

## Publicação

A migration, o deploy da função e a configuração de secrets são operações remotas
separadas e só devem ser executadas após autorização explícita.

Após publicar:

1. configurar os secrets da função;
2. publicar `google-drive` com a verificação JWT da plataforma desativada, pois o
   callback OAuth é público; a própria função valida as ações protegidas;
3. acessar a Biblioteca como administrador e conectar a conta central;
4. criar um Documento de teste e compartilhar com um grupo/equipe de teste;
5. confirmar no Drive o acesso individual e o papel leitor/editor;
6. configurar uma chamada agendada para `sync-pending`, enviando JSON
   `{"action":"sync-pending","limit":25}` e o segredo no cabeçalho
   `X-Google-Drive-Sync-Secret`.

O agendador é o mecanismo de retentativa para mudanças indiretas, como alteração
de integrante da equipe, grupo, e-mail Google ou encontro ativo. Compartilhamentos
feitos na tela também tentam sincronizar imediatamente.

## Recuperação e rollback

Antes de aplicar a migration em produção, preparar uma migration corretiva que:

1. remova os triggers e funções da automação;
2. remova as tabelas privadas de integração, estado OAuth, permissões e fila;
3. remova as colunas de automação somente depois de publicar um frontend que não
   dependa delas;
4. preserve as colunas e registros da versão manual da Biblioteca.

Revogar o cliente OAuth ou apagar seus secrets interrompe a integração, mas não
remove os arquivos da conta central. Arquivos na lixeira podem ser restaurados
diretamente pelo Drive.
