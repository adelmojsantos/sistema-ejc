import { createClient } from '@supabase/supabase-js';

const applyChanges = process.argv.includes('--apply');
const encounterArgument = process.argv.find((value) => value.startsWith('--encontro='))?.split('=')[1] ?? '';
const limitArgument = Number(process.argv.find((value) => value.startsWith('--limit='))?.split('=')[1] ?? 1000);
const limit = Number.isFinite(limitArgument) && limitArgument > 0 ? Math.floor(limitArgument) : 1000;
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl || !anonKey || !accessToken) {
  console.error('Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_ACCESS_TOKEN.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
});

const normalize = (value) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const digits = (value) => String(value ?? '').replace(/\D/g, '');
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findCep(person) {
  if (!person.endereco || !person.cidade || !person.estado) return null;
  const path = [person.estado, person.cidade, person.endereco].map(encodeURIComponent).join('/');
  try {
    const response = await fetch(`https://viacep.com.br/ws/${path}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const items = await response.json();
    if (!Array.isArray(items)) return null;
    const valid = items.filter((item) => digits(item?.cep).length === 8
      && normalize(item?.localidade) === normalize(person.cidade)
      && normalize(item?.uf) === normalize(person.estado));
    if (valid.length === 1) return digits(valid[0].cep);
    const byNeighborhood = valid.filter((item) => person.bairro
      && normalize(item?.bairro) === normalize(person.bairro));
    return byNeighborhood.length === 1 ? digits(byNeighborhood[0].cep) : null;
  } catch {
    return null;
  }
}

const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
if (userError || !userData.user) {
  console.error('SUPABASE_ACCESS_TOKEN inválido ou expirado.');
  process.exit(1);
}

const { data: activeEncounters, error: encounterError } = await supabase
  .from('encontros').select('id, nome').eq('ativo', true);
if (encounterError || !activeEncounters?.length) {
  console.error('Não foi possível localizar o encontro ativo.');
  process.exit(1);
}
if (activeEncounters.length !== 1) {
  console.error(`Foram encontrados ${activeEncounters.length} encontros ativos; corrija essa inconsistência antes de continuar.`);
  process.exit(1);
}

const encounter = activeEncounters[0];
if (applyChanges && encounterArgument !== encounter.id) {
  console.error(`Para aplicar, informe --encontro=${encounter.id} confirmando o encontro ativo.`);
  process.exit(1);
}

const { data: participations, error: participationsError } = await supabase
  .from('participacoes')
  .select('pessoa_id, pessoas!inner(id, endereco, numero, complemento, bairro, cidade, estado, cep, latitude, longitude, geo_reference_latitude, geo_reference_longitude)')
  .eq('encontro_id', encounter.id)
  .eq('participante', false)
  .limit(limit);
if (participationsError) throw participationsError;

const counters = { candidates: 0, updated: 0, located: 0, unresolved: 0, skipped: 0, conflicts: 0 };
for (const participation of participations ?? []) {
  const person = Array.isArray(participation.pessoas) ? participation.pessoas[0] : participation.pessoas;
  if (!person) { counters.skipped += 1; continue; }
  if ((person.latitude != null && person.longitude != null)
    || (person.geo_reference_latitude != null && person.geo_reference_longitude != null)) {
    counters.skipped += 1;
    continue;
  }

  const address = { ...person };
  if (normalize(address.cidade) === 'franca' && !String(address.estado ?? '').trim()) address.estado = 'SP';
  if (normalize(address.cidade) === 'franca' && address.estado && normalize(address.estado) !== 'sp') {
    counters.conflicts += 1;
    continue;
  }
  if (!digits(address.cep)) address.cep = await findCep(address);
  if (!address.endereco || !address.cidade || !address.estado) { counters.skipped += 1; continue; }
  counters.candidates += 1;

  if (!applyChanges) continue;

  const addressUpdate = {};
  if (address.estado !== person.estado) addressUpdate.estado = address.estado;
  if (address.cep && digits(address.cep) !== digits(person.cep)) addressUpdate.cep = digits(address.cep);
  if (Object.keys(addressUpdate).length > 0) {
    const { error } = await supabase.from('pessoas').update(addressUpdate).eq('id', person.id);
    if (error) { counters.unresolved += 1; continue; }
    counters.updated += 1;
  }

  const { data, error } = await supabase.functions.invoke('geocode-address', {
    body: { personId: person.id, force: true },
  });
  if (!error && data?.candidate) counters.located += 1;
  else counters.unresolved += 1;
  await wait(1100);
}

console.info(JSON.stringify({ mode: applyChanges ? 'apply' : 'dry-run', encounter: encounter.id, limit, ...counters }, null, 2));
