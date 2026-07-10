import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

const SOURCE_BUCKET = 'galeria';
const DEFAULT_PUBLIC_IMAGE_BASE_URL = 'https://ejc-fotos.ejcsecretaria-sistema.workers.dev';
const DEFAULT_LIMIT = 25;

function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return;

  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnv();

const applyChanges = process.argv.includes('--apply');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const migrationToken = process.env.PUBLIC_IMAGE_MIGRATION_TOKEN;
const publicImageBaseUrl = (
  process.env.PUBLIC_IMAGE_BASE_URL || DEFAULT_PUBLIC_IMAGE_BASE_URL
).replace(/\/+$/, '');

function numberArgument(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (!argument) return fallback;
  const parsed = Number(argument.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const limit = Math.floor(numberArgument('limit', DEFAULT_LIMIT));

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar.');
  process.exit(1);
}

if (applyChanges && !migrationToken) {
  console.error('Defina PUBLIC_IMAGE_MIGRATION_TOKEN antes de executar com --apply.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const referenceSources = [
  { table: 'participacoes', column: 'foto_url' },
  { table: 'equipe_confirmacoes', column: 'foto_url' },
  { table: 'equipe_confirmacoes', column: 'criancas_recreacao_foto_url' },
  { table: 'palestras', column: 'palestrante_foto_url' },
  { table: 'circulos', column: 'imagem_url' },
  { table: 'circulo_mediadores_fotos', column: 'foto_url' },
  { table: 'visita_grupos', column: 'foto_url' },
  { table: 'visita_participacao', column: 'foto_familia_url' },
  { table: 'encontros', column: 'logo_url' },
];

let migratedFiles = 0;
let referencesUpdated = 0;
let originalBytes = 0;
let failures = 0;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatError(error) {
  if (!error) return 'Erro desconhecido.';
  if (typeof error === 'string') return error;
  const details = {
    name: error.name,
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
    status: error.status,
    statusCode: error.statusCode,
    cause: error.cause instanceof Error ? error.cause.message : error.cause,
  };
  const usefulDetails = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined && value !== ''),
  );
  if (Object.keys(usefulDetails).length > 0) return JSON.stringify(usefulDetails);

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== '{}' ? serialized : String(error);
  } catch {
    return String(error);
  }
}

function isRetryableError(error) {
  const details = formatError(error).toLowerCase();
  return details === '[object object]'
    || details === '{}'
    || details.includes('"message":{}')
    || details.includes('"message":"{}"')
    || details.includes('storageunknownerror')
    || details.includes('too many connections')
    || details.includes('connection')
    || details.includes('timeout')
    || details.includes('timed out')
    || details.includes('fetch failed')
    || details.includes('network')
    || details.includes('rate limit')
    || details.includes('"status":429')
    || /"status(code)?":50[0-4]/.test(details);
}

async function withRetry(label, operation) {
  let lastError = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }

    if (attempt >= 4 || !isRetryableError(lastError)) break;
    const delay = 1_500 * (2 ** (attempt - 1));
    console.warn(`${label}: tentativa ${attempt} falhou; nova tentativa em ${delay} ms.`);
    await wait(delay);
  }

  throw lastError;
}

function getPublicStoragePath(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${SOURCE_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

function targetUrlFor(path) {
  const normalizedPath = path
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return `${publicImageBaseUrl}/${normalizedPath}`;
}

async function listAll(table, columns, orderColumn = 'id') {
  const rows = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)
      .order(orderColumn);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function collectReferences() {
  const files = new Map();

  for (const source of referenceSources) {
    const rows = await listAll(source.table, `id, ${source.column}`);
    for (const row of rows) {
      const sourceUrl = row[source.column];
      const path = getPublicStoragePath(sourceUrl);
      if (!path || !path.startsWith('fotos/')) continue;

      const file = files.get(path) ?? {
        path,
        urls: new Map(),
        contentLength: null,
        contentType: null,
      };
      const references = file.urls.get(sourceUrl) ?? [];
      references.push({
        table: source.table,
        column: source.column,
        id: row.id,
      });
      file.urls.set(sourceUrl, references);
      files.set(path, file);
    }
  }

  return files;
}

async function loadContentMetadata(file) {
  for (const url of file.urls.keys()) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) continue;
      const length = Number(response.headers.get('content-length'));
      file.contentType = response.headers.get('content-type');
      if (Number.isFinite(length) && length > 0) file.contentLength = length;
      return;
    } catch {
      // Outra URL do mesmo objeto ainda pode responder.
    }
  }
}

