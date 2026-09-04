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

interface GoogleImportSession {
  id: string;
  requested_by: string;
  source_account_email: string | null;
  refresh_token_ciphertext: string | null;
  selected_folder_id: string | null;
  selected_folder_name: string | null;
  destination_root_folder_id: string | null;
  status: 'connecting' | 'connected' | 'folder_selected' | 'inventory_scanning' | 'inventory_ready' | 'inventory_confirmed' | 'copying' | 'completed' | 'completed_with_errors' | 'revoked' | 'expired' | 'error';
  expires_at: string;
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

interface DriveFolderItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
  trashed?: boolean;
}

async function requireSystemAdmin(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
  userId: string,
) {
  const authorization = request.headers.get('Authorization');
  if (!authorization) throw new Response(JSON.stringify({ error: 'Autenticação necessária.' }), { status: 401 });
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const [roleAdminResult, permissionAdminResult] = await Promise.all([
    authClient.rpc('is_admin', { check_user: userId }),
    authClient.rpc('has_permission', {
      check_user: userId,
      permission_key: 'modulo_admin',
    }),
  ]);
  if (roleAdminResult.data !== true && permissionAdminResult.data !== true) {
    throw new Response(JSON.stringify({ error: 'Apenas administradores podem importar de outro Drive.' }), { status: 403 });
  }
}

async function getActiveImportSession(adminClient: SupabaseClient, requestedBy: string) {
  const now = new Date().toISOString();
  const { data: expiredSessions, error: expiredError } = await adminClient
    .from('biblioteca_google_importacoes')
    .select('id,refresh_token_ciphertext')
    .eq('requested_by', requestedBy)
    .in('status', ['connecting', 'connected', 'folder_selected', 'inventory_scanning', 'inventory_ready', 'inventory_confirmed', 'copying', 'completed', 'completed_with_errors'])
    .lte('expires_at', now);
  if (expiredError) throw expiredError;
  for (const expired of expiredSessions ?? []) {
    if (expired.refresh_token_ciphertext) {
      await revokeGoogleRefreshToken(expired.refresh_token_ciphertext);
    }
    const { error: cleanupError } = await adminClient
      .from('biblioteca_google_importacoes')
      .update({ status: 'expired', refresh_token_ciphertext: null, updated_at: now })
      .eq('id', expired.id);
    if (cleanupError) throw cleanupError;
  }

  const { data, error } = await adminClient
    .from('biblioteca_google_importacoes')
    .select('id,requested_by,source_account_email,refresh_token_ciphertext,selected_folder_id,selected_folder_name,destination_root_folder_id,status,expires_at,last_error')
    .eq('requested_by', requestedBy)
    .in('status', ['connecting', 'connected', 'folder_selected', 'inventory_scanning', 'inventory_ready', 'inventory_confirmed', 'copying', 'completed', 'completed_with_errors'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GoogleImportSession | null;
}

async function revokeGoogleRefreshToken(ciphertext: string) {
  try {
    const refreshToken = await decryptToken(ciphertext);
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch {
    // A credencial local ainda será apagada se o endpoint de revogação estiver indisponível.
  }
}

const GOOGLE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

async function inventoryResponse(adminClient: SupabaseClient, sessionId: string) {
  const [{ data: summaryRows, error: summaryError }, { data: sample, error: sampleError }] = await Promise.all([
    adminClient.rpc('biblioteca_google_importacao_resumo', { p_importacao_id: sessionId }),
    adminClient
      .from('biblioteca_google_importacao_itens')
      .select('google_file_id,nome,mime_type,tamanho_bytes,caminho_relativo')
      .eq('importacao_id', sessionId)
      .not('parent_google_file_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20),
  ]);
  if (summaryError) throw summaryError;
  if (sampleError) throw sampleError;
  const summary = summaryRows?.[0] ?? {
    pastas: 0,
    arquivos: 0,
    itens: 0,
    tamanho_bytes: 0,
    pastas_pendentes: 0,
  };
  return {
    folders: Number(summary.pastas ?? 0),
    files: Number(summary.arquivos ?? 0),
    items: Number(summary.itens ?? 0),
    sizeBytes: Number(summary.tamanho_bytes ?? 0),
    pendingFolders: Number(summary.pastas_pendentes ?? 0),
    sample: (sample ?? []).map((item) => ({
      id: item.google_file_id,
      name: item.nome,
      mimeType: item.mime_type,
      sizeBytes: item.tamanho_bytes == null ? null : Number(item.tamanho_bytes),
      relativePath: item.caminho_relativo,
    })),
  };
}

async function processInventoryPage(
  adminClient: SupabaseClient,
  session: GoogleImportSession,
  accessToken: string,
) {
  const { data: folder, error: folderError } = await adminClient
    .from('biblioteca_google_importacao_itens')
    .select('id,google_file_id,nome,caminho_relativo,scan_page_token')
    .eq('importacao_id', session.id)
    .eq('mime_type', GOOGLE_FOLDER_MIME_TYPE)
    .is('scanned_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (folderError) throw folderError;

  if (!folder) {
    const now = new Date().toISOString();
    const { error } = await adminClient.from('biblioteca_google_importacoes').update({
      status: 'inventory_ready',
      inventory_finished_at: now,
      updated_at: now,
    }).eq('id', session.id);
    if (error) throw error;
    return { done: true, inventory: await inventoryResponse(adminClient, session.id) };
  }

  const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
  listUrl.searchParams.set('q', `'${folder.google_file_id.replaceAll("'", "\\'")}' in parents and trashed = false`);
  listUrl.searchParams.set('pageSize', '1000');
  listUrl.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,modifiedTime)');
  listUrl.searchParams.set('supportsAllDrives', 'true');
  listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
  if (folder.scan_page_token) listUrl.searchParams.set('pageToken', folder.scan_page_token);
  const listing = await googleRequest<{
    nextPageToken?: string;
    files?: Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }>;
  }>(accessToken, listUrl.toString());
  const now = new Date().toISOString();
  const children = listing.files ?? [];
  if (children.length > 0) {
    const { error: itemsError } = await adminClient
      .from('biblioteca_google_importacao_itens')
      .upsert(children.map((item) => ({
        importacao_id: session.id,
        google_file_id: item.id,
        parent_google_file_id: folder.google_file_id,
        nome: item.name,
        mime_type: item.mimeType,
        tamanho_bytes: item.size ?? null,
        modified_time: item.modifiedTime ?? null,
        caminho_relativo: folder.caminho_relativo
          ? `${folder.caminho_relativo}/${item.name}`
          : item.name,
        updated_at: now,
      })), { onConflict: 'importacao_id,google_file_id' });
    if (itemsError) throw itemsError;
  }
  const { error: progressError } = await adminClient
    .from('biblioteca_google_importacao_itens')
    .update(listing.nextPageToken
      ? { scan_page_token: listing.nextPageToken, updated_at: now }
      : { scan_page_token: null, scanned_at: now, updated_at: now })
    .eq('id', folder.id);
  if (progressError) throw progressError;

  const inventory = await inventoryResponse(adminClient, session.id);
  const done = inventory.pendingFolders === 0;
  if (done) {
    const { error } = await adminClient.from('biblioteca_google_importacoes').update({
      status: 'inventory_ready',
      inventory_finished_at: now,
      updated_at: now,
    }).eq('id', session.id);
    if (error) throw error;
  }
  return {
    done,
    processedFolder: folder.nome,
    inventory,
  };
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

async function createDriveFolder(accessToken: string, parentId: string, name: string) {
  return await googleRequest<{ id: string; name: string; webViewLink: string }>(
    accessToken,
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: GOOGLE_FOLDER_MIME_TYPE,
        parents: [parentId],
      }),
    },
  );
}

async function resolveDriveParentId(
  adminClient: SupabaseClient,
  integrationRootId: string,
  pastaId: string | null,
) {
  if (!pastaId) return integrationRootId;
  const { data: folder, error } = await adminClient
    .from('biblioteca_pastas')
    .select('origem,google_managed,google_folder_id')
    .eq('id', pastaId)
    .maybeSingle();
  if (error) throw error;
  if (!folder?.google_managed || folder.origem !== 'google_drive' || !folder.google_folder_id) {
    throw new Response(JSON.stringify({
      error: 'Arquivos do Google só podem ser criados dentro de uma pasta do Google Drive.',
    }), { status: 409 });
  }
  return String(folder.google_folder_id);
}

function googleFileTypeFromMimeType(mimeType: string): 'document' | 'spreadsheet' | 'file' {
  if (mimeType === 'application/vnd.google-apps.document') return 'document';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'spreadsheet';
  return 'file';
}

async function getManagedDriveFolder(adminClient: SupabaseClient, pastaId: string) {
  const { data, error } = await adminClient
    .from('biblioteca_pastas')
    .select('id,nome,google_folder_id,google_managed,origem')
    .eq('id', pastaId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.google_managed || data.origem !== 'google_drive' || !data.google_folder_id) {
    throw new Response(JSON.stringify({
      error: 'Selecione uma pasta vinculada ao Google Drive oficial.',
    }), { status: 409 });
  }
  return data as {
    id: string;
    nome: string;
    google_folder_id: string;
    google_managed: boolean;
    origem: string;
  };
}

async function listDriveFolderItems(accessToken: string, googleFolderId: string) {
  const items: DriveFolderItem[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${googleFolderId.replaceAll("'", "\\'")}' in parents and trashed = false`);
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,webViewLink,parents,trashed)');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const result = await googleRequest<{ nextPageToken?: string; files?: DriveFolderItem[] }>(
      accessToken,
      url.toString(),
    );
    items.push(...(result.files ?? []));
    pageToken = result.nextPageToken;
  } while (pageToken);
  return items;
}

