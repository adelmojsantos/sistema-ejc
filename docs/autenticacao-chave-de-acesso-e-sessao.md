# Entrada com chave de acesso (passkeys) e expiração de sessão

## Visão geral

- **Entrada com chave de acesso:** usa as passkeys do Supabase Auth (recurso em beta). A
  biometria fica no aparelho; o sistema recebe apenas uma assinatura criptográfica.
  A senha continua sendo uma forma de acesso válida.
- **Expiração de sessão:** aplicada pelo cliente, porque o plano gratuito do
  Supabase não permite configurar sessões no servidor.

## Comportamento

### Chave de acesso

Na interface o recurso se chama "chave de acesso" (termo usado pelo Google em pt-BR),
confirmada pela digital, rosto ou PIN do aparelho — inclusive Windows Hello/Touch ID
no computador ou um celular via QR code.

1. Após entrar com e-mail e senha, o usuário que ainda não tem nenhuma chave de acesso
   cadastrada recebe o convite "Criar uma chave de acesso neste aparelho?" — apenas em
   aparelhos com biometria/bloqueio de tela. "Agora não" deixa de sugerir naquele aparelho.
2. A tela de login exibe "Entrar com chave de acesso" quando o navegador suporta passkeys.
3. Em **Menu do usuário → Segurança** (`/seguranca`) o usuário cria uma chave de acesso,
   renomeia e remove aparelhos cadastrados.

### Sessão

| Regra | Valor | Onde alterar |
| --- | --- | --- |
| Inatividade | 12 horas | `SESSION_IDLE_TIMEOUT_MS` em `src/utils/sessionPolicy.ts` |
| Tempo máximo após o login | 7 dias | `SESSION_MAX_AGE_MS` em `src/utils/sessionPolicy.ts` |

- A verificação ocorre ao abrir o sistema, ao voltar para a aba, a cada interação
  e a cada minuto. A expiração revoga a sessão no Supabase (`signOut` com escopo
  `local`), sem derrubar outros aparelhos do mesmo usuário.
- Sessões existentes no momento da publicação começam a contar a partir do primeiro
  acesso após o deploy.
- Limitação: a regra só é aplicada pelo sistema no navegador. Um token copiado
  manualmente do armazenamento local continua válido até expirar (1 hora).
  Para garantia no servidor, configure **Authentication → Sessions** no plano Pro.

## Ativação em produção

A ordem importa: o frontend só mostra a chave de acesso quando a variável estiver ligada.

1. **Supabase → Authentication → Passkeys**
   - Ative "Enable Passkey authentication".
   - **RP ID:** `ejccapelinha.com.br` (sem `https://`, sem `www`).
     Trocar o RP ID depois invalida todas as chaves de acesso cadastradas.
   - **Origens permitidas:** `https://ejccapelinha.com.br` e, se usado,
     `https://www.ejccapelinha.com.br`.
   - **Nome exibido:** `EJC Capelinha`.
2. **Vercel → Environment Variables (Production)**
   - `VITE_ENABLE_PASSKEY_LOGIN=true`
   - Faça o redeploy para a variável entrar no build.
3. Previews da Vercel (`*.vercel.app`) não funcionam com o RP ID de produção;
   mantenha a variável desligada nesses ambientes.

### Desligar rapidamente

- Remover `VITE_ENABLE_PASSKEY_LOGIN` (ou definir `false`) e redeployar oculta os botões.
- Desativar passkeys no painel do Supabase faz as tentativas falharem com mensagem
  amigável; a entrada por senha não é afetada.

## Desenvolvimento local

- `supabase/config.toml` já habilita passkeys com `rp_id = "localhost"`.
- Acesse o Vite por `http://localhost:5173` (WebAuthn não aceita `127.0.0.1` como RP ID).
- Defina `VITE_ENABLE_PASSKEY_LOGIN=true` no `.env.local`.
