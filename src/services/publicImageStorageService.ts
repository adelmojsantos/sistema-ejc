import { supabase } from '../lib/supabase';

const DEFAULT_PUBLIC_IMAGE_BASE_URL = 'https://ejc-fotos.ejcsecretaria-sistema.workers.dev';
const PUBLIC_IMAGE_BASE_URL = (
  import.meta.env.VITE_PUBLIC_IMAGE_BASE_URL || DEFAULT_PUBLIC_IMAGE_BASE_URL
).replace(/\/+$/, '');

function objectUrl(path: string): string {
  const normalizedPath = path
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  return `${PUBLIC_IMAGE_BASE_URL}/${normalizedPath}`;
}

async function authorizationHeader(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new Error('Sessão expirada. Faça login novamente para enviar a imagem.');
  }

  return `Bearer ${accessToken}`;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json() as { error?: string };
    return new Error(body.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function uploadPublicImage(path: string, file: File): Promise<string> {
  const response = await fetch(objectUrl(path), {
    method: 'PUT',
    headers: {
      authorization: await authorizationHeader(),
      'content-type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    throw await responseError(response, 'Não foi possível enviar a imagem.');
  }

  const body = await response.json() as { url?: string };
  if (!body.url) {
    throw new Error('O armazenamento não retornou o endereço da imagem.');
  }

  return body.url;
}

export async function removePublicImage(url: string): Promise<void> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return;
  }

  const workerUrl = new URL(PUBLIC_IMAGE_BASE_URL);
  if (parsedUrl.origin === workerUrl.origin && parsedUrl.pathname.startsWith('/fotos/')) {
    const response = await fetch(parsedUrl.toString(), {
      method: 'DELETE',
      headers: {
        authorization: await authorizationHeader(),
      },
    });

    if (!response.ok && response.status !== 404) {
      throw await responseError(response, 'Não foi possível remover a imagem.');
    }
    return;
  }

  const legacyMarker = '/storage/v1/object/public/galeria/';
  const markerIndex = parsedUrl.pathname.indexOf(legacyMarker);
  if (markerIndex < 0) return;

  const storagePath = decodeURIComponent(
    parsedUrl.pathname.slice(markerIndex + legacyMarker.length),
  );
  if (!storagePath.startsWith('fotos/')) return;

  const { error } = await supabase.storage.from('galeria').remove([storagePath]);
  if (error) throw error;
}

