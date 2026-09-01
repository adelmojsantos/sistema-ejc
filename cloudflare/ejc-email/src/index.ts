import PostalMime, { type Address, type Attachment, type Email } from 'postal-mime';

interface Env {
  EMAIL_BUCKET: R2Bucket;
  ALLOWED_ORIGINS: string;
  INSTITUTIONAL_EMAIL: string;
  SENDER_NAME: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
}

const MAX_EMAIL_BYTES = 20 * 1024 * 1024;
const MAX_REPLY_BYTES = 100 * 1024;
const PREVIEW_LENGTH = 500;
const EMAIL_PREFIX = 'emails/';

interface StoredMessage {
  id: string;
  conversa_id: string;
  provider_message_id: string | null;
  references_header: string | null;
  assunto: string;
  remetente_email: string;
  r2_texto_key: string | null;
  r2_html_key: string | null;
  r2_raw_key: string | null;
}

interface Conversation {
  id: string;
  assunto: string;
  contato_email: string;
  contato_nome: string | null;
  status: 'novo' | 'em_atendimento' | 'resolvido';
  responsavel_id: string | null;
}

interface ReplyPayload {
  conversaId: string;
  mensagem: string;
  requestId: string;
}

interface InboundAttachmentMetadata {
  id: string;
  nome: string;
  mime_type: string;
  tamanho_bytes: number;
  content_id: string | null;
  r2_key: string;
}

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(env.ALLOWED_ORIGINS.split(',').map((item) => item.trim()).filter(Boolean));
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin');
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }
  return headers;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
}

function supabaseHeaders(env: Env, token: string, serviceRole = false): Headers {
  const key = serviceRole ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_PUBLISHABLE_KEY;
  return new Headers({
    apikey: key,
    authorization: `Bearer ${serviceRole ? env.SUPABASE_SERVICE_ROLE_KEY : token}`,
    'content-type': 'application/json',
  });
}

async function supabaseRequest<T>(
  env: Env,
  path: string,
  init: RequestInit,
  token: string,
  serviceRole = false,
): Promise<T> {
  const headers = supabaseHeaders(env, token, serviceRole);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${response.status}: ${detail.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  const responseBody = await response.text();
  if (!responseBody) return undefined as T;
  return JSON.parse(responseBody) as T;
}

async function hasPermission(env: Env, token: string, rpc: string): Promise<boolean> {
  const result = await supabaseRequest<boolean>(env, `rpc/${rpc}`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, token);
  return result === true;
}

function addressEmail(address: Address | undefined, fallback = ''): string {
  return address?.address?.trim().toLowerCase() || fallback.trim().toLowerCase();
}

function addressName(address: Address | undefined): string | null {
  const value = address?.name?.trim();
  return value || null;
}

function addressList(addresses: Address[] | undefined): string[] {
  return (addresses || []).map((address) => addressEmail(address)).filter(Boolean);
}

function safeFileName(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.replace(/^-+|-+$/g, '').slice(0, 120) || 'anexo';
}

function plainPreview(parsed: Email): string {
  const source = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '';
  return source.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_LENGTH);
}

function messageIds(value: string | null): string[] {
  if (!value) return [];
  const bracketed = value.match(/<[^>]+>/g);
  return bracketed?.length ? bracketed : value.split(/\s+/).filter(Boolean);
}

async function findConversationId(
  env: Env,
  candidates: string[],
): Promise<string | null> {
  for (const id of candidates) {
    const encoded = encodeURIComponent(id);
    const rows = await supabaseRequest<Array<{ conversa_id: string }>>(
      env,
      `email_institucional_mensagens?select=conversa_id&provider_message_id=eq.${encoded}&limit=1`,
      { method: 'GET' },
      '',
      true,
    );
    if (rows[0]?.conversa_id) return rows[0].conversa_id;
  }
  return null;
}

