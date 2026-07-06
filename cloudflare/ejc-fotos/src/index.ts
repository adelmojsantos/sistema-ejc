interface Env {
  FOTOS_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  ALLOWED_ORIGINS: string;
}

interface SupabaseUser {
  id: string;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    env.ALLOWED_ORIGINS
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function mutationCorsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin');

  if (origin && allowedOrigins(env).has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }

  return headers;
}

function isAllowedMutationOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && allowedOrigins(env).has(origin);
}

function objectKey(url: URL): string | null {
  let key: string;

  try {
    key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    return null;
  }

  if (
    !key.startsWith('fotos/')
    || key.length > 1024
    || key.includes('\\')
    || key.includes('\0')
    || key.split('/').some((segment) => segment === '..')
  ) {
    return null;
  }

  return key;
}

async function authenticate(request: Request, env: Env): Promise<SupabaseUser | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;

  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: {
      authorization,
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) return null;

  const user = await response.json<SupabaseUser>();
  return typeof user.id === 'string' ? user : null;
}

async function serveObject(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  key: string,
): Promise<Response> {
  const cacheKey = new Request(request.url, { method: 'GET' });

  if (request.method === 'GET') {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  }

  const object = request.method === 'HEAD'
    ? await env.FOTOS_BUCKET.head(key)
    : await env.FOTOS_BUCKET.get(key);

  if (!object) {
    return json({ error: 'Imagem não encontrada.' }, 404, {
      'access-control-allow-origin': '*',
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', object.httpMetadata?.cacheControl || PUBLIC_CACHE_CONTROL);
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');

  const response = new Response(
    request.method === 'HEAD' ? null : (object as R2ObjectBody).body,
    { headers },
  );

  if (request.method === 'GET') {
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
  }

  return response;
}

async function uploadObject(
  request: Request,
  env: Env,
  key: string,
  user: SupabaseUser,
): Promise<Response> {
  const corsHeaders = mutationCorsHeaders(request, env);
  const contentLength = Number(request.headers.get('content-length'));
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim() || '';

  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    return json({ error: 'O tamanho da imagem é obrigatório.' }, 411, corsHeaders);
  }

  if (contentLength > MAX_UPLOAD_BYTES) {
    return json({ error: 'A imagem deve ter no máximo 15 MB.' }, 413, corsHeaders);
  }

  if (!contentType.startsWith('image/')) {
    return json({ error: 'Envie somente arquivos de imagem.' }, 415, corsHeaders);
  }

  if (!request.body) {
    return json({ error: 'O arquivo da imagem é obrigatório.' }, 400, corsHeaders);
  }

  const uploaded = await env.FOTOS_BUCKET.put(key, request.body, {
    httpMetadata: {
      contentType,
      cacheControl: PUBLIC_CACHE_CONTROL,
    },
    customMetadata: {
      uploadedBy: user.id,
    },
    onlyIf: {
      etagDoesNotMatch: '*',
    },
  });

  if (!uploaded) {
    return json({ error: 'Já existe uma imagem nesse endereço.' }, 409, corsHeaders);
  }

  return json({
    key,
    url: new URL(`/${key}`, request.url).toString(),
  }, 201, corsHeaders);
}

async function deleteObject(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  key: string,
): Promise<Response> {
  await env.FOTOS_BUCKET.delete(key);
  const cacheKey = new Request(new URL(`/${key}`, request.url), { method: 'GET' });
  ctx.waitUntil(caches.default.delete(cacheKey));
  return new Response(null, {
    status: 204,
    headers: mutationCorsHeaders(request, env),
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ status: 'ok', storage: 'r2' }, 200, {
        'access-control-allow-origin': '*',
      });
    }

    if (request.method === 'OPTIONS') {
      if (!isAllowedMutationOrigin(request, env)) {
        return json({ error: 'Origem não permitida.' }, 403);
      }

      const headers = mutationCorsHeaders(request, env);
      headers.set('access-control-allow-methods', 'GET, HEAD, PUT, DELETE, OPTIONS');
      headers.set('access-control-allow-headers', 'Authorization, Content-Type');
      headers.set('access-control-max-age', '86400');
      return new Response(null, { status: 204, headers });
    }

    const key = objectKey(url);
    if (!key) {
      return json({ error: 'Endereço de imagem inválido.' }, 400);
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      return serveObject(request, env, ctx, key);
    }

    if (request.method !== 'PUT' && request.method !== 'DELETE') {
      return json(
        { error: 'Método não permitido.' },
        405,
        { allow: 'GET, HEAD, PUT, DELETE, OPTIONS' },
      );
    }

    const corsHeaders = mutationCorsHeaders(request, env);
    if (!isAllowedMutationOrigin(request, env)) {
      return json({ error: 'Origem não permitida.' }, 403, corsHeaders);
    }

    const user = await authenticate(request, env);
    if (!user) {
      return json({ error: 'Sessão inválida ou expirada.' }, 401, corsHeaders);
    }

    if (request.method === 'PUT') {
      return uploadObject(request, env, key, user);
    }

    return deleteObject(request, env, ctx, key);
  },
} satisfies ExportedHandler<Env>;
