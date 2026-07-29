import { cp, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'supabase')
const targetRoot = join(root, '.supabase-ci')
const target = join(targetRoot, 'supabase')
const migrations = join(target, 'migrations')

const migrationRenames = {
  '20260420_external_access.sql': '20260420090000_external_access.sql',
  '20260420_create_recreacao_dados.sql': '20260420100000_create_recreacao_dados.sql',
  '20260428_biblioteca.sql': '20260428080000_biblioteca.sql',
  '20260428_compras_module.sql': '20260428081000_compras_module.sql',
  '20260428_compras_sizes.sql': '20260428082000_compras_sizes.sql',
  '20260428_compras_sizes_fk.sql': '20260428083000_compras_sizes_fk.sql',
  '20260428_compras_seed_data_robust.sql': '20260428084000_compras_seed_data_robust.sql',
  '20260428_compras_seed_data.sql': '20260428085000_compras_seed_data.sql',
  '20260428_compras_rls.sql': '20260428086000_compras_rls.sql',
  '20260428_external_access_update.sql': '20260428087000_external_access_update.sql',
  'add_health_fields.sql': '20260603105000_add_health_fields.sql',
  'circulo_access_functions.sql': '20260729150000_circulo_access_functions.sql',
}

await rm(targetRoot, { recursive: true, force: true })
await mkdir(targetRoot, { recursive: true })
await cp(source, target, {
  recursive: true,
  filter: (path) => !path.includes(`${join('supabase', '.temp')}`),
})

await cp(
  join(target, 'ci', 'legacy_schema_baseline.sql'),
  join(migrations, '20260304000000_legacy_schema_baseline.sql'),
)
await cp(
  join(target, 'ci', 'pre_20260428_compatibility.sql'),
  join(migrations, '20260428070000_pre_20260428_compatibility.sql'),
)

for (const [from, to] of Object.entries(migrationRenames)) {
  await rename(join(migrations, from), join(migrations, to))
}

const versions = new Map()
for (const name of await readdir(migrations)) {
  const version = name.match(/^(\d+)_/)?.[1]
  if (!version) {
    throw new Error(`Migration without a numeric version after normalization: ${name}`)
  }
  if (versions.has(version)) {
    throw new Error(`Duplicate migration version ${version}: ${versions.get(version)} and ${name}`)
  }
  versions.set(version, name)
}

console.log(`Prepared ${versions.size} migrations in ${targetRoot}`)