async function mapInBatches(values, batchSize, callback) {
  for (let index = 0; index < values.length; index += batchSize) {
    await Promise.all(values.slice(index, index + batchSize).map(callback));
  }
}

async function uploadToWorker(file, blob) {
  const response = await fetch(targetUrlFor(file.path), {
    method: 'PUT',
    headers: {
      'content-type': blob.type || file.contentType || 'application/octet-stream',
      'x-migration-token': migrationToken,
    },
    body: blob,
  });

  if (response.ok || response.status === 409) return response.status;

  let details = '';
  try {
    details = JSON.stringify(await response.json());
  } catch {
    details = await response.text().catch(() => '');
  }
  throw new Error(`Worker respondeu ${response.status}: ${details}`);
}

async function migrateFile(file) {
  if (file.urls.size !== 1) {
    throw new Error('O mesmo objeto possui URLs divergentes; migração manual necessária.');
  }

  const blob = await withRetry(`Download ${file.path}`, async () => {
    const { data, error } = await supabase.storage
      .from(SOURCE_BUCKET)
      .download(file.path);
    if (error) throw error;
    return data;
  });

  const sourceBytes = blob.size;
  const uploadStatus = await withRetry(
    `Upload R2 ${file.path}`,
    () => uploadToWorker(file, blob),
  );
  const [sourceUrl, refs] = file.urls.entries().next().value;
  const targetUrl = targetUrlFor(file.path);

  const updated = await withRetry(`Atualização de referências ${file.path}`, async () => {
    const { data, error } = await supabase.rpc('complete_public_image_r2_migration', {
      p_source_url: sourceUrl,
      p_target_url: targetUrl,
      p_source_path: file.path,
      p_original_bytes: sourceBytes,
      p_expected_references: refs.length,
    });
    if (error) throw error;
    return data;
  });

  return {
    sourceBytes,
    targetUrl,
    referencesUpdated: Number(updated ?? 0),
    uploadStatus,
  };
}

console.log(applyChanges
  ? 'Modo APPLY: imagens serão copiadas para o R2 e referências serão atualizadas.'
  : 'Modo DRY-RUN: apenas referências serão consultadas.');

const references = await collectReferences();
const files = Array.from(references.values());
await mapInBatches(files, 10, loadContentMetadata);

const candidates = files
  .sort((a, b) => (b.contentLength ?? 0) - (a.contentLength ?? 0))
  .slice(0, limit);

console.log({
  referencedLegacyFiles: files.length,
  candidates: candidates.length,
  candidateBytes: candidates.reduce((sum, file) => sum + (file.contentLength ?? 0), 0),
  publicImageBaseUrl,
  limit,
});

if (applyChanges) {
  for (const file of candidates) {
    try {
      const result = await migrateFile(file);
      migratedFiles += 1;
      referencesUpdated += result.referencesUpdated;
      originalBytes += result.sourceBytes;
      console.log({
        source: file.path,
        target: result.targetUrl,
        referencesUpdated: result.referencesUpdated,
        originalBytes: result.sourceBytes,
        uploadStatus: result.uploadStatus,
      });
    } catch (error) {
      failures += 1;
      console.error(`Falha ao migrar ${file.path}: ${formatError(error)}`);
    } finally {
      await wait(500);
    }
  }
}

console.log({
  mode: applyChanges ? 'apply' : 'dry-run',
  migratedFiles,
  referencesUpdated,
  originalBytes,
  failures,
});

if (failures > 0) process.exitCode = 1;
