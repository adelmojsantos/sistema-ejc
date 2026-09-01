# Caixa de e-mail institucional

## Arquitetura

O Cloudflare Email Routing entrega mensagens a um Worker exclusivo. O Worker
processa o MIME uma única vez, grava corpos, MIME original e anexos no prefixo
privado `emails/` do R2 e mantém somente metadados leves no Supabase.

O frontend consulta metadados protegidos por RLS. Corpos e anexos são obtidos do
Worker mediante JWT do Supabase e nunca possuem URL pública. Respostas são
enviadas pelo Resend no próprio Worker, com idempotência e cabeçalhos de conversa.

## Permissões

- `modulo_email_institucional`: visualizar mensagens;
- `email_institucional_responder`: responder, assumir e alterar status;
- `email_institucional_gerenciar`: reservado para retenção e exclusão futura.

Administradores recebem as três permissões. Outros usuários podem recebê-las por
grupo na gestão de acessos.

## Publicação segura

1. aplique a migration e valide os testes de autorização;
2. configure `VITE_EMAIL_WORKER_URL` no frontend;
3. cadastre os secrets descritos em `cloudflare/ejc-email/README.md`;
4. publique o Worker sem alterar `contato@`;
5. crie a regra temporária `caixa-teste@ejccapelinha.com.br` para o Worker;
6. homologue recebimento, HTML, anexos, tempo real e respostas;
7. somente então substitua a regra de `contato@` que hoje encaminha ao Gmail.

## Armazenamento

O PostgreSQL guarda assunto, remetente, prévia de até 500 caracteres, estados e
auditoria. Conteúdo integral e anexos ficam no R2. A interface pagina/carrega o
corpo somente ao abrir uma conversa. Limites iniciais: 20 MB por mensagem recebida
e 50 mil caracteres por resposta.

Política de retenção e exclusão automática não é aplicada nesta primeira versão;
ela deve ser definida pela direção antes de remover qualquer conteúdo.
