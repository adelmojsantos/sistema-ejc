import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GoogleApiError, isGoogleAccountRequiredError } from './googleApiError.ts';
import { googleImportDescriptor } from './googleImport.ts';

type GoogleRole = 'reader' | 'commenter' | 'writer';
type ManagedRole = 'reader' | 'writer';
type ManagementType = 'created' | 'updated' | 'observed';

interface GoogleIntegration {
  google_account_email: string;
  refresh_token_ciphertext: string;
  drive_root_folder_id: string;
  connected_at: string;
  last_error: string | null;
}

interface GooglePermission {
  id: string;
  type: string;
  role: string;
  emailAddress?: string;
  deleted?: boolean;
}

interface DesiredPermission {
  profile_id: string;
  google_email: string;
  google_role: ManagedRole;
}

interface TrackedPermission {
  id: string;
  arquivo_id: string;
  profile_id: string | null;
  google_email: string;
  permission_id: string | null;
  desired_role: ManagedRole;
  previous_role: GoogleRole | null;
  management_type: ManagementType;
  status: 'active' | 'error' | 'revoked' | 'skipped';
}

interface LibraryGoogleFile {
  id: string;
  nome_exibicao: string;
  google_file_id: string;
  google_managed: boolean;
  storage_path: string | null;
}

interface StoredLibraryFile {
  id: string;
  nome_exibicao: string;
  pasta_id: string | null;
  storage_path: string | null;
  tamanho_bytes: number;
  tipo_mime: string;
  origem: string;
}

const MAX_GOOGLE_IMPORT_BYTES = 25 * 1024 * 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Configuração ausente: ${name}.`);
  return value;
}

function errorMessage(error: unknown, fallback = 'Erro interno desconhecido.') {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === 'object'
    && error !== null
    && 'message' in error
    && typeof error.message === 'string'
    && error.message
  ) {
    return error.message;
  }
  return fallback;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function tokenEncryptionKey() {
  const raw = base64ToBytes(requiredEnv('GOOGLE_TOKEN_ENCRYPTION_KEY'));
  if (raw.byteLength !== 32) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY deve possuir 32 bytes em Base64.');
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await tokenEncryptionKey(),
    new TextEncoder().encode(token),
  ));
  const payload = new Uint8Array(iv.byteLength + encrypted.byteLength);
  payload.set(iv);
  payload.set(encrypted, iv.byteLength);
  return bytesToBase64(payload);
}

async function decryptToken(ciphertext: string) {
  const payload = base64ToBytes(ciphertext);
  if (payload.byteLength <= 12) throw new Error('Token OAuth armazenado é inválido.');
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: payload.slice(0, 12) },
    await tokenEncryptionKey(),
    payload.slice(12),
  );
  return new TextDecoder().decode(decrypted);
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  ));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function isScheduledSyncRequest(request: Request) {
  const supplied = request.headers.get('X-Google-Drive-Sync-Secret');
  if (!supplied) return false;
  const expected = requiredEnv('GOOGLE_DRIVE_SYNC_SECRET');
  const [suppliedHash, expectedHash] = await Promise.all([sha256(supplied), sha256(expected)]);
  return suppliedHash === expectedHash;
}

async function readGoogleError(response: Response) {
  try {
    const payload = await response.json() as {
      error?: { message?: string; errors?: Array<{ reason?: string }> } | string;
    };
    if (typeof payload.error === 'string') return payload.error;
    return payload.error?.message ?? `Google respondeu com HTTP ${response.status}.`;
  } catch {
    return `Google respondeu com HTTP ${response.status}.`;
  }
}

async function readGoogleApiError(response: Response) {
  try {
    const payload = await response.json() as {
      error?: { message?: string; errors?: Array<{ reason?: string }> } | string;
    };
    const message = typeof payload.error === 'string'
      ? payload.error
      : payload.error?.message ?? `Google respondeu com HTTP ${response.status}.`;
    const reasons = typeof payload.error === 'string'
      ? []
      : (payload.error?.errors ?? [])
        .map((item) => item.reason)
        .filter((reason): reason is string => typeof reason === 'string');
    return new GoogleApiError(response.status, message, reasons);
  } catch {
    return new GoogleApiError(response.status, `Google respondeu com HTTP ${response.status}.`);
  }
}

async function googleRequest<T>(accessToken: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) throw await readGoogleApiError(response);
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    code,
    client_id: requiredEnv('GOOGLE_DRIVE_CLIENT_ID'),
    client_secret: requiredEnv('GOOGLE_DRIVE_CLIENT_SECRET'),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(await readGoogleError(response));
  return await response.json() as {
    access_token: string;
    refresh_token?: string;
  };
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: requiredEnv('GOOGLE_DRIVE_CLIENT_ID'),
    client_secret: requiredEnv('GOOGLE_DRIVE_CLIENT_SECRET'),
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(await readGoogleError(response));
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error('O Google não retornou um token de acesso.');
  return payload.access_token;
}

async function requireLibraryManager(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'Autenticação necessária.' }), { status: 401 });
  }
  const token = authorization.slice('Bearer '.length);
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Response(JSON.stringify({ error: 'Sessão inválida.' }), { status: 401 });
  }
  const { data: canManage, error: permissionError } = await authClient.rpc(
    'pode_gerenciar_biblioteca',
    { check_user: userData.user.id },
  );
  if (permissionError || canManage !== true) {
    throw new Response(JSON.stringify({ error: 'Sem permissão para gerenciar a Biblioteca.' }), { status: 403 });
  }
  return userData.user;
}

async function getIntegration(adminClient: SupabaseClient) {
  const { data, error } = await adminClient
    .from('biblioteca_google_integracao')
    .select('google_account_email, refresh_token_ciphertext, drive_root_folder_id, connected_at, last_error')
    .eq('singleton', true)
    .maybeSingle();
  if (error) throw error;
  return data as GoogleIntegration | null;
}

async function integrationAccessToken(adminClient: SupabaseClient) {
  const integration = await getIntegration(adminClient);
  if (!integration) throw new Error('Conecte a conta Google central antes de continuar.');
  try {
    const accessToken = await refreshAccessToken(await decryptToken(integration.refresh_token_ciphertext));
    if (integration.last_error) {
      await adminClient.from('biblioteca_google_integracao')
        .update({ last_error: null, updated_at: new Date().toISOString() })
        .eq('singleton', true);
    }
    return { integration, accessToken };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao renovar acesso ao Google.';
    await adminClient.from('biblioteca_google_integracao')
      .update({ last_error: message, updated_at: new Date().toISOString() })
      .eq('singleton', true);
    throw error;
  }
}

async function createDriveRootFolder(accessToken: string) {
  const folder = await googleRequest<{ id: string }>(
    accessToken,
    'https://www.googleapis.com/drive/v3/files?fields=id',
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Biblioteca Sistema EJC',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    },
  );
  return folder.id;
}

async function uploadConvertedGoogleFile(
  accessToken: string,
  rootFolderId: string,
  fileName: string,
  source: Blob,
) {
  const descriptor = googleImportDescriptor(fileName);
  if (!descriptor) {
    throw new Error('Envie um arquivo DOC, DOCX, TXT, CSV ou XLSX para converter no Google.');
  }

  const boundary = `ejc_${crypto.randomUUID().replaceAll('-', '')}`;
  const metadata = JSON.stringify({
    name: descriptor.googleName,
    mimeType: descriptor.targetMimeType,
    parents: [rootFolderId],
  });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${descriptor.sourceMimeType}\r\n\r\n`,
    source,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!response.ok) throw await readGoogleApiError(response);
  return {
    driveFile: await response.json() as {
      id: string;
      name: string;
      mimeType: string;
      webViewLink: string;
    },
    fileType: descriptor.fileType,
  };
}

