import { supabase } from '../lib/supabase';

const PRIVATE_STORAGE_SCHEME = 'private-storage://';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;

export interface StorageLocation {
  bucket: string;
  path: string;
  private: boolean;
}

export function createPrivateStorageReference(bucket: string, path: string) {
  return `${PRIVATE_STORAGE_SCHEME}${bucket}/${encodeURI(path)}`;
}

export function isPrivateStorageReference(value: string | null | undefined) {
  return Boolean(value?.startsWith(PRIVATE_STORAGE_SCHEME));
}

export function getStorageLocation(value: string | null | undefined): StorageLocation | null {
  if (!value) return null;

  if (isPrivateStorageReference(value)) {
    const withoutScheme = value.slice(PRIVATE_STORAGE_SCHEME.length);
    const separatorIndex = withoutScheme.indexOf('/');
    if (separatorIndex <= 0) return null;

    return {
      bucket: withoutScheme.slice(0, separatorIndex),
      path: decodeURI(withoutScheme.slice(separatorIndex + 1)),
      private: true,
    };
  }

  try {
    const url = new URL(value);
    const publicMarker = '/storage/v1/object/public/';
    const markerIndex = url.pathname.indexOf(publicMarker);
    if (markerIndex < 0) return null;

    const storagePath = decodeURIComponent(url.pathname.slice(markerIndex + publicMarker.length));
    const separatorIndex = storagePath.indexOf('/');
    if (separatorIndex <= 0) return null;

    return {
      bucket: storagePath.slice(0, separatorIndex),
      path: storagePath.slice(separatorIndex + 1),
      private: false,
    };
  } catch {
    return null;
  }
}

export async function resolveStorageReference(
  value: string,
  expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS,
) {
  const location = getStorageLocation(value);
  if (!location?.private) return value;

  const { data, error } = await supabase.storage
    .from(location.bucket)
    .createSignedUrl(location.path, expiresIn);
  if (error) throw error;
  if (!data.signedUrl) throw new Error('Não foi possível gerar o acesso temporário ao arquivo.');
  return data.signedUrl;
}

export async function removeStorageReference(value: string) {
  const location = getStorageLocation(value);
  if (!location) return;

  const { error } = await supabase.storage
    .from(location.bucket)
    .remove([location.path]);
  if (error) throw error;
}
