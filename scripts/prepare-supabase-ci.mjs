import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'supabase')
const targetRoot = join(root, '.supabase-ci')
const target = join(targetRoot, 'supabase')
const migrations = join(target, 'migrations')

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
