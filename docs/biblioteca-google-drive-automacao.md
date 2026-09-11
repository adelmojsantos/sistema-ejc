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
- a importação externa usa uma conta de serviço sem delegação de domínio e enxerga
  somente pastas compartilhadas explicitamente com ela;
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
6. Em **Acesso a dados**, manter somente `openid`, `email` e
   `https://www.googleapis.com/auth/drive.file`; remover `drive` e
   `drive.readonly` da tela de consentimento.
7. Criar uma conta de serviço exclusiva para importação, sem delegação de domínio
   e sem atribuir papéis IAM do projeto. Gerar uma chave JSON para ela.
8. Enquanto o aplicativo OAuth estiver em modo de teste, cadastrar o e-mail
   central como usuário de teste. Para uso contínuo, publicar o aplicativo;
   autorizações de aplicativos externos em teste podem expirar.

A conta de serviço não precisa de acesso geral ao Drive nem de papel no projeto.
Cada responsável concede acesso somente ao compartilhar uma pasta específica com
o e-mail `client_email` da chave JSON, usando o papel **Leitor**.

## Variáveis da Edge Function

Além das variáveis padrão fornecidas pelo Supabase, configurar:

- `GOOGLE_DRIVE_CLIENT_ID`;
- `GOOGLE_DRIVE_CLIENT_SECRET`;
- `GOOGLE_TOKEN_ENCRYPTION_KEY`: 32 bytes aleatórios codificados em Base64;
- `GOOGLE_DRIVE_SYNC_SECRET`: segredo aleatório independente para o agendador;
- `PUBLIC_APP_URL`: URL pública do sistema, sem caminho final.
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`: JSON completo da credencial da conta de
  serviço usada somente para ler pastas externas compartilhadas.

Nunca utilizar nomes `VITE_*` para essas credenciais.

## Importação excepcional de outra conta

A ação **Importar pasta compartilhada** fica em `Biblioteca > Configurações do
Google Drive > Ferramentas avançadas` e exige a permissão
`biblioteca_google_importar` ou perfil administrativo.

O responsável compartilha a pasta de origem como **Leitor** com o e-mail da conta
de serviço exibido na tela e cola o link da pasta. A Edge Function usa a conta de
serviço para inventariar e baixar somente essa estrutura. Não há conexão OAuth
com a conta de origem, e a pasta original não pode ser alterada.

Depois da importação, o responsável deve remover o compartilhamento no próprio
Google Drive. A conta institucional permanece no escopo `drive.file` e administra
somente os arquivos criados pelo Sistema EJC. Arquivos criados diretamente no
Drive não são descobertos automaticamente; por isso, novos arquivos oficiais
devem ser enviados ou criados pela Biblioteca.

## Publicação

A migration, o deploy da função e a configuração de secrets são operações remotas
separadas e só devem ser executadas após autorização explícita.

Após publicar:

1. configurar os secrets da função, incluindo o JSON completo da conta de serviço;
2. aplicar a migration desta versão;
3. publicar `google-drive` com a verificação JWT da plataforma desativada, pois o
   callback OAuth é público; a própria função valida as ações protegidas;
4. publicar o frontend;
5. remover a autorização antiga do Sistema EJC na segurança da conta Google
   central e usar **Reautorizar conta oficial** na Biblioteca. Isso substitui a
   concessão ampla antiga pelo escopo `drive.file`;
6. criar um Documento de teste e compartilhar com um grupo/equipe de teste;
7. confirmar no Drive o acesso individual e o papel leitor/editor;
8. testar a importação compartilhando uma pasta como Leitor com a conta de serviço;
9. configurar uma chamada agendada para `sync-pending`, enviando JSON
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
