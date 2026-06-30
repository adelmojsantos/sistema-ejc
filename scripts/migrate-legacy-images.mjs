import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SOURCE_BUCKET = 'galeria';
const TARGET_BUCKET = 'galeria';
const OPTIMIZED_PREFIX = 'fotos/otimizadas';
const DEFAULT_MIN_BYTES = 1024 * 1024;
const DEFAULT_LIMIT = 25;
const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 82;
const DEFAULT_DELETE_AGE_DAYS = 7;

const applyChanges = process.argv.includes('--apply');
const deleteSource = process.argv.includes('--delete-source');
const deleteOnly = process.argv.includes('--delete-only');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function numberArgument(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (!argument) return fallback;
  const parsed = Number(argument.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const minBytes = numberArgument('min-bytes', DEFAULT_MIN_BYTES);
const limit = Math.floor(numberArgument('limit', DEFAULT_LIMIT));
const maxDimension = Math.floor(numberArgument('max-dimension', DEFAULT_MAX_DIMENSION));
const quality = Math.min(100, Math.floor(numberArgument('quality', DEFAULT_QUALITY)));
const deleteAgeDays = numberArgument('delete-age-days', DEFAULT_DELETE_AGE_DAYS);

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar.');
  process.exit(1);
}

if (deleteSource && !applyChanges) {
  console.error('--delete-source só pode ser usado junto com --apply.');
  process.exit(1);
}

if (deleteOnly && !deleteSource) {
  console.error('--delete-only exige --delete-source.');
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

let failures = 0;
let migratedFiles = 0;
let referencesUpdated = 0;
let originalBytes = 0;
let optimizedBytes = 0;

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

async function supabaseRequestWithRetry(label, operation, acceptError = () => false) {
  let lastError = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const result = await operation();
      if (!result.error || acceptError(result.error)) return result;
      lastError = result.error;
    } catch (error) {
      lastError = error;
    }

    if (attempt >= 4 || !isRetryableError(lastError)) break;
    const delay = 1_500 * (2 ** (attempt - 1));
    console.warn(`${label}: tentativa ${attempt} falhou; nova tentativa em ${delay} ms.`);
    await wait(delay);
  }

  throw new Error(`${label}: ${formatError(lastError)}`);
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

async function listAll(table, columns, orderColumn = 'id') {
  const rows = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data } = await supabaseRequestWithRetry(
      `Consulta ${table} (${from}-${from + pageSize - 1})`,
      () => supabase
        .from(table)
        .select(columns)
        .range(from, from + pageSize - 1)
        .order(orderColumn),
    );
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function collectReferences() {
  const files = new Map();

  for (const source of referenceSources) {
    const rows = await listAll(source.table, `id, ${source.column}`);
    for (const row of rows) {
      const url = row[source.column];
      const path = getPublicStoragePath(url);
      if (!path || !path.startsWith('fotos/') || path.startsWith(`${OPTIMIZED_PREFIX}/`)) {
        continue;
      }

      const file = files.get(path) ?? {
        path,
        urls: new Map(),
        contentLength: null,
        contentType: null,
      };
      const references = file.urls.get(url) ?? [];
      references.push({
        table: source.table,
        column: source.column,
        id: row.id,
      });
      file.urls.set(url, references);
      files.set(path, file);
    }
  }

  return files;
}

async function loadContentLength(file) {
  for (const url of file.urls.keys()) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) continue;
      const length = Number(response.headers.get('content-length'));
      file.contentType = response.headers.get('content-type');
      if (Number.isFinite(length) && length > 0) {
        file.contentLength = length;
        return;
      }
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

function targetPathFor(sourcePath) {
  const hash = createHash('sha256').update(sourcePath).digest('hex').slice(0, 24);
  return `${OPTIMIZED_PREFIX}/${hash}.webp`;
}

function isAlreadyExistsError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return error?.statusCode === '409'
    || error?.statusCode === 409
    || message.includes('already exists')
    || message.includes('duplicate');
}