interface ManagedDriveFolderContext {
  libraryFolderId: string;
  googleFolderId: string;
  path: string;
}

async function listManagedDriveFolderTree(
  adminClient: SupabaseClient,
  rootFolder: { id: string; nome: string; google_folder_id: string },
) {
  const contexts: ManagedDriveFolderContext[] = [{
    libraryFolderId: rootFolder.id,
    googleFolderId: rootFolder.google_folder_id,
    path: rootFolder.nome,
  }];
  let frontier = [contexts[0]];
  const maxFolders = 100;

  while (frontier.length > 0) {
    const parentIds = frontier.map((folder) => folder.libraryFolderId);
    const { data: children, error } = await adminClient
      .from('biblioteca_pastas')
      .select('id,nome,parent_id,google_folder_id')
      .in('parent_id', parentIds)
      .eq('google_managed', true)
      .eq('origem', 'google_drive')
      .not('google_folder_id', 'is', null);
    if (error) throw error;

    const parentsById = new Map(frontier.map((folder) => [folder.libraryFolderId, folder]));
    frontier = (children ?? []).map((child) => {
      const parent = parentsById.get(String(child.parent_id));
      return {
        libraryFolderId: String(child.id),
        googleFolderId: String(child.google_folder_id),
        path: parent ? `${parent.path}/${child.nome}` : String(child.nome),
      };
    });
    contexts.push(...frontier);
    if (contexts.length > maxFolders) {
      throw new Error(`A busca foi interrompida porque ultrapassou o limite de ${maxFolders} pastas vinculadas.`);
    }
  }

  return contexts;
}

async function listDriveItemsForManagedTree(
  accessToken: string,
  contexts: ManagedDriveFolderContext[],
) {
  const results: Array<{ context: ManagedDriveFolderContext; items: DriveFolderItem[] }> = [];
  const batchSize = 5;
  for (let offset = 0; offset < contexts.length; offset += batchSize) {
    const batch = contexts.slice(offset, offset + batchSize);
    results.push(...await Promise.all(batch.map(async (context) => ({
      context,
      items: await listDriveFolderItems(accessToken, context.googleFolderId),
    }))));
  }
  return results;
}

async function inspectDriveItemLocation(
  accessToken: string,
  googleFileId: string,
  expectedParentId: string,
) {
  try {
    const item = await googleRequest<DriveFolderItem>(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(googleFileId)}?fields=id,name,mimeType,webViewLink,parents,trashed&supportsAllDrives=true`,
    );
    if (item.trashed) return { status: 'trashed' as const, item };
    if (!item.parents?.includes(expectedParentId)) return { status: 'moved' as const, item };
    return { status: 'present' as const, item };
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 404) {
      return { status: 'not_found' as const, item: null };
    }
    throw error;
  }
}

async function countLibraryFolderDescendants(adminClient: SupabaseClient, folderId: string) {
  const seen = new Set([folderId]);
  let frontier = [folderId];
  let descendantFolders = 0;
  let descendantFiles = 0;
  while (frontier.length > 0) {
    const [{ data: children, error: childrenError }, { count, error: filesError }] = await Promise.all([
      adminClient.from('biblioteca_pastas').select('id').in('parent_id', frontier),
      adminClient.from('biblioteca_arquivos').select('*', { count: 'exact', head: true }).in('pasta_id', frontier),
    ]);
    if (childrenError) throw childrenError;
    if (filesError) throw filesError;
    descendantFiles += count ?? 0;
    const next: string[] = [];
    for (const child of children ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      descendantFolders += 1;
      next.push(child.id);
    }
    frontier = next;
  }
  return { descendantFolders, descendantFiles };
}

async function uploadDriveBlob(
  accessToken: string,
  rootFolderId: string,
  fileName: string,
  sourceMimeType: string,
  source: Blob,
  targetMimeType?: string,
) {
  const boundary = `ejc_copy_${crypto.randomUUID().replaceAll('-', '')}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [rootFolderId],
    ...(targetMimeType ? { mimeType: targetMimeType } : {}),
  });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${sourceMimeType}\r\n\r\n`,
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
  return await response.json() as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
  };
}

const GOOGLE_EXPORTS: Record<string, {
  exportMimeType: string;
  extension: string;
  targetMimeType?: string;
  googleType: 'document' | 'spreadsheet' | 'file';
}> = {
  'application/vnd.google-apps.document': {
    exportMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: '.docx',
    targetMimeType: 'application/vnd.google-apps.document',
    googleType: 'document',
  },
  'application/vnd.google-apps.spreadsheet': {
    exportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
    targetMimeType: 'application/vnd.google-apps.spreadsheet',
    googleType: 'spreadsheet',
  },
  'application/vnd.google-apps.presentation': {
    exportMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: '.pptx',
    targetMimeType: 'application/vnd.google-apps.presentation',
    googleType: 'file',
  },
  'application/vnd.google-apps.drawing': {
    exportMimeType: 'image/png',
    extension: '.png',
    googleType: 'file',
  },
};

async function downloadImportSource(
  accessToken: string,
  item: { google_file_id: string; nome: string; mime_type: string },
) {
  const exportConfig = GOOGLE_EXPORTS[item.mime_type];
  if (item.mime_type.startsWith('application/vnd.google-apps.') && !exportConfig) {
    throw new Error(`O formato Google "${item.mime_type}" não possui exportação automática compatível.`);
  }
  const url = exportConfig
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.google_file_id)}/export?mimeType=${encodeURIComponent(exportConfig.exportMimeType)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.google_file_id)}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw await readGoogleApiError(response);
  const blob = await response.blob();
  if (blob.size <= 0 || blob.size > MAX_GOOGLE_IMPORT_BYTES) {
    throw new Error('O arquivo exportado deve possuir entre 1 byte e 25 MB.');
  }
  return {
    blob,
    uploadName: exportConfig?.targetMimeType ? item.nome : `${item.nome}${exportConfig?.extension ?? ''}`,
    sourceMimeType: exportConfig?.exportMimeType ?? item.mime_type,
    targetMimeType: exportConfig?.targetMimeType,
    googleType: exportConfig?.googleType ?? 'file' as const,
  };
}

async function copyProgress(adminClient: SupabaseClient, sessionId: string) {
  const { data, error } = await adminClient.rpc('biblioteca_google_importacao_copia_resumo', {
    p_importacao_id: sessionId,
  });
  if (error) throw error;
  const row = data?.[0] ?? { pendentes: 0, processando: 0, copiados: 0, erros: 0, ignorados: 0 };
  return {
    pending: Number(row.pendentes ?? 0),
    processing: Number(row.processando ?? 0),
    copied: Number(row.copiados ?? 0),
    errors: Number(row.erros ?? 0),
    skipped: Number(row.ignorados ?? 0),
  };
}

async function createUniqueLibraryRootFolder(
  adminClient: SupabaseClient,
  accessToken: string,
  integrationRootId: string,
  sourceName: string,
) {
  const baseName = sourceName.trim().slice(0, 180) || 'Acervo importado';
  const { data: existing, error: existingError } = await adminClient
    .from('biblioteca_pastas')
    .select('nome')
    .is('parent_id', null)
    .ilike('nome', `${baseName.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
  if (existingError) throw existingError;
  const names = new Set((existing ?? []).map((folder) => String(folder.nome).toLocaleLowerCase('pt-BR')));
  let name = baseName;
  let suffix = 2;
  while (names.has(name.toLocaleLowerCase('pt-BR'))) {
    name = `${baseName} (${suffix})`;
    suffix += 1;
  }
  const driveFolder = await createDriveFolder(accessToken, integrationRootId, name);
  const { data, error } = await adminClient
    .from('biblioteca_pastas')
    .insert({
      nome: driveFolder.name,
      parent_id: null,
      origem: 'google_drive',
      google_folder_id: driveFolder.id,
      url_externa: driveFolder.webViewLink,
      google_managed: true,
    })
    .select('id,nome,google_folder_id')
    .single();
  if (error) {
    try {
      await updateGoogleFile(accessToken, driveFolder.id, { trashed: true });
    } catch {
      // A falha original do banco continua sendo a relevante.
    }
    throw error;
  }
  return data as { id: string; nome: string; google_folder_id: string };
}