function roleRank(role: string | null | undefined) {
  if (role === 'owner') return 4;
  if (role === 'writer') return 3;
  if (role === 'commenter') return 2;
  if (role === 'reader') return 1;
  return 0;
}

async function upsertTracking(
  adminClient: SupabaseClient,
  values: {
    arquivo_id: string;
    profile_id: string | null;
    google_email: string;
    permission_id: string | null;
    desired_role: ManagedRole;
    previous_role: GoogleRole | null;
    management_type: ManagementType;
    status: 'active' | 'error' | 'revoked' | 'skipped';
    last_error: string | null;
  },
) {
  const now = new Date().toISOString();
  const { error } = await adminClient.from('biblioteca_google_permissoes').upsert({
    ...values,
    google_email: values.google_email.toLowerCase(),
    synced_at: values.status === 'active' ? now : null,
    updated_at: now,
  }, { onConflict: 'arquivo_id,google_email' });
  if (error) throw error;
}

async function listGooglePermissions(accessToken: string, googleFileId: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(googleFileId)}/permissions`);
  url.searchParams.set('fields', 'permissions(id,type,role,emailAddress,deleted)');
  url.searchParams.set('pageSize', '100');
  const result = await googleRequest<{ permissions?: GooglePermission[] }>(accessToken, url.toString());
  return result.permissions ?? [];
}

async function createGooglePermission(
  accessToken: string,
  googleFileId: string,
  email: string,
  role: ManagedRole,
) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(googleFileId)}/permissions`);
  url.searchParams.set('sendNotificationEmail', 'false');
  url.searchParams.set('fields', 'id,type,role,emailAddress');
  return googleRequest<GooglePermission>(accessToken, url.toString(), {
    method: 'POST',
    body: JSON.stringify({ type: 'user', role, emailAddress: email }),
  });
}

