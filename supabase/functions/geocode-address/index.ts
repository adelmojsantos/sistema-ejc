import { createClient } from '@supabase/supabase-js';

type AddressInput = {
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cep?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

type Candidate = {
  latitude: number;
  longitude: number;
  source: 'cepaberto' | 'awesomeapi' | 'nominatim';
  precision: 'cep' | 'street';
};

type GeocodingResult = {
  status: 'verified' | 'failed';
  addressFingerprint: string;
  latitude: number | null;
  longitude: number | null;
  source: 'nominatim' | null;
  precision: 'house_number' | null;
  checkedAt: string;
  failureCode: string | null;
  retryable: boolean;
  candidate: Candidate | null;
  cached: boolean;
};

type ViaCepAddress = AddressInput & { cep: string };
type CepResolution = {
  address: ViaCepAddress | null;
  failureCode: 'cep_not_found' | 'cep_selection_required' | 'provider_unavailable' | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanAddress(value: unknown): AddressInput | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  return {
    endereco: cleanText(raw.endereco),
    numero: cleanText(raw.numero),
    complemento: cleanText(raw.complemento),
    cep: cleanText(raw.cep)?.replace(/\D/g, '') || null,
    bairro: cleanText(raw.bairro),
    cidade: cleanText(raw.cidade),
    estado: cleanText(raw.estado)?.toUpperCase() || null,
  };
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const addressAliases: Record<string, string> = {
  av: 'avenida',
  jd: 'jardim',
  pq: 'parque',
  res: 'residencial',
  rod: 'rodovia',
  tv: 'travessa',
};

function normalizeAddressPart(value: unknown): string {
  return normalize(value)
    .split(' ')
    .map((word) => addressAliases[word] ?? word)
    .join(' ');
}

function digits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function validBrazilCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -34
    && latitude <= 6
    && longitude >= -74
    && longitude <= -32
    && !(latitude === 0 && longitude === 0);
}

function textMatches(expected: string | null | undefined, actual: unknown): boolean {
  if (!expected) return true;
  const left = normalize(expected);
  const right = normalize(actual);
  return Boolean(right) && (left === right || left.includes(right) || right.includes(left));
}

function nominatimCandidate(result: Record<string, unknown>, address: AddressInput): Candidate | null {
  const details = result.address && typeof result.address === 'object'
    ? result.address as Record<string, unknown>
    : {};
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!validBrazilCoordinate(latitude, longitude)) return null;

  const returnedRoad = details.road ?? details.pedestrian ?? details.residential;
  if (!textMatches(address.endereco, returnedRoad)) return null;

  const returnedCity = details.city ?? details.town ?? details.village ?? details.municipality;
  if (!textMatches(address.cidade, returnedCity)) return null;

  const returnedStateCode = String(details['ISO3166-2-lvl4'] ?? '').split('-').at(-1);
  if (address.estado && returnedStateCode
    && normalize(address.estado) !== normalize(returnedStateCode)) return null;
  if (address.estado && !returnedStateCode && !textMatches(address.estado, details.state)) return null;

  return { latitude, longitude, source: 'nominatim', precision: 'street' };
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const data = await response.json();
  return data && typeof data === 'object' ? data as Record<string, unknown> : null;
}

async function claimNominatimSlot(serviceClient: ReturnType<typeof createClient>): Promise<boolean> {
  const { data, error } = await serviceClient.rpc('claim_geocoding_provider_slot', {
    p_provider: 'nominatim',
    p_interval_ms: 1100,
  });
  if (error || typeof data !== 'string') return false;
  const waitMs = Math.max(0, new Date(data).getTime() - Date.now());
  if (waitMs > 15000) return false;
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  return true;
}

async function queryNominatim(
  serviceClient: ReturnType<typeof createClient>,
  address: AddressInput,
  userAgent: string,
): Promise<{ candidate: Candidate | null; unavailable: boolean }> {
  if (!address.endereco || !address.cidade || !address.estado) {
    return { candidate: null, unavailable: false };
  }

  if (!await claimNominatimSlot(serviceClient)) {
    return { candidate: null, unavailable: true };
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '3',
    countrycodes: 'br',
    addressdetails: '1',
    // Never send a residential number to the public Nominatim service.
    // Its result is only an approximate regional reference for planning.
    street: address.endereco,
    city: address.cidade,
    state: address.estado,
  });
  if (address.cep) params.set('postalcode', address.cep);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'Accept-Language': 'pt-BR',
        'User-Agent': userAgent,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429 || response.status >= 500) {
      return { candidate: null, unavailable: true };
    }
    if (!response.ok) return { candidate: null, unavailable: false };

    const payload = await response.json();
    if (!Array.isArray(payload)) return { candidate: null, unavailable: false };
    let candidate: Candidate | null = null;
    for (const item of payload) {
      if (!item || typeof item !== 'object') continue;
      candidate ??= nominatimCandidate(item, address);
    }
    return { candidate, unavailable: false };
  } catch {
    return { candidate: null, unavailable: true };
  }
}