async function finalizeCopyIfDone(
  adminClient: SupabaseClient,
  session: GoogleImportSession,
) {
  const progress = await copyProgress(adminClient, session.id);
  if (progress.pending > 0 || progress.processing > 0) return { done: false, progress };
  const now = new Date().toISOString();
  const status = progress.errors > 0 ? 'completed_with_errors' : 'completed';
  const { error } = await adminClient.from('biblioteca_google_importacoes').update({
    status,
    copy_finished_at: now,
    updated_at: now,
    ...(status === 'completed' ? { refresh_token_ciphertext: null } : {}),
  }).eq('id', session.id);
  if (error) throw error;
  if (status === 'completed' && session.refresh_token_ciphertext) {
    await revokeGoogleRefreshToken(session.refresh_token_ciphertext);
  }
  return { done: true, progress, status };
}

async function processCopyItem(
  adminClient: SupabaseClient,
  session: GoogleImportSession,
) {
  const staleLock = new Date(Date.now() - 10 * 60_000).toISOString();
  await adminClient.from('biblioteca_google_importacao_itens').update({
    copy_status: 'pending',
    copy_locked_at: null,
    updated_at: new Date().toISOString(),
  }).eq('importacao_id', session.id).eq('copy_status', 'processing').lt('copy_locked_at', staleLock);

  let { data: item, error: itemError } = await adminClient
    .from('biblioteca_google_importacao_itens')
    .select('id,google_file_id,parent_google_file_id,nome,mime_type,tamanho_bytes,caminho_relativo,copy_attempts')
    .eq('importacao_id', session.id)
    .eq('copy_status', 'pending')
    .eq('mime_type', GOOGLE_FOLDER_MIME_TYPE)
    .not('parent_google_file_id', 'is', null)
    .order('caminho_relativo', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) {
    const result = await adminClient
      .from('biblioteca_google_importacao_itens')
      .select('id,google_file_id,parent_google_file_id,nome,mime_type,tamanho_bytes,caminho_relativo,copy_attempts')
      .eq('importacao_id', session.id)
      .eq('copy_status', 'pending')
      .neq('mime_type', GOOGLE_FOLDER_MIME_TYPE)
      .order('caminho_relativo', { ascending: true })
      .limit(1)
      .maybeSingle();
    item = result.data;
    itemError = result.error;
  }
  if (itemError) throw itemError;
  if (!item) return await finalizeCopyIfDone(adminClient, session);

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await adminClient
    .from('biblioteca_google_importacao_itens')
    .update({
      copy_status: 'processing',
      copy_attempts: Number(item.copy_attempts ?? 0) + 1,
      copy_locked_at: now,
      copy_last_error: null,
      updated_at: now,
    })
    .eq('id', item.id)
    .eq('copy_status', 'pending')
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { done: false, progress: await copyProgress(adminClient, session.id) };

  try {
    const { data: parent, error: parentError } = await adminClient
      .from('biblioteca_google_importacao_itens')
      .select('biblioteca_pasta_id')
      .eq('importacao_id', session.id)
      .eq('google_file_id', item.parent_google_file_id)
      .single();
    if (parentError) throw parentError;
    if (!parent?.biblioteca_pasta_id) throw new Error('A pasta de destino do item ainda não foi criada.');
    const { data: parentFolder, error: parentFolderError } = await adminClient
      .from('biblioteca_pastas')
      .select('google_folder_id,google_managed')
      .eq('id', parent.biblioteca_pasta_id)
      .single();
    if (parentFolderError) throw parentFolderError;
    if (!parentFolder.google_managed || !parentFolder.google_folder_id) {
      throw new Error('A pasta de destino não está vinculada ao Google Drive oficial.');
    }

    if (item.mime_type === GOOGLE_FOLDER_MIME_TYPE) {
      const { accessToken: destinationToken } = await integrationAccessToken(adminClient);
      const driveFolder = await createDriveFolder(destinationToken, parentFolder.google_folder_id, item.nome);
      const { data: folder, error: folderError } = await adminClient
        .from('biblioteca_pastas')
        .insert({
          nome: driveFolder.name,
          parent_id: parent.biblioteca_pasta_id,
          origem: 'google_drive',
          google_folder_id: driveFolder.id,
          url_externa: driveFolder.webViewLink,
          google_managed: true,
        })
        .select('id')
        .single();
      if (folderError) {
        try {
          await updateGoogleFile(destinationToken, driveFolder.id, { trashed: true });
        } catch {
          // A falha original do banco continua sendo a relevante.
        }
        throw folderError;
      }
      const { error: completeError } = await adminClient
        .from('biblioteca_google_importacao_itens')
        .update({
          copy_status: 'copied',
          biblioteca_pasta_id: folder.id,
          copy_locked_at: null,
          copied_at: now,
          updated_at: now,
        })
        .eq('id', item.id);
      if (completeError) throw completeError;
    } else {
      if (!session.refresh_token_ciphertext) throw new Error('A conexão temporária expirou.');
      const [{ accessToken: destinationToken }, sourceToken] = await Promise.all([
        integrationAccessToken(adminClient),
        refreshAccessToken(await decryptToken(session.refresh_token_ciphertext)),
      ]);
      const source = await downloadImportSource(sourceToken, item);
      const driveFile = await uploadDriveBlob(
        destinationToken,
        parentFolder.google_folder_id,
        source.uploadName,
        source.sourceMimeType,
        source.blob,
        source.targetMimeType,
      );
      const { data: libraryFile, error: fileError } = await adminClient
        .from('biblioteca_arquivos')
        .insert({
          nome_exibicao: driveFile.name,
          pasta_id: parent.biblioteca_pasta_id,
          storage_path: null,
          tamanho_bytes: source.blob.size,
          tipo_mime: driveFile.mimeType,
          origem: 'google_drive',
          google_file_id: driveFile.id,
          google_tipo: source.googleType,
          url_externa: driveFile.webViewLink,
          google_managed: true,
          google_sync_status: 'pending',
        })
        .select('id')
        .single();
      if (fileError) {
        try {
          await googleRequest<void>(destinationToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFile.id)}`, { method: 'DELETE' });
        } catch {
          // A falha original de persistência é mantida.
        }
        throw fileError;
      }
      const { error: completeError } = await adminClient
        .from('biblioteca_google_importacao_itens')
        .update({
          copy_status: 'copied',
          biblioteca_arquivo_id: libraryFile.id,
          copy_locked_at: null,
          copied_at: now,
          updated_at: now,
        })
        .eq('id', item.id);
      if (completeError) throw completeError;

      try {
        await syncGoogleFile(adminClient, destinationToken, libraryFile.id);
      } catch (syncError) {
        const syncMessage = syncError instanceof Error
          ? syncError.message
          : 'Falha inesperada ao sincronizar as permissões.';
        await Promise.all([
          adminClient.from('biblioteca_google_sync_fila').upsert({
            arquivo_id: libraryFile.id,
            status: 'error',
            attempts: 1,
            next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
            last_error: syncMessage,
            locked_at: null,
          }),
          adminClient.from('biblioteca_arquivos').update({
            google_sync_status: 'error',
            google_sync_error: syncMessage,
          }).eq('id', libraryFile.id),
        ]);
      }
    }
    return {
      done: false,
      copiedItem: item.caminho_relativo,
      progress: await copyProgress(adminClient, session.id),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada ao copiar o item.';
    await adminClient.from('biblioteca_google_importacao_itens').update({
      copy_status: 'error',
      copy_last_error: message.slice(0, 1000),
      copy_locked_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    return {
      done: false,
      failedItem: item.caminho_relativo,
      error: message,
      progress: await copyProgress(adminClient, session.id),
    };
  }
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
  await reconcileImportedDriveFolders(adminClient, accessToken, integration.drive_root_folder_id, 25);
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

async function moveGoogleFileToFolder(accessToken: string, fileId: string, targetFolderId: string) {
  const current = await googleRequest<{ parents?: string[] }>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents`,
  );
  if (current.parents?.includes(targetFolderId)) return;
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('addParents', targetFolderId);
  if (current.parents?.length) url.searchParams.set('removeParents', current.parents.join(','));
  url.searchParams.set('fields', 'id,parents');
  await googleRequest(accessToken, url.toString(), { method: 'PATCH', body: JSON.stringify({}) });
}

async function reconcileImportedDriveFolders(
  adminClient: SupabaseClient,
  accessToken: string,
  integrationRootId: string,
  limit: number,
) {
  const { data: imports, error: importsError } = await adminClient
    .from('biblioteca_google_importacoes')
    .select('destination_root_folder_id')
    .not('destination_root_folder_id', 'is', null)
    .in('status', ['completed', 'completed_with_errors']);
  if (importsError) throw importsError;
  let processed = 0;

  for (const imported of imports ?? []) {
    if (processed >= limit) break;
    const rootId = String(imported.destination_root_folder_id);
    const queue: Array<{ id: string; driveParentId: string }> = [{ id: rootId, driveParentId: integrationRootId }];
    while (queue.length > 0 && processed < limit) {
      const current = queue.shift()!;
      const { data: folder, error: folderError } = await adminClient
        .from('biblioteca_pastas')
        .select('id,nome,google_managed,google_folder_id')
        .eq('id', current.id)
        .maybeSingle();
      if (folderError) throw folderError;
      if (!folder) continue;

      let driveFolderId = folder.google_folder_id as string | null;
      if (!folder.google_managed || !driveFolderId) {
        const driveFolder = await createDriveFolder(accessToken, current.driveParentId, folder.nome);
        const { error: updateError } = await adminClient.from('biblioteca_pastas').update({
          origem: 'google_drive',
          google_folder_id: driveFolder.id,
          url_externa: driveFolder.webViewLink,
          google_managed: true,
        }).eq('id', folder.id);
        if (updateError) throw updateError;
        driveFolderId = driveFolder.id;
        processed += 1;
      }

      const [{ data: children, error: childrenError }, { data: files, error: filesError }] = await Promise.all([
        adminClient.from('biblioteca_pastas').select('id').eq('parent_id', folder.id),
        adminClient.from('biblioteca_arquivos').select('google_file_id').eq('pasta_id', folder.id).eq('google_managed', true),
      ]);
      if (childrenError) throw childrenError;
      if (filesError) throw filesError;
      for (const file of files ?? []) {
        if (file.google_file_id) await moveGoogleFileToFolder(accessToken, file.google_file_id, driveFolderId);
      }
      for (const child of children ?? []) queue.push({ id: child.id, driveParentId: driveFolderId });
    }
  }
  return { processed };
}

interface RecursiveDeleteFile {
  id: string;
  nome_exibicao: string;
  origem: string;
  storage_path: string | null;
  google_file_id: string | null;
  google_managed: boolean;
}

async function deleteLibraryItemsRecursively(
  adminClient: SupabaseClient,
  folderIds: string[],
  fileIds: string[],
  removeFromSources = true,
) {
  const folderDepth = new Map(folderIds.map((id) => [id, 0]));
  const files = new Map<string, RecursiveDeleteFile>();
  let frontier = [...folderDepth.keys()];

  if (fileIds.length > 0) {
    const { data, error } = await adminClient
      .from('biblioteca_arquivos')
      .select('id,nome_exibicao,origem,storage_path,google_file_id,google_managed')
      .in('id', fileIds);
    if (error) throw error;
    for (const file of data ?? []) files.set(file.id, file as RecursiveDeleteFile);
  }

  while (frontier.length > 0) {
    const currentDepth = Math.max(...frontier.map((id) => folderDepth.get(id) ?? 0));
    const [{ data: children, error: childrenError }, { data: childFiles, error: filesError }] = await Promise.all([
      adminClient.from('biblioteca_pastas').select('id,parent_id').in('parent_id', frontier),
      adminClient
        .from('biblioteca_arquivos')
        .select('id,nome_exibicao,origem,storage_path,google_file_id,google_managed')
        .in('pasta_id', frontier),
    ]);
    if (childrenError) throw childrenError;
    if (filesError) throw filesError;
    for (const file of childFiles ?? []) files.set(file.id, file as RecursiveDeleteFile);

    const nextFrontier: string[] = [];
    for (const child of children ?? []) {
      if (folderDepth.has(child.id)) continue;
      folderDepth.set(child.id, currentDepth + 1);
      nextFrontier.push(child.id);
    }
    if (folderDepth.size + files.size > 1000) {
      throw new Response(JSON.stringify({
        error: 'A seleção possui mais de 1.000 itens. Divida a exclusão em partes menores.',
      }), { status: 413 });
    }
    frontier = nextFrontier;
  }

  const errors: Array<{ id: string; name: string; message: string }> = [];
  let deletedFiles = 0;
  let deletedFolders = 0;
  const managedFiles = [...files.values()].filter((file) => file.google_managed && file.google_file_id);
  const destinationAccess = removeFromSources && managedFiles.length > 0
    ? await integrationAccessToken(adminClient)
    : null;

  for (const file of files.values()) {
    try {
      if (removeFromSources && file.google_managed && file.google_file_id && destinationAccess) {
        await updateGoogleFile(destinationAccess.accessToken, file.google_file_id, { trashed: true });
      } else if (removeFromSources && file.origem !== 'google_drive' && file.storage_path) {
        const { error: storageError } = await adminClient.storage.from('biblioteca').remove([file.storage_path]);
        if (storageError) throw storageError;
      }

      const { error: deleteError } = await adminClient.from('biblioteca_arquivos').delete().eq('id', file.id);
      if (deleteError) {
        if (removeFromSources && file.google_managed && file.google_file_id && destinationAccess) {
          try {
            await updateGoogleFile(destinationAccess.accessToken, file.google_file_id, { trashed: false });
          } catch {
            // A falha original do banco continua sendo a relevante.
          }
        }
        throw deleteError;
      }
      deletedFiles += 1;
    } catch (error) {
      errors.push({
        id: file.id,
        name: file.nome_exibicao,
        message: error instanceof Error ? error.message : 'Falha ao excluir o arquivo.',
      });
    }
  }

  let pendingFolders = [...folderDepth.entries()].sort((left, right) => right[1] - left[1]);
  let lastFolderErrors = new Map<string, string>();
  while (pendingFolders.length > 0) {
    let deletedInPass = 0;
    const nextPending: typeof pendingFolders = [];
    lastFolderErrors = new Map();
    for (const entry of pendingFolders) {
      const [folderId] = entry;
      const { data: folderMetadata, error: metadataError } = await adminClient
        .from('biblioteca_pastas')
        .select('google_managed,google_folder_id')
        .eq('id', folderId)
        .maybeSingle();
      if (metadataError) {
        nextPending.push(entry);
        lastFolderErrors.set(folderId, metadataError.message);
        continue;
      }
      let trashedGoogleFolder = false;
      if (removeFromSources && folderMetadata?.google_managed && folderMetadata.google_folder_id) {
        try {
          const access = destinationAccess ?? await integrationAccessToken(adminClient);
          await updateGoogleFile(access.accessToken, folderMetadata.google_folder_id, { trashed: true });
          trashedGoogleFolder = true;
        } catch (error) {
          nextPending.push(entry);
          lastFolderErrors.set(folderId, error instanceof Error ? error.message : 'Falha ao mover a pasta para a lixeira do Drive.');
          continue;
        }
      }
      const { data: folder, error: folderError } = await adminClient
        .from('biblioteca_pastas')
        .delete()
        .eq('id', folderId)
        .select('nome')
        .maybeSingle();
      if (folderError) {
        if (trashedGoogleFolder && folderMetadata?.google_folder_id) {
          try {
            const access = destinationAccess ?? await integrationAccessToken(adminClient);
            await updateGoogleFile(access.accessToken, folderMetadata.google_folder_id, { trashed: false });
          } catch {
            // A falha original do banco continua sendo a relevante.
          }
        }
        nextPending.push(entry);
        lastFolderErrors.set(folderId, folderError.message);
      } else if (folder) {
        deletedFolders += 1;
        deletedInPass += 1;
      }
    }
    pendingFolders = nextPending;
    if (deletedInPass === 0) break;
  }
  for (const [folderId] of pendingFolders) {
    errors.push({
      id: folderId,
      name: 'Pasta',
      message: lastFolderErrors.get(folderId) ?? 'A pasta ainda contém itens que não puderam ser excluídos.',
    });
  }

  return { deletedFiles, deletedFolders, errors };
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
    if (state) {
      const { data: deniedState } = await adminClient
        .from('biblioteca_google_oauth_state')
        .select('purpose')
        .eq('state_hash', await sha256(state))
        .maybeSingle();
      if (deniedState?.purpose === 'import') {
        const importUrl = new URL('/biblioteca/importar-drive', requiredEnv('PUBLIC_APP_URL'));
        importUrl.searchParams.set('google_import', 'denied');
        return Response.redirect(importUrl.toString(), 302);
      }
    }
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
  // Mantém o OAuth institucional compatível durante a janela entre o deploy
  // da função e a aplicação da migration que adiciona esses campos.
  const { data: importState } = await adminClient
    .from('biblioteca_google_oauth_state')
    .select('purpose, importacao_id')
    .eq('state_hash', stateHash)
    .maybeSingle();

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

  if (importState?.purpose === 'import' && importState.importacao_id) {
    const now = new Date().toISOString();
    const { error: importError } = await adminClient
      .from('biblioteca_google_importacoes')
      .update({
        source_account_email: userInfo.email.toLowerCase(),
        refresh_token_ciphertext: await encryptToken(tokens.refresh_token),
        status: 'connected',
        expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        updated_at: now,
        last_error: null,
      })
      .eq('id', importState.importacao_id)
      .eq('requested_by', storedState.requested_by);
    if (importError) throw importError;
    await adminClient.from('biblioteca_google_oauth_state')
      .update({ used_at: now })
      .eq('state_hash', stateHash);
    const importUrl = new URL('/biblioteca/importar-drive', requiredEnv('PUBLIC_APP_URL'));
    importUrl.searchParams.set('google_import', 'connected');
    return Response.redirect(importUrl.toString(), 302);
  }

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

    const adminOnlyActions = new Set([
      'start-import-oauth',
      'import-status',
      'import-picker-token',
      'inspect-import-folder',
      'process-import-inventory',
      'confirm-import-inventory',
      'start-import-copy',
      'process-import-copy',
      'retry-import-errors',
      'revoke-import-source',
    ]);
    if (adminOnlyActions.has(action)) {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      await requireSystemAdmin(request, supabaseUrl, anonKey, user.id);
    }

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
        'https://www.googleapis.com/auth/drive',
      ].join(' '));
      authorizationUrl.searchParams.set('access_type', 'offline');
      authorizationUrl.searchParams.set('include_granted_scopes', 'true');
      authorizationUrl.searchParams.set('prompt', 'consent');
      authorizationUrl.searchParams.set('state', state);
      return jsonResponse(200, { authorizationUrl: authorizationUrl.toString() });
    }

    if (action === 'start-import-oauth') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const activeSession = await getActiveImportSession(adminClient, user.id);
      if (activeSession) {
        if (activeSession.refresh_token_ciphertext) {
          await revokeGoogleRefreshToken(activeSession.refresh_token_ciphertext);
        }
        await adminClient.from('biblioteca_google_importacoes').update({
          status: 'revoked',
          refresh_token_ciphertext: null,
          updated_at: new Date().toISOString(),
        }).eq('id', activeSession.id);
      }
      const { data: importSession, error: importError } = await adminClient
        .from('biblioteca_google_importacoes')
        .insert({ requested_by: user.id, status: 'connecting' })
        .select('id')
        .single();
      if (importError) throw importError;

      const state = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
        .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      const { error: stateError } = await adminClient.from('biblioteca_google_oauth_state').insert({
        state_hash: await sha256(state),
        requested_by: user.id,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        purpose: 'import',
        importacao_id: importSession.id,
      });
      if (stateError) throw stateError;

      const redirectUri = `${supabaseUrl}/functions/v1/google-drive/callback`;
      const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorizationUrl.searchParams.set('client_id', requiredEnv('GOOGLE_DRIVE_CLIENT_ID'));
      authorizationUrl.searchParams.set('redirect_uri', redirectUri);
      authorizationUrl.searchParams.set('response_type', 'code');
      authorizationUrl.searchParams.set('scope', [
        'openid',
        'email',
        'https://www.googleapis.com/auth/drive.readonly',
      ].join(' '));
      authorizationUrl.searchParams.set('access_type', 'offline');
      authorizationUrl.searchParams.set('include_granted_scopes', 'true');
      authorizationUrl.searchParams.set('prompt', 'consent select_account');
      authorizationUrl.searchParams.set('state', state);
      return jsonResponse(200, { authorizationUrl: authorizationUrl.toString() });
    }

    if (action === 'import-status') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const session = await getActiveImportSession(adminClient, user.id);
      return jsonResponse(200, {
        connected: Boolean(session?.refresh_token_ciphertext),
        accountEmail: session?.source_account_email ?? null,
        selectedFolderId: session?.selected_folder_id ?? null,
        selectedFolderName: session?.selected_folder_name ?? null,
        status: session?.status ?? null,
        expiresAt: session?.expires_at ?? null,
      });
    }

    if (action === 'import-picker-token') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const session = await getActiveImportSession(adminClient, user.id);
      if (!session?.refresh_token_ciphertext) {
        return jsonResponse(409, { error: 'Conecte a conta de origem antes de selecionar uma pasta.' });
      }
      const accessToken = await refreshAccessToken(await decryptToken(session.refresh_token_ciphertext));
      return jsonResponse(200, {
        accessToken,
        developerKey: requiredEnv('GOOGLE_PICKER_API_KEY'),
        appId: requiredEnv('GOOGLE_PICKER_APP_ID'),
      });
    }

    if (action === 'inspect-import-folder') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const folderId = String(body.folderId ?? '').trim();
      if (!folderId) return jsonResponse(400, { error: 'Selecione uma pasta do Google Drive.' });
      const session = await getActiveImportSession(adminClient, user.id);
      if (!session?.refresh_token_ciphertext) {
        return jsonResponse(409, { error: 'A conexão temporária não está disponível.' });
      }
      const accessToken = await refreshAccessToken(await decryptToken(session.refresh_token_ciphertext));
      const folder = await googleRequest<{ id: string; name: string; mimeType: string }>(
        accessToken,
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
      );
      if (folder.mimeType !== 'application/vnd.google-apps.folder') {
        return jsonResponse(400, { error: 'O item selecionado não é uma pasta.' });
      }
      const now = new Date().toISOString();
      const { error: clearError } = await adminClient
        .from('biblioteca_google_importacao_itens')
        .delete()
        .eq('importacao_id', session.id);
      if (clearError) throw clearError;
      const { error: rootError } = await adminClient
        .from('biblioteca_google_importacao_itens')
        .insert({
          importacao_id: session.id,
          google_file_id: folder.id,
          parent_google_file_id: null,
          nome: folder.name,
          mime_type: GOOGLE_FOLDER_MIME_TYPE,
          caminho_relativo: '',
        });
      if (rootError) throw rootError;
      const { error: sessionError } = await adminClient.from('biblioteca_google_importacoes').update({
        selected_folder_id: folder.id,
        selected_folder_name: folder.name,
        status: 'inventory_scanning',
        inventory_started_at: now,
        inventory_finished_at: null,
        inventory_confirmed_at: null,
        updated_at: now,
        last_error: null,
      }).eq('id', session.id);
      if (sessionError) throw sessionError;
      const result = await processInventoryPage(adminClient, session, accessToken);
      return jsonResponse(200, {
        folder: { id: folder.id, name: folder.name },
        ...result,
      });
    }

    if (action === 'process-import-inventory') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const session = await getActiveImportSession(adminClient, user.id);
      if (!session?.refresh_token_ciphertext || !session.selected_folder_id) {
        return jsonResponse(409, { error: 'Selecione uma pasta antes de iniciar o inventário.' });
      }
      if (session.status === 'inventory_ready' || session.status === 'inventory_confirmed') {
        return jsonResponse(200, {
          done: true,
          inventory: await inventoryResponse(adminClient, session.id),
        });
      }
      const accessToken = await refreshAccessToken(await decryptToken(session.refresh_token_ciphertext));
      return jsonResponse(200, await processInventoryPage(adminClient, session, accessToken));
    }

    if (action === 'confirm-import-inventory') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const session = await getActiveImportSession(adminClient, user.id);
      if (!session || !['inventory_ready', 'inventory_confirmed'].includes(session.status)) {
        return jsonResponse(409, { error: 'Conclua o inventário antes de confirmar a pasta.' });
      }
      if (session.status !== 'inventory_confirmed') {
        const now = new Date().toISOString();
        const { error } = await adminClient.from('biblioteca_google_importacoes').update({
          status: 'inventory_confirmed',
          inventory_confirmed_at: now,
          updated_at: now,
        }).eq('id', session.id);
        if (error) throw error;
      }
      return jsonResponse(200, {
        confirmed: true,
        inventory: await inventoryResponse(adminClient, session.id),
      });
    }

    if (action === 'start-import-copy') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const session = await getActiveImportSession(adminClient, user.id);
      if (!session || !['inventory_confirmed', 'copying'].includes(session.status)) {
        return jsonResponse(409, { error: 'Confirme o inventário antes de iniciar a cópia.' });
      }
      if (session.status === 'copying') {
        return jsonResponse(200, { started: true, progress: await copyProgress(adminClient, session.id) });
      }
      if (!session.selected_folder_name || !session.refresh_token_ciphertext) {
        return jsonResponse(409, { error: 'A pasta ou a conexão de origem não está disponível.' });
      }
      const { integration, accessToken } = await integrationAccessToken(adminClient);
      const destination = await createUniqueLibraryRootFolder(
        adminClient,
        accessToken,
        integration.drive_root_folder_id,
        session.selected_folder_name,
      );
      const now = new Date().toISOString();
      const { error: rootError } = await adminClient
        .from('biblioteca_google_importacao_itens')
        .update({
          copy_status: 'copied',
          biblioteca_pasta_id: destination.id,
          copied_at: now,
          updated_at: now,
        })
        .eq('importacao_id', session.id)
        .is('parent_google_file_id', null);
      if (rootError) throw rootError;
      const { error: sessionError } = await adminClient.from('biblioteca_google_importacoes').update({
        status: 'copying',
        destination_root_folder_id: destination.id,
        copy_started_at: now,
        copy_finished_at: null,
        updated_at: now,
      }).eq('id', session.id);
      if (sessionError) throw sessionError;
      return jsonResponse(200, {
        started: true,
        destination,
        progress: await copyProgress(adminClient, session.id),
      });
    }

    if (action === 'process-import-copy') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const session = await getActiveImportSession(adminClient, user.id);
      if (!session || !['copying', 'completed', 'completed_with_errors'].includes(session.status)) {
        return jsonResponse(409, { error: 'A cópia ainda não foi iniciada.' });
      }
      if (session.status !== 'copying') {
        return jsonResponse(200, {
          done: true,
          status: session.status,
          progress: await copyProgress(adminClient, session.id),
        });
      }
      return jsonResponse(200, await processCopyItem(adminClient, session));
    }

    if (action === 'retry-import-errors') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const session = await getActiveImportSession(adminClient, user.id);
      if (!session || session.status !== 'completed_with_errors' || !session.refresh_token_ciphertext) {
        return jsonResponse(409, { error: 'Não há erros disponíveis para nova tentativa.' });
      }
      const now = new Date().toISOString();
      const { error: resetError } = await adminClient.from('biblioteca_google_importacao_itens').update({
        copy_status: 'pending',
        copy_last_error: null,
        updated_at: now,
      }).eq('importacao_id', session.id).eq('copy_status', 'error').lt('copy_attempts', 3);
      if (resetError) throw resetError;
      const { error: sessionError } = await adminClient.from('biblioteca_google_importacoes').update({
        status: 'copying',
        copy_finished_at: null,
        updated_at: now,
      }).eq('id', session.id);
      if (sessionError) throw sessionError;
      return jsonResponse(200, { retried: true, progress: await copyProgress(adminClient, session.id) });
    }

    if (action === 'revoke-import-source') {
      if (!user) return jsonResponse(401, { error: 'Autenticação necessária.' });
      const session = await getActiveImportSession(adminClient, user.id);
      if (session) {
        if (session.refresh_token_ciphertext) {
          await revokeGoogleRefreshToken(session.refresh_token_ciphertext);
        }
        await adminClient.from('biblioteca_google_importacoes').update({
          status: 'revoked',
          refresh_token_ciphertext: null,
          updated_at: new Date().toISOString(),
        }).eq('id', session.id);
      }
      return jsonResponse(200, { revoked: true });
    }

    if (action === 'adopt-existing-file') {
      const fileId = String(body.fileId ?? '').trim();
      const pastaId = typeof body.pastaId === 'string' && body.pastaId ? body.pastaId : null;
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
      if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) {
        return jsonResponse(400, { error: 'O link não contém um identificador válido do Google Drive.' });
      }
      if (displayName.length > 200) {
        return jsonResponse(400, { error: 'O nome exibido deve possuir até 200 caracteres.' });
      }
      const { accessToken } = await integrationAccessToken(adminClient);
      const targetFolder = pastaId ? await getManagedDriveFolder(adminClient, pastaId) : null;
      const driveFile = await googleRequest<DriveFolderItem>(
        accessToken,
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,webViewLink,parents,trashed&supportsAllDrives=true`,
      );
      if (driveFile.trashed) return jsonResponse(409, { error: 'O arquivo está na lixeira do Google Drive.' });
      if (driveFile.mimeType === GOOGLE_FOLDER_MIME_TYPE) {
        return jsonResponse(400, { error: 'Use a busca de novidades para adicionar uma pasta do Google Drive.' });
      }
      if (targetFolder && !driveFile.parents?.includes(targetFolder.google_folder_id)) {
        return jsonResponse(409, {
          error: 'Este arquivo não pertence à pasta atual no Google Drive. Mova-o no Drive ou vincule-o na pasta correta.',
        });
      }
      const { data: existing, error: existingError } = await adminClient
        .from('biblioteca_arquivos')
        .select('id')
        .eq('google_file_id', driveFile.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return jsonResponse(409, { error: 'Este arquivo do Google já está cadastrado na Biblioteca.' });

      const { data: libraryFile, error: insertError } = await adminClient
        .from('biblioteca_arquivos')
        .insert({
          nome_exibicao: displayName || driveFile.name,
          pasta_id: pastaId,
          storage_path: null,
          tamanho_bytes: Number(driveFile.size ?? 0),
          tipo_mime: driveFile.mimeType,
          origem: 'google_drive',
          google_file_id: driveFile.id,
          google_tipo: googleFileTypeFromMimeType(driveFile.mimeType),
          url_externa: driveFile.webViewLink ?? `https://drive.google.com/open?id=${driveFile.id}`,
          google_managed: true,
          google_sync_status: 'pending',
        })
        .select('*')
        .single();
      if (insertError) throw insertError;

      let syncErrors: string[] = [];
      try {
        syncErrors = (await syncGoogleFile(adminClient, accessToken, libraryFile.id)).errors;
      } catch (error) {
        syncErrors = [errorMessage(error, 'Falha ao sincronizar permissões.')];
      }
      const { data: refreshedFile } = await adminClient
        .from('biblioteca_arquivos')
        .select('*')
        .eq('id', libraryFile.id)
        .single();
      return jsonResponse(201, { file: refreshedFile ?? libraryFile, syncErrors });
    }

    if (action === 'scan-folder-differences') {
      const pastaId = String(body.pastaId ?? '').trim();
      const showIgnored = body.showIgnored === true;
      if (!pastaId) return jsonResponse(400, { error: 'Informe a pasta da Biblioteca.' });
      const folder = await getManagedDriveFolder(adminClient, pastaId);
      const { accessToken } = await integrationAccessToken(adminClient);
      const folderTree = await listManagedDriveFolderTree(adminClient, folder);
      const driveFolders = await listDriveItemsForManagedTree(accessToken, folderTree);
      const libraryFolderIds = folderTree.map((item) => item.libraryFolderId);
      const [
        { data: libraryFolders, error: foldersError },
        { data: libraryFiles, error: filesError },
        { data: ignoredItems, error: ignoredError },
      ] = await Promise.all([
        adminClient.from('biblioteca_pastas').select('id,nome,parent_id,google_folder_id,url_externa').in('parent_id', libraryFolderIds).eq('google_managed', true),
        adminClient.from('biblioteca_arquivos').select('id,nome_exibicao,pasta_id,google_file_id,url_externa').in('pasta_id', libraryFolderIds).eq('google_managed', true),
        adminClient.from('biblioteca_google_itens_ignorados').select('pasta_id,google_file_id').in('pasta_id', libraryFolderIds),
      ]);
      if (foldersError) throw foldersError;
      if (filesError) throw filesError;
      if (ignoredError) throw ignoredError;
      const knownFolderIds = new Set((libraryFolders ?? []).map((item) => item.google_folder_id).filter(Boolean));
      const knownFileIds = new Set((libraryFiles ?? []).map((item) => item.google_file_id).filter(Boolean));
      const ignoredIds = new Set((ignoredItems ?? []).map((item) => item.google_file_id).filter(Boolean));
      const items = driveFolders.flatMap(({ context, items: driveItems }) => driveItems
        .filter((item) => item.mimeType === GOOGLE_FOLDER_MIME_TYPE
          ? !knownFolderIds.has(item.id)
          : !knownFileIds.has(item.id))
        .filter((item) => showIgnored || !ignoredIds.has(item.id))
        .map((item) => ({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          itemType: item.mimeType === GOOGLE_FOLDER_MIME_TYPE ? 'folder' : 'file',
          sizeBytes: Number(item.size ?? 0),
          ignored: ignoredIds.has(item.id),
          targetFolderId: context.libraryFolderId,
          path: context.path,
        })));
      if (items.length > 200) {
        return jsonResponse(409, { error: 'Foram encontrados mais de 200 itens novos. Execute a busca em uma subpasta específica.' });
      }
      const contextByLibraryId = new Map(folderTree.map((item) => [item.libraryFolderId, item]));
      const driveChildIdsByFolder = new Map(driveFolders.map(({ context, items: driveItems }) => [
        context.libraryFolderId,
        new Set(driveItems.map((item) => item.id)),
      ]));
      const missingItems: Array<{
        libraryId: string;
        name: string;
        itemType: 'folder' | 'file';
        status: 'trashed' | 'moved' | 'not_found';
        url: string | null;
        descendantFolders: number;
        descendantFiles: number;
        path: string;
      }> = [];
      for (const libraryFolder of libraryFolders ?? []) {
        const parentContext = contextByLibraryId.get(String(libraryFolder.parent_id));
        if (!parentContext || !libraryFolder.google_folder_id || driveChildIdsByFolder.get(parentContext.libraryFolderId)?.has(libraryFolder.google_folder_id)) continue;
        const location = await inspectDriveItemLocation(accessToken, libraryFolder.google_folder_id, parentContext.googleFolderId);
        if (location.status === 'present') continue;
        const descendants = await countLibraryFolderDescendants(adminClient, libraryFolder.id);
        missingItems.push({
          libraryId: libraryFolder.id,
          name: libraryFolder.nome,
          itemType: 'folder',
          status: location.status,
          url: location.item?.webViewLink ?? libraryFolder.url_externa ?? null,
          ...descendants,
          path: parentContext.path,
        });
      }
      for (const libraryFile of libraryFiles ?? []) {
        const parentContext = contextByLibraryId.get(String(libraryFile.pasta_id));
        if (!parentContext || !libraryFile.google_file_id || driveChildIdsByFolder.get(parentContext.libraryFolderId)?.has(libraryFile.google_file_id)) continue;
        const location = await inspectDriveItemLocation(accessToken, libraryFile.google_file_id, parentContext.googleFolderId);
        if (location.status === 'present') continue;
        missingItems.push({
          libraryId: libraryFile.id,
          name: libraryFile.nome_exibicao,
          itemType: 'file',
          status: location.status,
          url: location.item?.webViewLink ?? libraryFile.url_externa ?? null,
          descendantFolders: 0,
          descendantFiles: 0,
          path: parentContext.path,
        });
      }
      return jsonResponse(200, { items, missingItems });
    }

    if (action === 'import-folder-items') {
      const pastaId = String(body.pastaId ?? '').trim();
      const itemIds = Array.isArray(body.itemIds)
        ? [...new Set(body.itemIds.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(id)))].slice(0, 200)
        : [];
      const ignoredIds = Array.isArray(body.ignoredIds)
        ? [...new Set(body.ignoredIds.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(id)))].slice(0, 200)
        : [];
      if (!pastaId) return jsonResponse(400, { error: 'Informe a pasta da Biblioteca.' });
      if (itemIds.length === 0 && ignoredIds.length === 0) {
        return jsonResponse(400, { error: 'Selecione ao menos um item ou confirme quais devem ser ignorados.' });
      }
      const folder = await getManagedDriveFolder(adminClient, pastaId);
      const { accessToken } = await integrationAccessToken(adminClient);
      const requestedIds = new Set([...itemIds, ...ignoredIds]);
      const folderTree = await listManagedDriveFolderTree(adminClient, folder);
      const driveFolders = await listDriveItemsForManagedTree(accessToken, folderTree);
      const requestedItems = driveFolders.flatMap(({ context, items }) => items
        .filter((item) => requestedIds.has(item.id))
        .map((item) => ({ ...item, targetFolderId: context.libraryFolderId })));
      if (requestedItems.length !== requestedIds.size) {
        return jsonResponse(409, { error: 'Um ou mais itens não pertencem mais à pasta selecionada. Busque novamente.' });
      }
      const selectedIds = new Set(itemIds);
      const selectedItems = requestedItems
        .filter((item) => selectedIds.has(item.id));

      if (ignoredIds.length > 0) {
        const ignoredIdSet = new Set(ignoredIds);
        const { error } = await adminClient.from('biblioteca_google_itens_ignorados').upsert(
          requestedItems.filter((item) => ignoredIdSet.has(item.id)).map((item) => ({
            pasta_id: item.targetFolderId,
            google_file_id: item.id,
            nome: item.name,
            mime_type: item.mimeType,
            ignorado_por: user?.id ?? null,
          })),
          { onConflict: 'pasta_id,google_file_id' },
        );
        if (error) throw error;
      }
      if (itemIds.length > 0) {
        const { error } = await adminClient.from('biblioteca_google_itens_ignorados')
          .delete()
          .in('pasta_id', folderTree.map((item) => item.libraryFolderId))
          .in('google_file_id', itemIds);
        if (error) throw error;
      }

      const [{ data: existingFolders, error: existingFoldersError }, { data: existingFiles, error: existingFilesError }] = await Promise.all([
        adminClient.from('biblioteca_pastas').select('google_folder_id').in('google_folder_id', itemIds),
        adminClient.from('biblioteca_arquivos').select('google_file_id').in('google_file_id', itemIds),
      ]);
      if (existingFoldersError) throw existingFoldersError;
      if (existingFilesError) throw existingFilesError;
      const existingIds = new Set([
        ...(existingFolders ?? []).map((item) => item.google_folder_id),
        ...(existingFiles ?? []).map((item) => item.google_file_id),
      ].filter(Boolean));
      const newItems = selectedItems.filter((item) => !existingIds.has(item.id));
      const folders = newItems.filter((item) => item.mimeType === GOOGLE_FOLDER_MIME_TYPE);
      const files = newItems.filter((item) => item.mimeType !== GOOGLE_FOLDER_MIME_TYPE);

      if (folders.length > 0) {
        const { error } = await adminClient.from('biblioteca_pastas').insert(folders.map((item) => ({
          nome: item.name,
          parent_id: item.targetFolderId,
          origem: 'google_drive',
          google_folder_id: item.id,
          url_externa: item.webViewLink ?? `https://drive.google.com/drive/folders/${item.id}`,
          google_managed: true,
        })));
        if (error) throw error;
      }
      let insertedFileIds: string[] = [];
      if (files.length > 0) {
        const { data: insertedFiles, error } = await adminClient.from('biblioteca_arquivos').insert(files.map((item) => ({
          nome_exibicao: item.name,
          pasta_id: item.targetFolderId,
          storage_path: null,
          tamanho_bytes: Number(item.size ?? 0),
          tipo_mime: item.mimeType,
          origem: 'google_drive',
          google_file_id: item.id,
          google_tipo: googleFileTypeFromMimeType(item.mimeType),
          url_externa: item.webViewLink ?? `https://drive.google.com/open?id=${item.id}`,
          google_managed: true,
          google_sync_status: 'pending',
        }))).select('id');
        if (error) throw error;
        insertedFileIds = (insertedFiles ?? []).map((item) => String(item.id));
      }
      const immediateIds = insertedFileIds.slice(0, 25);
      const syncResult = immediateIds.length > 0
        ? await processSpecificFiles(adminClient, immediateIds)
        : { results: [] as Array<{ arquivoId: string; errors: string[] }> };
      const syncFailures = syncResult.results.reduce(
        (total, result) => total + (result.errors.length > 0 ? 1 : 0),
        0,
      );
      return jsonResponse(201, {
        addedFiles: files.length,
        addedFolders: folders.length,
        skipped: itemIds.length - newItems.length,
        processedImmediately: immediateIds.length,
        syncFailures,
        pending: Math.max(0, insertedFileIds.length - immediateIds.length),
      });
    }

    if (action === 'create-file') {
      const name = String(body.name ?? '').trim();
      const fileType = body.fileType === 'spreadsheet' ? 'spreadsheet' : 'document';
      const pastaId = typeof body.pastaId === 'string' && body.pastaId ? body.pastaId : null;
      if (!name || name.length > 200) {
        return jsonResponse(400, { error: 'Informe um nome de até 200 caracteres.' });
      }
      const { integration, accessToken } = await integrationAccessToken(adminClient);
      const driveParentId = await resolveDriveParentId(
        adminClient,
        integration.drive_root_folder_id,
        pastaId,
      );
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
          parents: [driveParentId],
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

    if (action === 'create-folder') {
      const name = String(body.name ?? '').trim();
      const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null;
      if (!name || name.length > 200) {
        return jsonResponse(400, { error: 'Informe um nome de até 200 caracteres.' });
      }
      const { integration, accessToken } = await integrationAccessToken(adminClient);
      const driveParentId = await resolveDriveParentId(adminClient, integration.drive_root_folder_id, parentId);
      const driveFolder = await createDriveFolder(accessToken, driveParentId, name);
      const { data: folder, error } = await adminClient.from('biblioteca_pastas').insert({
        nome: driveFolder.name,
        parent_id: parentId,
        origem: 'google_drive',
        google_folder_id: driveFolder.id,
        url_externa: driveFolder.webViewLink,
        google_managed: true,
      }).select('*').single();
      if (error) {
        try {
          await updateGoogleFile(accessToken, driveFolder.id, { trashed: true });
        } catch {
          // A falha original do banco continua sendo a relevante.
        }
        throw error;
      }
      return jsonResponse(201, { folder });
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
      const driveParentId = await resolveDriveParentId(
        adminClient,
        integration.drive_root_folder_id,
        sourceFile.pasta_id,
      );
      const { driveFile, fileType } = await uploadConvertedGoogleFile(
        accessToken,
        driveParentId,
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
      const arquivoIds = Array.isArray(body.arquivoIds)
        ? [...new Set(body.arquivoIds.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, 25)
        : [];
      if (!pastaId && !arquivoId && arquivoIds.length === 0) {
        return jsonResponse(400, { error: 'Informe a pasta ou o arquivo para sincronizar.' });
      }
      let affectedFiles: Array<{ arquivo_id: string }>;
      if (arquivoIds.length > 0) {
        const { data: files, error } = await adminClient
          .from('biblioteca_arquivos')
          .select('id')
          .in('id', arquivoIds)
          .eq('origem', 'google_drive')
          .eq('google_managed', true);
        if (error) throw error;
        affectedFiles = (files ?? []).map((file) => ({ arquivo_id: String(file.id) }));
      } else {
        const { data: affected, error } = await adminClient.rpc(
          'biblioteca_google_arquivos_afetados',
          { p_pasta_id: pastaId, p_arquivo_id: arquivoId },
        );
        if (error) throw error;
        affectedFiles = (affected ?? []) as Array<{ arquivo_id: string }>;
      }
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

    if (action === 'delete-items-recursively') {
      if (body.confirmation !== 'EXCLUIR') {
        return jsonResponse(400, { error: 'Digite EXCLUIR para confirmar a exclusão recursiva.' });
      }
      const folderIds = Array.isArray(body.folderIds)
        ? [...new Set(body.folderIds.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, 100)
        : [];
      const fileIds = Array.isArray(body.fileIds)
        ? [...new Set(body.fileIds.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, 100)
        : [];
      if (folderIds.length === 0 && fileIds.length === 0) {
        return jsonResponse(400, { error: 'Selecione ao menos uma pasta ou arquivo.' });
      }
      return jsonResponse(200, await deleteLibraryItemsRecursively(adminClient, folderIds, fileIds));
    }

    if (action === 'remove-missing-library-items') {
      if (body.confirmation !== 'REMOVER') {
        return jsonResponse(400, { error: 'Confirme a remoção dos registros da Biblioteca.' });
      }
      const folderIds = Array.isArray(body.folderIds)
        ? [...new Set(body.folderIds.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, 100)
        : [];
      const fileIds = Array.isArray(body.fileIds)
        ? [...new Set(body.fileIds.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, 100)
        : [];
      if (folderIds.length === 0 && fileIds.length === 0) {
        return jsonResponse(400, { error: 'Selecione ao menos um item ausente.' });
      }
      const [{ data: folders, error: foldersError }, { data: files, error: filesError }] = await Promise.all([
        folderIds.length > 0
          ? adminClient.from('biblioteca_pastas').select('id,parent_id,google_folder_id,google_managed').in('id', folderIds)
          : Promise.resolve({ data: [], error: null }),
        fileIds.length > 0
          ? adminClient.from('biblioteca_arquivos').select('id,pasta_id,google_file_id,google_managed').in('id', fileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (foldersError) throw foldersError;
      if (filesError) throw filesError;
      if ((folders ?? []).length !== folderIds.length || (files ?? []).length !== fileIds.length) {
        return jsonResponse(409, { error: 'Um ou mais registros não existem mais. Atualize a pasta.' });
      }
      const candidates = [
        ...(folders ?? []).map((item) => ({
          id: item.id,
          parentId: item.parent_id,
          googleFileId: item.google_folder_id,
          managed: item.google_managed,
        })),
        ...(files ?? []).map((item) => ({
          id: item.id,
          parentId: item.pasta_id,
          googleFileId: item.google_file_id,
          managed: item.google_managed,
        })),
      ];
      if (candidates.some((item) => !item.managed || !item.parentId || !item.googleFileId)) {
        return jsonResponse(400, { error: 'A remoção é permitida somente para itens gerenciados ausentes de uma pasta do Google Drive.' });
      }
      const parentIds = [...new Set(candidates.map((item) => String(item.parentId)))];
      const { data: parents, error: parentsError } = await adminClient
        .from('biblioteca_pastas')
        .select('id,google_folder_id,google_managed')
        .in('id', parentIds);
      if (parentsError) throw parentsError;
      const parentGoogleIds = new Map((parents ?? []).map((item) => [item.id, item.google_folder_id]));
      const { accessToken } = await integrationAccessToken(adminClient);
      for (const candidate of candidates) {
        const parentGoogleId = parentGoogleIds.get(String(candidate.parentId));
        if (!parentGoogleId) return jsonResponse(409, { error: 'A pasta de origem não está mais vinculada ao Google Drive.' });
        const location = await inspectDriveItemLocation(accessToken, String(candidate.googleFileId), String(parentGoogleId));
        if (location.status === 'present') {
          return jsonResponse(409, { error: 'Um dos itens voltou a existir na pasta do Drive. Busque novamente antes de remover.' });
        }
      }
      return jsonResponse(200, await deleteLibraryItemsRecursively(adminClient, folderIds, fileIds, false));
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
    if (error instanceof GoogleApiError && error.status === 403) {
      const normalizedMessage = error.message.toLowerCase();
      if (normalizedMessage.includes('scope') || normalizedMessage.includes('insufficient')) {
        return jsonResponse(403, {
          error: 'Reautorize a conta oficial nas configurações do Google Drive para permitir esta operação.',
        });
      }
    }
    const message = errorMessage(error);
    return jsonResponse(500, { error: message });
  }
});