async function ingestEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  if (message.rawSize > MAX_EMAIL_BYTES) {
    message.setReject('A mensagem excede o limite de 20 MB.');
    return;
  }

  const raw = await new Response(message.raw).arrayBuffer();
  const parsed = await PostalMime.parse(raw);
  const providerMessageId = message.headers.get('message-id') || parsed.messageId || null;

  if (providerMessageId) {
    const duplicate = await supabaseRequest<Array<{ id: string }>>(
      env,
      `email_institucional_mensagens?select=id&provider_message_id=eq.${encodeURIComponent(providerMessageId)}&limit=1`,
      { method: 'GET' },
      '',
      true,
    );
    if (duplicate.length > 0) return;
  }

  const messageId = crypto.randomUUID();
  const baseKey = `${EMAIL_PREFIX}${messageId}`;
  const uploadedKeys: string[] = [];
  const put = async (key: string, value: ArrayBuffer | Uint8Array | string, contentType: string) => {
    await env.EMAIL_BUCKET.put(key, value, {
      httpMetadata: { contentType, cacheControl: 'private, no-store' },
    });
    uploadedKeys.push(key);
  };

  try {
    const rawKey = `${baseKey}/original.eml`;
    await put(rawKey, raw, 'message/rfc822');

    const textKey = parsed.text ? `${baseKey}/body.txt` : null;
    const htmlKey = parsed.html ? `${baseKey}/body.html` : null;
    if (textKey && parsed.text) await put(textKey, parsed.text, 'text/plain; charset=utf-8');
    if (htmlKey && parsed.html) await put(htmlKey, parsed.html, 'text/html; charset=utf-8');

    const referencesHeader = message.headers.get('references');
    const inReplyTo = message.headers.get('in-reply-to') || parsed.inReplyTo || null;
    const candidates = [...messageIds(inReplyTo), ...messageIds(referencesHeader)];
    const conversationId = await findConversationId(env, candidates);

    const senderEmail = addressEmail(parsed.from, message.from);
    const senderName = addressName(parsed.from);
    const subject = parsed.subject?.trim() || '(sem assunto)';

    const attachmentMetadata: InboundAttachmentMetadata[] = [];
    const attachments = parsed.attachments || [];
    for (let index = 0; index < attachments.length; index += 1) {
      const attachment: Attachment = attachments[index];
      const attachmentId = crypto.randomUUID();
      const key = `${baseKey}/attachments/${index}-${safeFileName(attachment.filename || 'anexo')}`;
      const content = typeof attachment.content === 'string'
        ? new TextEncoder().encode(attachment.content)
        : attachment.content;
      await put(key, content, attachment.mimeType || 'application/octet-stream');
      attachmentMetadata.push({
        id: attachmentId,
        nome: attachment.filename || 'anexo',
        mime_type: attachment.mimeType || 'application/octet-stream',
        tamanho_bytes: content.byteLength,
        content_id: attachment.contentId || null,
        r2_key: key,
      });
    }

    await supabaseRequest<string>(env, 'rpc/registrar_email_institucional_recebido', {
      method: 'POST',
      body: JSON.stringify({ p_dados: {
        id: messageId,
        conversa_id: conversationId,
        provider_message_id: providerMessageId,
        in_reply_to: inReplyTo,
        references_header: referencesHeader,
        remetente_email: senderEmail,
        remetente_nome: senderName,
        destinatarios: addressList(parsed.to).length ? addressList(parsed.to) : [message.to],
        copias: addressList(parsed.cc),
        assunto: subject,
        assunto_conversa: subject.replace(/^\s*(re|res|enc|fwd)\s*:\s*/i, ''),
        previa: plainPreview(parsed),
        r2_texto_key: textKey,
        r2_html_key: htmlKey,
        r2_raw_key: rawKey,
        tamanho_bytes: raw.byteLength,
        recebida_em: parsed.date || new Date().toISOString(),
        anexos: attachmentMetadata,
      } }),
    }, '', true);
  } catch (error) {
    await Promise.all(uploadedKeys.map((key) => env.EMAIL_BUCKET.delete(key)));
    console.error(JSON.stringify({ event: 'institutional_email_ingest_failed', messageId, error: String(error) }));
    throw error;
  }
}

async function authorizedObjectResponse(
  request: Request,
  env: Env,
  table: 'email_institucional_mensagens' | 'email_institucional_anexos',
  id: string,
  keyColumn: string,
): Promise<Response> {
  const token = bearerToken(request);
  const cors = corsHeaders(request, env);
  if (!token || !(await hasPermission(env, token, 'pode_visualizar_email_institucional'))) {
    return json({ error: 'Acesso não autorizado.' }, 403, cors);
  }

  const select = table === 'email_institucional_anexos'
    ? `id,nome,mime_type,${keyColumn}`
    : `id,${keyColumn}`;
  const rows = await supabaseRequest<Array<Record<string, unknown>>>(
    env,
    `${table}?select=${select}&id=eq.${encodeURIComponent(id)}&limit=1`,
    { method: 'GET' },
    token,
  );
  const row = rows[0];
  const key = row?.[keyColumn];
  if (typeof key !== 'string') return json({ error: 'Conteúdo não encontrado.' }, 404, cors);

  const object = await env.EMAIL_BUCKET.get(key);
  if (!object) return json({ error: 'Conteúdo não encontrado.' }, 404, cors);
  if (table === 'email_institucional_anexos') {
    await supabaseRequest<void>(env, 'rpc/registrar_download_email_institucional', {
      method: 'POST',
      body: JSON.stringify({ p_anexo_id: id }),
    }, token);
  }
  const headers = new Headers(cors);
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  if (table === 'email_institucional_anexos') {
    const name = String(row.nome || 'anexo').replace(/["\r\n]/g, '');
    headers.set('content-disposition', `attachment; filename="${name}"`);
  }
  return new Response(object.body, { headers });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character] || character).replace(/\n/g, '<br>');
}