async function queryViaCep(cep: string): Promise<AddressInput | null> {
  if (digits(cep).length !== 8) return null;
  try {
    const data = await fetchJson(`https://viacep.com.br/ws/${digits(cep)}/json/`);
    if (!data || data.erro) return null;
    return {
      endereco: cleanText(data.logradouro),
      bairro: cleanText(data.bairro),
      cidade: cleanText(data.localidade),
      estado: cleanText(data.uf),
      cep: digits(data.cep),
    };
  } catch {
    return null;
  }
}

function normalizeViaCepAddress(value: unknown): ViaCepAddress | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const cep = digits(raw.cep);
  const endereco = cleanText(raw.logradouro);
  const cidade = cleanText(raw.localidade);
  const estado = cleanText(raw.uf)?.toUpperCase() ?? null;
  if (cep.length !== 8 || !endereco || !cidade || !estado) return null;
  return {
    cep,
    endereco,
    bairro: cleanText(raw.bairro),
    cidade,
    estado,
  };
}

async function findCepByAddress(address: AddressInput): Promise<CepResolution> {
  if (!address.estado || !address.cidade || !address.endereco) {
    return { address: null, failureCode: 'cep_not_found' };
  }

  const path = [address.estado, address.cidade, address.endereco]
    .map((value) => encodeURIComponent(value))
    .join('/');
  try {
    const response = await fetch(`https://viacep.com.br/ws/${path}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return {
        address: null,
        failureCode: response.status >= 500 ? 'provider_unavailable' : 'cep_not_found',
      };
    }
    const payload = await response.json();
    if (!Array.isArray(payload)) return { address: null, failureCode: 'cep_not_found' };

    const unique = new Map<string, ViaCepAddress>();
    for (const item of payload) {
      const candidate = normalizeViaCepAddress(item);
      if (candidate
        && normalize(candidate.cidade) === normalize(address.cidade)
        && normalize(candidate.estado) === normalize(address.estado)) {
        unique.set(candidate.cep, candidate);
      }
    }
    const candidates = [...unique.values()];
    const exactStreet = candidates.filter((candidate) =>
      normalizeAddressPart(candidate.endereco) === normalizeAddressPart(address.endereco));
    const streetMatches = exactStreet.length > 0 ? exactStreet : candidates;
    const neighborhoodMatches = address.bairro
      ? streetMatches.filter((candidate) =>
          normalizeAddressPart(candidate.bairro) === normalizeAddressPart(address.bairro))
      : [];
    const preferred = neighborhoodMatches.length > 0 ? neighborhoodMatches : streetMatches;
    if (preferred.length === 1) return { address: preferred[0], failureCode: null };
    return {
      address: null,
      failureCode: preferred.length > 1 ? 'cep_selection_required' : 'cep_not_found',
    };
  } catch {
    return { address: null, failureCode: 'provider_unavailable' };
  }
}

function candidateFromPayload(
  payload: Record<string, unknown> | null,
  source: 'cepaberto' | 'awesomeapi',
): Candidate | null {
  if (!payload) return null;
  const latitude = Number(payload.latitude ?? payload.lat);
  const longitude = Number(payload.longitude ?? payload.lng);
  if (!validBrazilCoordinate(latitude, longitude)) return null;
  return { latitude, longitude, source, precision: 'cep' };
}

async function queryCepCandidates(cep: string, cepAbertoToken: string | null): Promise<Candidate | null> {
  if (digits(cep).length !== 8) return null;
  const cleanCep = digits(cep);
  const awesomePromise = fetchJson(`https://cep.awesomeapi.com.br/json/${cleanCep}`)
    .catch(() => null);
  const cepAbertoPromise = cepAbertoToken
    ? fetchJson(`https://www.cepaberto.com/api/v3/cep?cep=${cleanCep}`, {
        headers: { Authorization: `Token token="${cepAbertoToken}"` },
      }).catch(() => null)
    : Promise.resolve(null);
  const [awesome, cepAberto] = await Promise.all([awesomePromise, cepAbertoPromise]);
  return candidateFromPayload(cepAberto, 'cepaberto')
    ?? candidateFromPayload(awesome, 'awesomeapi');
}

function failureResult(
  fingerprint: string,
  code: string,
  retryable: boolean,
  candidate: Candidate | null,
): GeocodingResult {
  return {
    status: 'failed',
    addressFingerprint: fingerprint,
    latitude: null,
    longitude: null,
    source: null,
    precision: null,
    checkedAt: new Date().toISOString(),
    failureCode: code,
    retryable,
    candidate,
    cached: false,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Configuração interna ausente.' });
    }

    const authHeader = request.headers.get('Authorization') ?? '';
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse(401, { error: 'Sessão inválida.' });

    const permissionKeys = [
      'modulo_admin',
      'modulo_secretaria',
      'modulo_cadastros',
      'modulo_visitacao',
      'modulo_visitacao_coordenar',
      'modulo_visitacao_duplas',
      'modulo_coordenador',
    ];
    const [isAdminResult, ...permissionResults] = await Promise.all([
      authClient.rpc('is_admin', { check_user: userData.user.id }),
      ...permissionKeys.map((permissionKey) =>
        authClient.rpc('has_permission', {
          check_user: userData.user.id,
          permission_key: permissionKey,
        })
      ),
    ]);
    if (isAdminResult.data !== true
      && !permissionResults.some((result) => result.data === true)) {
      return jsonResponse(403, { error: 'Sem permissão para geolocalizar endereços.' });
    }

    const body = await request.json() as { address?: unknown; force?: unknown; personId?: unknown };
    const personId = typeof body.personId === 'string' ? body.personId : null;
    let address = cleanAddress(body.address);
    let persistedPersonId: string | null = null;
    if (personId) {
      const { data: target, error: targetError } = await serviceClient
        .from('participacoes')
        .select('encontro_id, equipe_id, participante, pessoas!inner(id, endereco, numero, complemento, cep, bairro, cidade, estado), encontros!inner(ativo)')
        .eq('pessoa_id', personId)
        .eq('participante', false)
        .eq('encontros.ativo', true)
        .limit(1)
        .maybeSingle();
      const targetPerson = Array.isArray(target?.pessoas) ? target?.pessoas[0] : target?.pessoas;
      if (targetError || !target || !target.equipe_id || !targetPerson) {
        return jsonResponse(404, { error: 'Integrante não encontrado no encontro ativo.' });
      }
      const { data: canCoordinate } = await authClient.rpc('is_coordenador_da_equipe', {
        check_encontro_id: target.encontro_id,
        check_equipe_id: target.equipe_id,
        check_user: userData.user.id,
      });
      if (isAdminResult.data !== true && canCoordinate !== true) {
        return jsonResponse(403, { error: 'Sem permissão para atualizar este integrante.' });
      }
      address = cleanAddress(targetPerson);
      if (address?.cidade && normalize(address.cidade) === 'franca' && !address.estado) {
        address.estado = 'SP';
      }
      persistedPersonId = personId;
    }
    const force = Boolean(personId) || body.force === true;
    const missingAddressCode = !address?.endereco
      ? 'missing_street'
      : !address.cidade
        ? 'missing_city'
        : !address.estado
          ? 'missing_state'
          : null;
    if (missingAddressCode && !persistedPersonId) {
      return jsonResponse(400, { error: 'Informe logradouro, cidade e estado.' });
    }

    let queryAddress = { ...address! };
    let cepResolutionFailure: CepResolution['failureCode'] = null;
    if (!missingAddressCode && !address!.cep) {
      const resolution = await findCepByAddress(address!);
      cepResolutionFailure = resolution.failureCode;
      if (resolution.address) {
        address = { ...address!, cep: resolution.address.cep };
        queryAddress = {
          ...queryAddress,
          endereco: resolution.address.endereco ?? queryAddress.endereco,
          bairro: resolution.address.bairro ?? queryAddress.bairro,
          cidade: resolution.address.cidade ?? queryAddress.cidade,
          estado: resolution.address.estado ?? queryAddress.estado,
          cep: resolution.address.cep,
        };
      }
    }

    const { data: fingerprint, error: fingerprintError } = await serviceClient
      .rpc('build_address_fingerprint', {
        p_endereco: address?.endereco,
        p_numero: address?.numero,
        p_complemento: address?.complemento,
        p_cep: address?.cep,
        p_bairro: address?.bairro,
        p_cidade: address?.cidade,
        p_estado: address?.estado,
      });
    if (fingerprintError || typeof fingerprint !== 'string') {
      return jsonResponse(500, { error: 'Não foi possível identificar o endereço.' });
    }

    if (!force) {
      const { data: cached } = await serviceClient
        .from('geocoding_cache')
        .select('result')
        .eq('address_fingerprint', fingerprint)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (cached?.result) {
        return jsonResponse(200, { ...cached.result, cached: true });
      }
    }

    const persistPersonResult = async (result: GeocodingResult) => {
      if (!persistedPersonId) return false;
      const candidate = result.candidate;
      const update: Record<string, unknown> = {
        geo_failure_code: candidate ? null : result.failureCode,
        geo_checked_at: result.checkedAt,
      };
      if (address?.estado) update.estado = address.estado;
      if (address?.cep) update.cep = address.cep;
      if (candidate) {
        update.geo_reference_latitude = candidate.latitude;
        update.geo_reference_longitude = candidate.longitude;
        update.geo_reference_source = candidate.source;
        update.geo_reference_precision = candidate.precision;
        update.geo_reference_address_fingerprint = fingerprint;
        update.geo_reference_checked_at = result.checkedAt;
      }
      const { error: updateError } = await serviceClient
        .from('pessoas')
        .update(update)
        .eq('id', persistedPersonId);
      if (updateError) throw new Error('person_geolocation_update_failed');
      return true;
    };

    if (missingAddressCode) {
      const result = failureResult(fingerprint, missingAddressCode, false, null);
      await persistPersonResult(result);
      return jsonResponse(200, { ...result, persisted: true });
    }

    if (address!.cep && digits(address!.cep).length === 8) {
      const viaCep = await queryViaCep(address!.cep);
      if (viaCep) {
        if ((address!.cidade && !textMatches(address!.cidade, viaCep.cidade))
          || (address!.estado && !textMatches(address!.estado, viaCep.estado))) {
          const result = failureResult(fingerprint, 'cep_address_mismatch', false, null);
          await persistPersonResult(result);
          await serviceClient.from('geocoding_cache').upsert({
            address_fingerprint: fingerprint,
            status: result.status,
            provider: null,
            result,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          });
          return jsonResponse(200, { ...result, persisted: Boolean(persistedPersonId) });
        }
        queryAddress = {
          ...queryAddress,
          endereco: queryAddress.endereco || viaCep.endereco,
          bairro: queryAddress.bairro || viaCep.bairro,
          cidade: queryAddress.cidade || viaCep.cidade,
          estado: queryAddress.estado || viaCep.estado,
        };
      }
    }

    const publicAppUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://www.ejccapelinha.com.br';
    const userAgent = Deno.env.get('GEOCODING_USER_AGENT')
      || `SistemaEJCCapelinha/1.0 (+${publicAppUrl})`;
    const nominatim = await queryNominatim(serviceClient, queryAddress, userAgent);
    const cepCandidate = address!.cep
      ? await queryCepCandidates(address!.cep, Deno.env.get('CEP_ABERTO_TOKEN'))
      : null;
    const candidate = nominatim.candidate ?? cepCandidate;
    const failureCode = nominatim.unavailable && !candidate
      ? 'provider_unavailable'
      : cepResolutionFailure && !candidate
        ? cepResolutionFailure
        : 'manual_confirmation_required';
    const result = failureResult(
      fingerprint,
      failureCode,
      failureCode === 'provider_unavailable',
      candidate,
    );

    const persisted = await persistPersonResult(result);

    const ttlMs = result.status === 'verified'
      ? 180 * 24 * 60 * 60 * 1000
      : result.retryable ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const { error: cacheError } = await serviceClient.from('geocoding_cache').upsert({
      address_fingerprint: fingerprint,
      status: result.status,
      provider: result.source ?? result.candidate?.source ?? null,
      result,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (cacheError) console.error('[geocode-address] cache write failed');
    return jsonResponse(200, { ...result, persisted });
  } catch (error) {
    console.error('[geocode-address] request failed', error instanceof Error ? error.name : 'unknown');
    return jsonResponse(500, { error: 'Erro inesperado ao geolocalizar endereço.' });
  }
});