async function updateGooglePermission(
  accessToken: string,
  googleFileId: string,
  permissionId: string,
  role: GoogleRole,
) {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(googleFileId)}/permissions/${encodeURIComponent(permissionId)}`,
  );
  url.searchParams.set('fields', 'id,type,role,emailAddress');
  return googleRequest<GooglePermission>(accessToken, url.toString(), {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

async function deleteGooglePermission(
  accessToken: string,
  googleFileId: string,
  permissionId: string,
) {
  await googleRequest<void>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(googleFileId)}/permissions/${encodeURIComponent(permissionId)}`,
    { method: 'DELETE' },
  );
}

async function updateGoogleFile(
  accessToken: string,
  googleFileId: string,
  changes: { name?: string; trashed?: boolean },
) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(googleFileId)}`);
  url.searchParams.set('fields', 'id,name,mimeType,webViewLink,trashed');
  return googleRequest<{
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    trashed?: boolean;
  }>(accessToken, url.toString(), {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

async function getManagedLibraryFile(
  adminClient: SupabaseClient,
  arquivoId: string,
) {
  const { data, error } = await adminClient
    .from('biblioteca_arquivos')
    .select('id, nome_exibicao, google_file_id, google_managed, storage_path')
    .eq('id', arquivoId)
    .maybeSingle();
  if (error) throw error;
  const file = data as LibraryGoogleFile | null;
  if (!file?.google_managed || !file.google_file_id) {
    throw new Error('Este arquivo não é gerenciado pela integração Google Drive.');
  }
  return file;
}

async function removeSystemManagedPermissions(
  adminClient: SupabaseClient,
  accessToken: string,
  file: LibraryGoogleFile,
) {
  const { data, error } = await adminClient
    .from('biblioteca_google_permissoes')
    .select('*')
    .eq('arquivo_id', file.id)
    .neq('status', 'revoked');
  if (error) throw error;

  const tracked = (data ?? []) as TrackedPermission[];
  if (tracked.length === 0) return;
  const permissions = await listGooglePermissions(accessToken, file.google_file_id);

  for (const item of tracked) {
    const permission = permissions.find((candidate) =>
      candidate.id === item.permission_id
      || candidate.emailAddress?.toLowerCase() === item.google_email.toLowerCase()
    );
    if (!permission) continue;
    if (item.management_type === 'created') {
      await deleteGooglePermission(accessToken, file.google_file_id, permission.id);
    } else if (item.management_type === 'updated' && item.previous_role) {
      await updateGooglePermission(
        accessToken,
        file.google_file_id,
        permission.id,
        item.previous_role,
      );
    }
  }
}

async function syncGoogleFile(
  adminClient: SupabaseClient,
  accessToken: string,
  arquivoId: string,
) {
  const { data: fileData, error: fileError } = await adminClient
    .from('biblioteca_arquivos')
    .select('id, nome_exibicao, google_file_id, google_managed, storage_path')
    .eq('id', arquivoId)
    .maybeSingle();
  if (fileError) throw fileError;
  const file = fileData as LibraryGoogleFile | null;
  if (!file?.google_managed || !file.google_file_id) {
    await adminClient.from('biblioteca_google_sync_fila').delete().eq('arquivo_id', arquivoId);
    return { arquivoId, errors: [] as string[] };
  }

  await adminClient.from('biblioteca_arquivos').update({
    google_sync_status: 'syncing',
    google_sync_error: null,
  }).eq('id', arquivoId);

  const [{ data: desiredData, error: desiredError }, { data: trackingData, error: trackingError }] = await Promise.all([
    adminClient.rpc('biblioteca_google_usuarios_desejados', { p_arquivo_id: arquivoId }),
    adminClient.from('biblioteca_google_permissoes').select('*').eq('arquivo_id', arquivoId),
  ]);
  if (desiredError) throw desiredError;
  if (trackingError) throw trackingError;

  let permissions = await listGooglePermissions(accessToken, file.google_file_id);
  const desired = (desiredData ?? []) as DesiredPermission[];
  const tracked = (trackingData ?? []) as TrackedPermission[];
  const desiredEmails = new Set(desired.map((item) => item.google_email.toLowerCase()));
  const errors: string[] = [];

  for (const target of desired) {
    const email = target.google_email.toLowerCase();
    const previousTracking = tracked.find((item) => item.google_email === email);
    let googlePermission = permissions.find((permission) =>
      permission.type === 'user'
      && permission.deleted !== true
      && permission.emailAddress?.toLowerCase() === email
    );
    try {
      let managementType: ManagementType = previousTracking?.management_type ?? 'observed';
      let previousRole = previousTracking?.previous_role ?? null;

      if (!googlePermission) {
        googlePermission = await createGooglePermission(
          accessToken,
          file.google_file_id,
          email,
          target.google_role,
        );
        permissions = [...permissions, googlePermission];
        managementType = 'created';
        previousRole = null;
      } else if (previousTracking?.management_type === 'created') {
        if (googlePermission.role !== target.google_role) {
          googlePermission = await updateGooglePermission(
            accessToken,
            file.google_file_id,
            googlePermission.id,
            target.google_role,
          );
        }
        managementType = 'created';
      } else if (previousTracking?.management_type === 'updated' && previousTracking.previous_role) {
        if (roleRank(target.google_role) <= roleRank(previousTracking.previous_role)) {
          if (googlePermission.role !== previousTracking.previous_role) {
            googlePermission = await updateGooglePermission(
              accessToken,
              file.google_file_id,
              googlePermission.id,
              previousTracking.previous_role,
            );
          }
          managementType = 'observed';
          previousRole = null;
        } else if (googlePermission.role !== target.google_role) {
          googlePermission = await updateGooglePermission(
            accessToken,
            file.google_file_id,
            googlePermission.id,
            target.google_role,
          );
        }
      } else if (roleRank(googlePermission.role) < roleRank(target.google_role)) {
        const originalRole = googlePermission.role as GoogleRole;
        googlePermission = await updateGooglePermission(
          accessToken,
          file.google_file_id,
          googlePermission.id,
          target.google_role,
        );
        managementType = 'updated';
        previousRole = originalRole;
      }

      await upsertTracking(adminClient, {
        arquivo_id: arquivoId,
        profile_id: target.profile_id,
        google_email: email,
        permission_id: googlePermission.id,
        desired_role: target.google_role,
        previous_role: previousRole,
        management_type: managementType,
        status: 'active',
        last_error: null,
      });
    } catch (error) {
      if (isGoogleAccountRequiredError(error)) {
        await upsertTracking(adminClient, {
          arquivo_id: arquivoId,
          profile_id: target.profile_id,
          google_email: email,
          permission_id: null,
          desired_role: target.google_role,
          previous_role: null,
          management_type: 'observed',
          status: 'skipped',
          last_error: null,
        });
        continue;
      }
      const message = error instanceof Error ? error.message : 'Falha desconhecida.';
      errors.push(`${email}: ${message}`);
      await upsertTracking(adminClient, {
        arquivo_id: arquivoId,
        profile_id: target.profile_id,
        google_email: email,
        permission_id: googlePermission?.id ?? previousTracking?.permission_id ?? null,
        desired_role: target.google_role,
        previous_role: previousTracking?.previous_role ?? null,
        management_type: previousTracking?.management_type ?? 'observed',
        status: 'error',
        last_error: message,
      });
    }
  }

  for (const stale of tracked.filter((item) =>
    item.status !== 'revoked' && !desiredEmails.has(item.google_email.toLowerCase())
  )) {
    try {
      const googlePermission = permissions.find((permission) =>
        permission.id === stale.permission_id
        || permission.emailAddress?.toLowerCase() === stale.google_email.toLowerCase()
      );
      if (googlePermission && stale.management_type === 'created') {
        await deleteGooglePermission(accessToken, file.google_file_id, googlePermission.id);
      } else if (googlePermission && stale.management_type === 'updated' && stale.previous_role) {
        await updateGooglePermission(
          accessToken,
          file.google_file_id,
          googlePermission.id,
          stale.previous_role,
        );
      }
      await upsertTracking(adminClient, {
        arquivo_id: arquivoId,
        profile_id: stale.profile_id,
        google_email: stale.google_email,
        permission_id: stale.permission_id,
        desired_role: stale.desired_role,
        previous_role: stale.previous_role,
        management_type: stale.management_type,
        status: 'revoked',
        last_error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida.';
      errors.push(`${stale.google_email}: ${message}`);
      await upsertTracking(adminClient, {
        arquivo_id: arquivoId,
        profile_id: stale.profile_id,
        google_email: stale.google_email,
        permission_id: stale.permission_id,
        desired_role: stale.desired_role,
        previous_role: stale.previous_role,
        management_type: stale.management_type,
        status: 'error',
        last_error: message,
      });
    }
  }

  const now = new Date().toISOString();
  if (errors.length === 0 && file.storage_path) {
    const { error: removeError } = await adminClient.storage
      .from('biblioteca')
      .remove([file.storage_path]);
    if (removeError) {
      errors.push(`Não foi possível remover o arquivo original do armazenamento: ${removeError.message}`);
    } else {
      const { error: clearStorageError } = await adminClient
        .from('biblioteca_arquivos')
        .update({ storage_path: null, tamanho_bytes: 0 })
        .eq('id', arquivoId);
      if (clearStorageError) {
        errors.push(`Não foi possível concluir a limpeza do arquivo original: ${clearStorageError.message}`);
      }
    }
  }
  if (errors.length === 0) {
    await Promise.all([
      adminClient.from('biblioteca_google_sync_fila').delete().eq('arquivo_id', arquivoId),
      adminClient.from('biblioteca_arquivos').update({
        google_sync_status: 'synced',
        google_sync_error: null,
        google_synced_at: now,
      }).eq('id', arquivoId),
    ]);
  } else {
    const { data: queue } = await adminClient.from('biblioteca_google_sync_fila')
      .select('attempts').eq('arquivo_id', arquivoId).maybeSingle();
    const attempts = Number(queue?.attempts ?? 0) + 1;
    const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 10) * 15);
    await Promise.all([
      adminClient.from('biblioteca_google_sync_fila').upsert({
        arquivo_id: arquivoId,
        status: 'error',
        attempts,
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        last_error: errors.join('\n'),
        locked_at: null,
      }),
      adminClient.from('biblioteca_arquivos').update({
        google_sync_status: 'error',
        google_sync_error: errors.join('\n'),
      }).eq('id', arquivoId),
    ]);
  }
  return { arquivoId, errors };
}

async function processPendingQueue(
  adminClient: SupabaseClient,
  limit = 10,
) {
  const { integration, accessToken } = await integrationAccessToken(adminClient);
  const { data: claimed, error: claimError } = await adminClient.rpc(
    'claim_biblioteca_google_sync_fila',
    { p_limit: limit },
  );
  if (claimError) throw claimError;
  const results: Array<{ arquivoId: string; errors: string[] }> = [];
  for (const item of claimed ?? []) {
    const arquivoId = String(item.arquivo_id);
    try {
      results.push(await syncGoogleFile(adminClient, accessToken, arquivoId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida.';
      await Promise.all([
        adminClient.from('biblioteca_google_sync_fila').update({
          status: 'error',
          last_error: message,
          locked_at: null,
          next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        }).eq('arquivo_id', arquivoId),
        adminClient.from('biblioteca_arquivos').update({
          google_sync_status: 'error',
          google_sync_error: message,
        }).eq('id', arquivoId),
      ]);
      results.push({ arquivoId, errors: [message] });
    }
  }
  return { accountEmail: integration.google_account_email, results };
}

async function processSpecificFiles(
  adminClient: SupabaseClient,
  arquivoIds: string[],
) {
  const { integration, accessToken } = await integrationAccessToken(adminClient);
  const results: Array<{ arquivoId: string; errors: string[] }> = [];
  for (const arquivoId of arquivoIds.slice(0, 25)) {
    try {
      results.push(await syncGoogleFile(adminClient, accessToken, arquivoId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida.';
      await Promise.all([
        adminClient.from('biblioteca_google_sync_fila').update({
          status: 'error',
          last_error: message,
          locked_at: null,
          next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        }).eq('arquivo_id', arquivoId),
        adminClient.from('biblioteca_arquivos').update({
          google_sync_status: 'error',
          google_sync_error: message,
        }).eq('id', arquivoId),
      ]);
      results.push({ arquivoId, errors: [message] });
    }
  }
  return { accountEmail: integration.google_account_email, results };
}

async function handleOAuthCallback(
  requestUrl: URL,
  adminClient: SupabaseClient,
  supabaseUrl: string,
) {
  const state = requestUrl.searchParams.get('state');
  const code = requestUrl.searchParams.get('code');
  const oauthError = requestUrl.searchParams.get('error');
  const appUrl = new URL('/biblioteca', requiredEnv('PUBLIC_APP_URL'));
  if (oauthError) {
    appUrl.searchParams.set('google', 'denied');
    return Response.redirect(appUrl.toString(), 302);
  }
  if (!state || !code) return jsonResponse(400, { error: 'Retorno OAuth incompleto.' });

  const stateHash = await sha256(state);
  const { data: storedState, error: stateError } = await adminClient
    .from('biblioteca_google_oauth_state')
    .select('state_hash, requested_by, expires_at, used_at')
    .eq('state_hash', stateHash)
    .maybeSingle();
  if (
    stateError
    || !storedState
    || storedState.used_at
    || new Date(storedState.expires_at).getTime() <= Date.now()
  ) {
    return jsonResponse(400, { error: 'Estado OAuth inválido ou expirado.' });
  }

  const redirectUri = `${supabaseUrl}/functions/v1/google-drive/callback`;
  const tokens = await exchangeAuthorizationCode(code, redirectUri);
  if (!tokens.refresh_token) {
    throw new Error('O Google não retornou autorização permanente. Reconecte a conta.');
  }
  const userInfo = await googleRequest<{ email?: string }>(
    tokens.access_token,
    'https://openidconnect.googleapis.com/v1/userinfo',
  );
  if (!userInfo.email) throw new Error('Não foi possível identificar a conta Google conectada.');

  const existing = await getIntegration(adminClient);
  if (
    existing
    && existing.google_account_email.toLowerCase() !== userInfo.email.toLowerCase()
  ) {
    const { count, error } = await adminClient
      .from('biblioteca_arquivos')
      .select('*', { count: 'exact', head: true })
      .eq('google_managed', true);
    if (error) throw error;
    if ((count ?? 0) > 0) {
      appUrl.searchParams.set('google', 'account_mismatch');
      return Response.redirect(appUrl.toString(), 302);
    }
  }
  let rootFolderId = existing?.drive_root_folder_id ?? '';
  if (rootFolderId) {
    try {
      await googleRequest<{ id: string }>(
        tokens.access_token,
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rootFolderId)}?fields=id&supportsAllDrives=true`,
      );
    } catch {
      rootFolderId = '';
    }
  }
  if (!rootFolderId) rootFolderId = await createDriveRootFolder(tokens.access_token);

  const now = new Date().toISOString();
  const { error: integrationError } = await adminClient.from('biblioteca_google_integracao').upsert({
    singleton: true,
    google_account_email: userInfo.email.toLowerCase(),
    refresh_token_ciphertext: await encryptToken(tokens.refresh_token),
    drive_root_folder_id: rootFolderId,
    connected_by: storedState.requested_by,
    connected_at: now,
    updated_at: now,
    last_error: null,
  });
  if (integrationError) throw integrationError;
  await adminClient.from('biblioteca_google_oauth_state')
    .update({ used_at: now })
    .eq('state_hash', stateHash);

  appUrl.searchParams.set('google', 'connected');
  return Response.redirect(appUrl.toString(), 302);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const requestUrl = new URL(request.url);

    if (request.method === 'GET' && requestUrl.pathname.endsWith('/callback')) {
      return await handleOAuthCallback(requestUrl, adminClient, supabaseUrl);
    }
    if (request.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido.' });

    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');
    const scheduledSync = action === 'sync-pending' && await isScheduledSyncRequest(request);
    const user = scheduledSync
      ? null
      : await requireLibraryManager(request, supabaseUrl, anonKey);

    if (action === 'status') {
      const integration = await getIntegration(adminClient);
      const [{ count: pending }, { count: errors }] = await Promise.all([
        adminClient.from('biblioteca_google_sync_fila')
          .select('*', { count: 'exact', head: true }),
        adminClient.from('biblioteca_arquivos')
          .select('*', { count: 'exact', head: true })
          .eq('google_sync_status', 'error'),
      ]);
      return jsonResponse(200, {
        connected: Boolean(integration),
        accountEmail: integration?.google_account_email ?? null,
        connectedAt: integration?.connected_at ?? null,
        lastError: integration?.last_error ?? null,
        pendingCount: pending ?? 0,
        errorCount: errors ?? 0,
      });
    }

    if (action === 'start-oauth') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      await adminClient.from('biblioteca_google_oauth_state')
        .delete()
        .or(`used_at.not.is.null,expires_at.lt.${new Date().toISOString()}`);
      const state = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
        .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      const { error } = await adminClient.from('biblioteca_google_oauth_state').insert({
        state_hash: await sha256(state),
        requested_by: user.id,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw error;
      const redirectUri = `${supabaseUrl}/functions/v1/google-drive/callback`;
      const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorizationUrl.searchParams.set('client_id', requiredEnv('GOOGLE_DRIVE_CLIENT_ID'));
      authorizationUrl.searchParams.set('redirect_uri', redirectUri);
      authorizationUrl.searchParams.set('response_type', 'code');
      authorizationUrl.searchParams.set('scope', [
        'openid',
        'email',
        'https://www.googleapis.com/auth/drive.file',
      ].join(' '));
      authorizationUrl.searchParams.set('access_type', 'offline');
      authorizationUrl.searchParams.set('include_granted_scopes', 'true');
      authorizationUrl.searchParams.set('prompt', 'consent');
      authorizationUrl.searchParams.set('state', state);
      return jsonResponse(200, { authorizationUrl: authorizationUrl.toString() });
    }

    if (action === 'create-file') {
      const name = String(body.name ?? '').trim();
      const fileType = body.fileType === 'spreadsheet' ? 'spreadsheet' : 'document';
      const pastaId = typeof body.pastaId === 'string' && body.pastaId ? body.pastaId : null;
      if (!name || name.length > 200) {
        return jsonResponse(400, { error: 'Informe um nome de até 200 caracteres.' });
      }
      const { integration, accessToken } = await integrationAccessToken(adminClient);
      const mimeType = fileType === 'spreadsheet'
        ? 'application/vnd.google-apps.spreadsheet'
        : 'application/vnd.google-apps.document';
      const driveFile = await googleRequest<{
        id: string;
        name: string;
        mimeType: string;
        webViewLink: string;
      }>(accessToken, 'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
        method: 'POST',
        body: JSON.stringify({
          name,
          mimeType,
          parents: [integration.drive_root_folder_id],
        }),
      });

      const { data: libraryFile, error: insertError } = await adminClient
        .from('biblioteca_arquivos')
        .insert({
          nome_exibicao: driveFile.name,
          pasta_id: pastaId,
          storage_path: null,
          tamanho_bytes: 0,
          tipo_mime: driveFile.mimeType,
          origem: 'google_drive',
          google_file_id: driveFile.id,
          google_tipo: fileType,
          url_externa: driveFile.webViewLink,
          google_managed: true,
          google_sync_status: 'pending',
        })
        .select('*')
        .single();
      if (insertError) {
        try {
          await googleRequest<void>(
            accessToken,
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFile.id)}`,
            { method: 'DELETE' },
          );
        } catch {
          // Compensação best effort; o erro original do banco é o relevante.
        }
        throw insertError;
      }
      let syncErrors: string[] = [];
      try {
        syncErrors = (await syncGoogleFile(adminClient, accessToken, libraryFile.id)).errors;
      } catch (error) {
        syncErrors = [error instanceof Error ? error.message : 'Falha ao sincronizar permissões.'];
      }
      return jsonResponse(201, { file: libraryFile, syncErrors });
    }

    if (action === 'import-file') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const arquivoId = typeof body.arquivoId === 'string' && body.arquivoId
        ? body.arquivoId
        : null;
      let sourceFile: StoredLibraryFile;

      if (arquivoId) {
        const { data, error } = await adminClient
          .from('biblioteca_arquivos')
          .select('id, nome_exibicao, pasta_id, storage_path, tamanho_bytes, tipo_mime, origem')
          .eq('id', arquivoId)
          .maybeSingle();
        if (error) throw error;
        sourceFile = data as StoredLibraryFile;
        if (!sourceFile || sourceFile.origem !== 'supabase' || !sourceFile.storage_path) {
          return jsonResponse(400, { error: 'O arquivo informado não está disponível no armazenamento.' });
        }
      } else {
        const storagePath = String(body.storagePath ?? '');
        const fileName = String(body.fileName ?? '').trim();
        const pastaId = typeof body.pastaId === 'string' && body.pastaId ? body.pastaId : null;
        const size = Number(body.size ?? 0);
        if (!storagePath.startsWith(`google-imports/${user.id}/`) || !fileName) {
          return jsonResponse(400, { error: 'Arquivo temporário inválido.' });
        }
        sourceFile = {
          id: '',
          nome_exibicao: fileName,
          pasta_id: pastaId,
          storage_path: storagePath,
          tamanho_bytes: Number.isFinite(size) ? size : 0,
          tipo_mime: String(body.mimeType ?? 'application/octet-stream'),
          origem: 'supabase',
        };
      }

      if (!googleImportDescriptor(sourceFile.nome_exibicao)) {
        return jsonResponse(415, { error: 'Envie um arquivo DOC, DOCX, TXT, CSV ou XLSX.' });
      }
      if (sourceFile.tamanho_bytes > MAX_GOOGLE_IMPORT_BYTES) {
        return jsonResponse(413, { error: 'O arquivo editável deve ter no máximo 25 MB.' });
      }
      const sourceStoragePath = sourceFile.storage_path;
      if (!sourceStoragePath) {
        return jsonResponse(400, { error: 'O arquivo não possui uma origem válida no armazenamento.' });
      }

      const { data: sourceBlob, error: downloadError } = await adminClient.storage
        .from('biblioteca')
        .download(sourceStoragePath);
      if (downloadError || !sourceBlob) {
        throw new Error(errorMessage(downloadError, 'Não foi possível ler o arquivo no armazenamento.'));
      }
      if (sourceBlob.size <= 0 || sourceBlob.size > MAX_GOOGLE_IMPORT_BYTES) {
        return jsonResponse(413, { error: 'O arquivo editável deve possuir entre 1 byte e 25 MB.' });
      }

      const { integration, accessToken } = await integrationAccessToken(adminClient);
      const { driveFile, fileType } = await uploadConvertedGoogleFile(
        accessToken,
        integration.drive_root_folder_id,
        sourceFile.nome_exibicao,
        sourceBlob,
      );

      const googleValues = {
        nome_exibicao: driveFile.name,
        pasta_id: sourceFile.pasta_id,
        storage_path: sourceStoragePath,
        tipo_mime: driveFile.mimeType,
        origem: 'google_drive',
        google_file_id: driveFile.id,
        google_tipo: fileType,
        url_externa: driveFile.webViewLink,
        google_managed: true,
        google_sync_status: 'pending',
        google_sync_error: null,
        google_synced_at: null,
      };
      const query = arquivoId
        ? adminClient.from('biblioteca_arquivos').update(googleValues).eq('id', arquivoId)
        : adminClient.from('biblioteca_arquivos').insert({
          ...googleValues,
          tamanho_bytes: sourceBlob.size,
        });
      const { data: libraryFile, error: saveError } = await query.select('*').single();
      if (saveError) {
        try {
          await googleRequest<void>(
            accessToken,
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFile.id)}`,
            { method: 'DELETE' },
          );
        } catch {
          // Compensação best effort; o arquivo original continua preservado.
        }
        throw new Error(errorMessage(saveError, 'Não foi possível registrar o arquivo convertido.'));
      }

      let syncErrors: string[] = [];
      try {
        syncErrors = (await syncGoogleFile(adminClient, accessToken, libraryFile.id)).errors;
      } catch (error) {
        syncErrors = [error instanceof Error ? error.message : 'Falha ao sincronizar permissões.'];
      }
      const { data: refreshedFile } = await adminClient
        .from('biblioteca_arquivos')
        .select('*')
        .eq('id', libraryFile.id)
        .single();
      return jsonResponse(201, { file: refreshedFile ?? libraryFile, syncErrors });
    }

    if (action === 'rename-file') {
      const arquivoId = String(body.arquivoId ?? '');
      const name = String(body.name ?? '').trim();
      if (!arquivoId || !name || name.length > 200) {
        return jsonResponse(400, { error: 'Informe o arquivo e um nome de até 200 caracteres.' });
      }
      const file = await getManagedLibraryFile(adminClient, arquivoId);
      const { accessToken } = await integrationAccessToken(adminClient);
      const driveFile = await updateGoogleFile(accessToken, file.google_file_id, { name });
      const { data: libraryFile, error } = await adminClient
        .from('biblioteca_arquivos')
        .update({ nome_exibicao: driveFile.name })
        .eq('id', file.id)
        .select('*')
        .single();
      if (error) {
        try {
          await updateGoogleFile(accessToken, file.google_file_id, { name: file.nome_exibicao });
        } catch {
          // Compensação best effort; o erro original do banco é o relevante.
        }
        throw error;
      }
      return jsonResponse(200, { file: libraryFile });
    }

    if (action === 'trash-file') {
      const arquivoId = String(body.arquivoId ?? '');
      if (!arquivoId) return jsonResponse(400, { error: 'Informe o arquivo a excluir.' });
      const file = await getManagedLibraryFile(adminClient, arquivoId);
      const { accessToken } = await integrationAccessToken(adminClient);

      try {
        await removeSystemManagedPermissions(adminClient, accessToken, file);
      } catch (error) {
        await adminClient.rpc('enfileirar_biblioteca_google_arquivo', {
          p_arquivo_id: file.id,
        });
        throw error;
      }
      await updateGoogleFile(accessToken, file.google_file_id, { trashed: true });
      const { error } = await adminClient.from('biblioteca_arquivos').delete().eq('id', file.id);
      if (error) {
        try {
          await updateGoogleFile(accessToken, file.google_file_id, { trashed: false });
        } catch {
          // Compensação best effort; o erro original do banco é o relevante.
        }
        await adminClient.rpc('enfileirar_biblioteca_google_arquivo', {
          p_arquivo_id: file.id,
        });
        throw error;
      }
      return jsonResponse(200, { trashed: true });
    }

    if (action === 'sync-item') {
      const pastaId = typeof body.pastaId === 'string' ? body.pastaId : null;
      const arquivoId = typeof body.arquivoId === 'string' ? body.arquivoId : null;
      if (!pastaId && !arquivoId) {
        return jsonResponse(400, { error: 'Informe a pasta ou o arquivo para sincronizar.' });
      }
      const { data: affected, error } = await adminClient.rpc(
        'biblioteca_google_arquivos_afetados',
        { p_pasta_id: pastaId, p_arquivo_id: arquivoId },
      );
      if (error) throw error;
      const affectedFiles = (affected ?? []) as Array<{ arquivo_id: string }>;
      if (affectedFiles.length === 0) {
        return jsonResponse(200, { accountEmail: null, results: [] });
      }
      for (const item of affectedFiles) {
        await adminClient.rpc('enfileirar_biblioteca_google_arquivo', {
          p_arquivo_id: item.arquivo_id,
        });
      }
      return jsonResponse(200, await processSpecificFiles(
        adminClient,
        affectedFiles.map((item) => String(item.arquivo_id)),
      ));
    }

    if (action === 'sync-pending') {
      const requestedLimit = Number(body.limit ?? 10);
      const limit = Number.isFinite(requestedLimit) ? Math.min(25, Math.max(1, requestedLimit)) : 10;
      return jsonResponse(200, await processPendingQueue(adminClient, limit));
    }

    return jsonResponse(400, { error: 'Ação desconhecida.' });
  } catch (error) {
    if (error instanceof Response) {
      const text = await error.text();
      return new Response(text, {
        status: error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const message = errorMessage(error);
    return jsonResponse(500, { error: message });
  }
});