async function reply(request: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(request, env);
  const token = bearerToken(request);
  if (!token || !(await hasPermission(env, token, 'pode_responder_email_institucional'))) {
    return json({ error: 'Acesso não autorizado.' }, 403, cors);
  }

  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_REPLY_BYTES) return json({ error: 'Resposta muito grande.' }, 413, cors);
  const payload = await request.json<ReplyPayload>();
  if (!payload.conversaId || !payload.requestId || !payload.mensagem?.trim()) {
    return json({ error: 'Informe a conversa e a mensagem.' }, 400, cors);
  }

  const conversations = await supabaseRequest<Conversation[]>(env,
    `email_institucional_conversas?select=id,assunto,contato_email,contato_nome,status,responsavel_id&id=eq.${encodeURIComponent(payload.conversaId)}&limit=1`,
    { method: 'GET' }, token);
  const conversation = conversations[0];
  if (!conversation) return json({ error: 'Conversa não encontrada.' }, 404, cors);

  const lastMessages = await supabaseRequest<StoredMessage[]>(env,
    `email_institucional_mensagens?select=id,conversa_id,provider_message_id,references_header,assunto,remetente_email,r2_texto_key,r2_html_key,r2_raw_key&conversa_id=eq.${encodeURIComponent(payload.conversaId)}&order=criada_em.desc&limit=1`,
    { method: 'GET' }, token);
  const lastMessage = lastMessages[0];
  const outgoingProviderId = `outgoing:${payload.requestId}`;
  const existing = await supabaseRequest<Array<{ id: string; status_envio: string | null }>>(env,
    `email_institucional_mensagens?select=id,status_envio&provider_message_id=eq.${encodeURIComponent(outgoingProviderId)}&limit=1`,
    { method: 'GET' }, '', true);
  if (existing[0]?.status_envio === 'enviado') return json({ status: 'enviado' }, 200, cors);

  const userResponse = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) return json({ error: 'Sessão inválida.' }, 401, cors);
  const user = await userResponse.json<{ id: string }>();

  const messageId = existing[0]?.id || crypto.randomUUID();
  const bodyKey = `${EMAIL_PREFIX}${messageId}/body.txt`;
  let messagePersisted = Boolean(existing[0]);

  try {
    await env.EMAIL_BUCKET.put(bodyKey, payload.mensagem, {
      httpMetadata: { contentType: 'text/plain; charset=utf-8', cacheControl: 'private, no-store' },
    });
    if (!existing[0]) {
      await supabaseRequest<void>(env, 'email_institucional_mensagens', {
        method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
          id: messageId,
          conversa_id: conversation.id,
          direcao: 'saida',
          provider_message_id: outgoingProviderId,
          in_reply_to: lastMessage?.provider_message_id || null,
          references_header: [lastMessage?.references_header, lastMessage?.provider_message_id].filter(Boolean).join(' '),
          remetente_email: env.INSTITUTIONAL_EMAIL,
          remetente_nome: env.SENDER_NAME,
          destinatarios: [conversation.contato_email],
          assunto: `Re: ${conversation.assunto}`,
          previa: payload.mensagem.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_LENGTH),
          r2_texto_key: bodyKey,
          tamanho_bytes: new TextEncoder().encode(payload.mensagem).byteLength,
          status_envio: 'enviando',
          criado_por: user.id,
        })
      }, '', true);
      messagePersisted = true;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
        'idempotency-key': payload.requestId,
      },
      body: JSON.stringify({
        from: `${env.SENDER_NAME} <${env.INSTITUTIONAL_EMAIL}>`,
        to: [conversation.contato_email],
        subject: `Re: ${conversation.assunto}`,
        text: payload.mensagem,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6">${escapeHtml(payload.mensagem)}</div>`,
        reply_to: env.INSTITUTIONAL_EMAIL,
        headers: lastMessage?.provider_message_id ? {
          'In-Reply-To': lastMessage.provider_message_id,
          References: [lastMessage.references_header, lastMessage.provider_message_id].filter(Boolean).join(' '),
        } : undefined,
      }),
    });
    const result = await response.json<{ id?: string; message?: string }>();
    if (!response.ok) throw new Error(result.message || `Resend ${response.status}`);

    const sentAt = new Date().toISOString();
    const completionTasks: Promise<unknown>[] = [
      supabaseRequest<void>(env, `email_institucional_mensagens?id=eq.${messageId}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
          status_envio: 'enviado', erro_envio: null, enviada_em: sentAt,
        }),
      }, '', true),
      supabaseRequest<void>(env, `email_institucional_conversas?id=eq.${conversation.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
          status: 'em_atendimento', responsavel_id: user.id,
          ultima_mensagem_em: sentAt, atualizada_em: sentAt,
        }),
      }, '', true),
      supabaseRequest<void>(env, 'email_institucional_eventos', {
        method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
          conversa_id: conversation.id, mensagem_id: messageId, usuario_id: user.id,
          tipo: 'resposta_enviada', detalhes: { resend_id: result.id },
        }),
      }, '', true),
    ];
    if (conversation.status !== 'em_atendimento') {
      completionTasks.push(supabaseRequest<void>(env, 'email_institucional_eventos', {
        method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
          conversa_id: conversation.id, usuario_id: user.id, tipo: 'status_alterado',
          detalhes: { de: conversation.status, para: 'em_atendimento' },
        }),
      }, '', true));
    }
    if (conversation.responsavel_id !== user.id) {
      completionTasks.push(supabaseRequest<void>(env, 'email_institucional_eventos', {
        method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
          conversa_id: conversation.id, usuario_id: user.id, tipo: 'responsavel_alterado',
          detalhes: { de: conversation.responsavel_id, para: user.id },
        }),
      }, '', true));
    }
    await Promise.all(completionTasks);
    return json({ status: 'enviado', id: messageId }, 201, cors);
  } catch (error) {
    const detail = String(error).slice(0, 500);
    if (!messagePersisted) {
      await env.EMAIL_BUCKET.delete(bodyKey);
    } else {
      await Promise.allSettled([
        supabaseRequest<void>(env, `email_institucional_mensagens?id=eq.${messageId}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status_envio: 'falhou', erro_envio: detail }),
        }, '', true),
        supabaseRequest<void>(env, 'email_institucional_eventos', {
          method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
            conversa_id: conversation.id, mensagem_id: messageId, usuario_id: user.id,
            tipo: 'resposta_falhou', detalhes: { erro: detail },
          }),
        }, '', true),
      ]);
    }
    return json({ error: 'Não foi possível enviar a resposta.' }, 502, cors);
  }
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await ingestEmail(message, env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ status: 'ok', service: 'email-institucional' });
    }
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('origin');
      if (!origin || !allowedOrigins(env).has(origin)) return json({ error: 'Origem não permitida.' }, 403);
      const headers = corsHeaders(request, env);
      headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
      headers.set('access-control-allow-headers', 'Authorization, Content-Type');
      headers.set('access-control-max-age', '86400');
      return new Response(null, { status: 204, headers });
    }
    const origin = request.headers.get('origin');
    if (origin && !allowedOrigins(env).has(origin)) return json({ error: 'Origem não permitida.' }, 403);

    const messageMatch = url.pathname.match(/^\/messages\/([0-9a-f-]+)\/content\/(text|html|raw)$/);
    if (messageMatch && request.method === 'GET') {
      const keyColumn = messageMatch[2] === 'text' ? 'r2_texto_key'
        : messageMatch[2] === 'html' ? 'r2_html_key' : 'r2_raw_key';
      return authorizedObjectResponse(request, env, 'email_institucional_mensagens', messageMatch[1], keyColumn);
    }
    const attachmentMatch = url.pathname.match(/^\/attachments\/([0-9a-f-]+)$/);
    if (attachmentMatch && request.method === 'GET') {
      return authorizedObjectResponse(request, env, 'email_institucional_anexos', attachmentMatch[1], 'r2_key');
    }
    if (url.pathname === '/reply' && request.method === 'POST') return reply(request, env);
    return json({ error: 'Rota não encontrada.' }, 404, corsHeaders(request, env));
  },
} satisfies ExportedHandler<Env>;