async function migrateFile(file) {
  if (file.urls.size !== 1) {
    throw new Error('O mesmo objeto possui URLs divergentes; migração manual necessária.');
  }

  const { data: blob } = await supabaseRequestWithRetry(
    `Download ${file.path}`,
    () => supabase.storage.from(SOURCE_BUCKET).download(file.path),
  );

  const sourceBuffer = Buffer.from(await blob.arrayBuffer());
  const targetBuffer = await sharp(sourceBuffer, { animated: false })
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();

  if (targetBuffer.length >= sourceBuffer.length) {
    return { skipped: true, reason: 'A conversão não reduziria o arquivo.' };
  }

  const targetPath = targetPathFor(file.path);
  const { error: uploadError } = await supabaseRequestWithRetry(
    `Upload ${targetPath}`,
    () => supabase.storage
      .from(TARGET_BUCKET)
      .upload(targetPath, targetBuffer, {
        cacheControl: '31536000',
        contentType: 'image/webp',
        upsert: false,
      }),
    isAlreadyExistsError,
  );
  const targetAlreadyExisted = Boolean(uploadError && isAlreadyExistsError(uploadError));
  if (uploadError && !targetAlreadyExisted) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from(TARGET_BUCKET)
    .getPublicUrl(targetPath);
  const targetUrl = publicUrlData.publicUrl;
  const [sourceUrl, refs] = file.urls.entries().next().value;
  const rpcParams = {
    p_source_url: sourceUrl,
    p_target_url: targetUrl,
    p_source_path: file.path,
    p_target_path: targetPath,
    p_original_bytes: sourceBuffer.length,
    p_optimized_bytes: targetBuffer.length,
    p_expected_references: refs.length,
  };
  let updated = null;
  let completionError = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const result = await supabase.rpc('complete_storage_image_migration', rpcParams);
      if (!result.error) {
        updated = result.data;
        completionError = null;
        break;
      }
      completionError = result.error;
    } catch (error) {
      completionError = error;
    }

    try {
      const { data: audit } = await supabaseRequestWithRetry(
        `Reconciliação ${file.path}`,
        () => supabase
          .from('imagem_storage_migracoes')
          .select('target_path, references_updated')
          .eq('source_path', file.path)
          .maybeSingle(),
      );
      if (audit?.target_path === targetPath) {
        updated = audit.references_updated;
        completionError = null;
        break;
      }
    } catch {
      // O retry do RPC continua sendo seguro por usar origem e destino determinísticos.
    }

    if (attempt >= 4 || !isRetryableError(completionError)) break;
    const delay = 1_500 * (2 ** (attempt - 1));
    console.warn(`Conclusão ${file.path}: tentativa ${attempt} falhou; nova tentativa em ${delay} ms.`);
    await wait(delay);
  }

  if (completionError) {
    // Mantém o destino: uma falha de rede pode ocorrer depois do commit do RPC.
    // O caminho determinístico permite que uma nova execução reconcilie o estado.
    throw new Error(`Conclusão ${file.path}: ${formatError(completionError)}`);
  }

  return {
    skipped: false,
    sourceBytes: sourceBuffer.length,
    targetBytes: targetBuffer.length,
    updated: Number(updated ?? 0),
    targetPath,
  };
}

async function deleteMigratedSources(currentReferences) {
  const cutoff = Date.now() - deleteAgeDays * 24 * 60 * 60 * 1000;
  const rows = await listAll(
    'imagem_storage_migracoes',
    'source_path, migrated_at, source_deleted_at',
    'source_path',
  );
  const eligible = rows.filter((row) =>
    !row.source_deleted_at
    && new Date(row.migrated_at).getTime() <= cutoff
    && !currentReferences.has(row.source_path)
  );

  let deleted = 0;
  for (let index = 0; index < eligible.length; index += 100) {
    const paths = eligible.slice(index, index + 100).map((row) => row.source_path);
    const { error: removeError } = await supabase.storage.from(SOURCE_BUCKET).remove(paths);
    if (removeError) {
      failures += 1;
      console.error('Falha ao remover lote de originais:', removeError.message);
      continue;
    }
    const { error: auditError } = await supabase
      .from('imagem_storage_migracoes')
      .update({ source_deleted_at: new Date().toISOString() })
      .in('source_path', paths);
    if (auditError) {
      failures += 1;
      console.error('Falha ao registrar remoção dos originais:', auditError.message);
    } else {
      deleted += paths.length;
    }
  }

  return deleted;
}

console.log(applyChanges
  ? 'Modo APPLY: imagens selecionadas serão convertidas e as referências atualizadas.'
  : 'Modo DRY-RUN: apenas metadados serão consultados.');

const references = await collectReferences();
const files = Array.from(references.values());
await mapInBatches(files, 10, loadContentLength);

const candidates = files
  .filter((file) =>
    (file.contentLength === null || file.contentLength >= minBytes)
    && !['image/gif', 'image/svg+xml'].includes(file.contentType?.split(';')[0] ?? '')
  )
  .sort((a, b) => (b.contentLength ?? 0) - (a.contentLength ?? 0))
  .slice(0, deleteOnly ? 0 : limit);

console.log({
  referencedLegacyFiles: files.length,
  candidates: candidates.length,
  candidateBytes: candidates.reduce((sum, file) => sum + (file.contentLength ?? 0), 0),
  minBytes,
  limit,
  maxDimension,
  quality,
});

if (applyChanges) {
  for (const file of candidates) {
    try {
      const result = await migrateFile(file);
      if (result.skipped) {
        console.log(`Ignorado ${file.path}: ${result.reason}`);
        continue;
      }
      migratedFiles += 1;
      referencesUpdated += result.updated;
      originalBytes += result.sourceBytes;
      optimizedBytes += result.targetBytes;
      console.log({
        source: file.path,
        target: result.targetPath,
        referencesUpdated: result.updated,
        originalBytes: result.sourceBytes,
        optimizedBytes: result.targetBytes,
        reductionPercent: Math.round((1 - result.targetBytes / result.sourceBytes) * 100),
      });
    } catch (error) {
      failures += 1;
      console.error(`Falha ao migrar ${file.path}: ${formatError(error)}`);
    } finally {
      await wait(1_000);
    }
  }
}

const refreshedReferences = applyChanges ? await collectReferences() : references;
const deletedSources = deleteSource
  ? await deleteMigratedSources(refreshedReferences)
  : 0;

console.log({
  mode: applyChanges ? 'apply' : 'dry-run',
  migratedFiles,
  referencesUpdated,
  originalBytes,
  optimizedBytes,
  reductionPercent: originalBytes > 0
    ? Math.round((1 - optimizedBytes / originalBytes) * 100)
    : 0,
  deletedSources,
  failures,
});

if (failures > 0) process.exitCode = 1;
