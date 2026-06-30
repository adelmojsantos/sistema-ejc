import { createClient } from '@supabase/supabase-js';

const applyChanges = process.argv.includes('--apply');
const deleteSource = process.argv.includes('--delete-source');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sourceBucket = 'galeria';
const targetBucket = 'comprovantes';
const privatePrefix = 'private-storage://';
const publicMarker = `/storage/v1/object/public/${sourceBucket}/`;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar.');
  process.exit(1);
}

if (deleteSource && !applyChanges) {
  console.error('--delete-source só pode ser usado junto com --apply.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const migratedReferences = new Map();
const sourcePathsToDelete = new Set();
let migratedObjects = 0;
let updatedRows = 0;
let failures = 0;
let remainingLegacyReferences = 0;

function getLegacyStoragePath(value) {
  if (typeof value !== 'string' || value.startsWith(privatePrefix)) return null;

  try {
    const url = new URL(value);
    const markerIndex = url.pathname.indexOf(publicMarker);
    if (markerIndex < 0) return null;
    const path = decodeURIComponent(url.pathname.slice(markerIndex + publicMarker.length));
    return path.startsWith('comprovantes/') ? path : null;
  } catch {
    return null;
  }
}

function createPrivateReference(path) {
  return `${privatePrefix}${targetBucket}/${encodeURI(path)}`;
}

function isAlreadyExistsError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return error?.statusCode === '409'
    || error?.statusCode === 409
    || message.includes('already exists')
    || message.includes('duplicate');
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

async function migrateReference(value) {
  const sourcePath = getLegacyStoragePath(value);
  if (!sourcePath) return value;
  if (migratedReferences.has(value)) return migratedReferences.get(value);

  const targetPath = `legado/${sourcePath.replace(/^comprovantes\//, '')}`;
  const privateReference = createPrivateReference(targetPath);

  if (applyChanges) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(sourceBucket)
      .download(sourcePath);
    if (downloadError) throw downloadError;

    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(targetPath, blob, {
        cacheControl: '31536000',
        contentType: blob.type || undefined,
        upsert: false,
      });
    if (uploadError && !isAlreadyExistsError(uploadError)) throw uploadError;

    const { error: auditError } = await supabase
      .from('comprovante_storage_migracoes')
      .upsert({
        source_bucket: sourceBucket,
        source_path: sourcePath,
        target_bucket: targetBucket,
        target_path: targetPath,
        migrated_at: new Date().toISOString(),
      }, { onConflict: 'source_path' });
    if (auditError) throw auditError;
  }

  migratedReferences.set(value, privateReference);
  sourcePathsToDelete.add(sourcePath);
  migratedObjects += 1;
  return privateReference;
}

async function migrateArray(value) {
  if (!Array.isArray(value)) return [];
  return Promise.all(value.map(migrateReference));
}

async function migrateTeamProofs() {
  const rows = await listAll(
    'equipe_confirmacoes',
    'id, comprovante_taxas_url, comprovantes_taxas_urls, comprovante_camisetas_url, comprovantes_camisetas_urls',
  );

  for (const row of rows) {
    try {
      const next = {
        comprovante_taxas_url: await migrateReference(row.comprovante_taxas_url),
        comprovantes_taxas_urls: await migrateArray(row.comprovantes_taxas_urls),
        comprovante_camisetas_url: await migrateReference(row.comprovante_camisetas_url),
        comprovantes_camisetas_urls: await migrateArray(row.comprovantes_camisetas_urls),
      };
      const changed = JSON.stringify(next) !== JSON.stringify({
        comprovante_taxas_url: row.comprovante_taxas_url,
        comprovantes_taxas_urls: row.comprovantes_taxas_urls ?? [],
        comprovante_camisetas_url: row.comprovante_camisetas_url,
        comprovantes_camisetas_urls: row.comprovantes_camisetas_urls ?? [],
      });
      if (!changed) continue;

      if (applyChanges) {
        const { error } = await supabase
          .from('equipe_confirmacoes')
          .update(next)
          .eq('id', row.id);
        if (error) throw error;
      }
      updatedRows += 1;
    } catch (error) {
      failures += 1;
      console.error(`Falha em equipe_confirmacoes/${row.id}:`, error.message);
    }
  }
}

async function migrateVisitProofs() {
  const rows = await listAll('visita_intencao_camiseta', 'id, comprovante_url');

  for (const row of rows) {
    try {
      const comprovanteUrl = await migrateReference(row.comprovante_url);
      if (comprovanteUrl === row.comprovante_url) continue;

      if (applyChanges) {
        const { error } = await supabase
          .from('visita_intencao_camiseta')
          .update({ comprovante_url: comprovanteUrl })
          .eq('id', row.id);
        if (error) throw error;
      }
      updatedRows += 1;
    } catch (error) {
      failures += 1;
      console.error(`Falha em visita_intencao_camiseta/${row.id}:`, error.message);
    }
  }
}

async function countRemainingLegacyReferences() {
  const teamRows = await listAll(
    'equipe_confirmacoes',
    'id, comprovante_taxas_url, comprovantes_taxas_urls, comprovante_camisetas_url, comprovantes_camisetas_urls',
  );
  const visitRows = await listAll('visita_intencao_camiseta', 'id, comprovante_url');

  const teamValues = teamRows.flatMap((row) => [
    row.comprovante_taxas_url,
    ...(Array.isArray(row.comprovantes_taxas_urls) ? row.comprovantes_taxas_urls : []),
    row.comprovante_camisetas_url,
    ...(Array.isArray(row.comprovantes_camisetas_urls) ? row.comprovantes_camisetas_urls : []),
  ]);
  const visitValues = visitRows.map((row) => row.comprovante_url);
  return [...teamValues, ...visitValues].filter((value) => getLegacyStoragePath(value)).length;
}

console.log(applyChanges ? 'Modo APPLY: alterações serão persistidas.' : 'Modo DRY-RUN: nenhuma alteração será persistida.');
await migrateTeamProofs();
await migrateVisitProofs();
remainingLegacyReferences = applyChanges
  ? await countRemainingLegacyReferences()
  : sourcePathsToDelete.size;

if (deleteSource) {
  if (failures > 0 || remainingLegacyReferences > 0) {
    console.error('Arquivos de origem preservados porque houve falhas ou referências públicas remanescentes.');
  } else {
    const auditRows = await listAll(
      'comprovante_storage_migracoes',
      'source_bucket, source_path, source_deleted_at',
      'source_path',
    );
    const paths = auditRows
      .filter((row) => row.source_bucket === sourceBucket && !row.source_deleted_at)
      .map((row) => row.source_path);

    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { error } = await supabase.storage.from(sourceBucket).remove(batch);
      if (error) {
        failures += 1;
        console.error('Falha ao remover lote de originais:', error.message);
        continue;
      }
      const { error: auditError } = await supabase
        .from('comprovante_storage_migracoes')
        .update({ source_deleted_at: new Date().toISOString() })
        .in('source_path', batch);
      if (auditError) {
        failures += 1;
        console.error('Falha ao atualizar auditoria da remoção:', auditError.message);
      }
    }
  }
}

console.log({
  mode: applyChanges ? 'apply' : 'dry-run',
  migratedObjects,
  updatedRows,
  sourceObjectsSelected: sourcePathsToDelete.size,
  remainingLegacyReferences,
  sourceDeletionRequested: deleteSource,
  failures,
});

if (failures > 0) process.exitCode = 1;
