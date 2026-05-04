/**
 * Centralized Geocoding Utility for Sistema EJC
 * Handles Nominatim and AwesomeAPI calls with rate limiting and local caching.
 */

const GEO_CACHE_KEY = 'ejc_geocoding_cache';

/**
 * Gets the cache from localStorage
 */
function getCache(): Record<string, [number, number]> {
  try {
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

/**
 * Saves a result to the local cache
 */
function saveToCache(address: string, coords: [number, number]) {
  try {
    const cache = getCache();
    cache[address] = coords;
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save to geocode cache', e);
  }
}

/**
 * Adds a tiny random jitter to coordinates to prevent overlapping markers
 */
export function applyJitter(coords: [number, number]): [number, number] {
  const jitter = () => (Math.random() - 0.5) * 0.0002;
  return [coords[0] + jitter(), coords[1] + jitter()];
}

/**
 * Normalizes a string by removing diacritics (accents).
 */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Tries to find a CEP using address components via ViaCEP.
 * Useful when the participant didn't provide a CEP but we have street/city.
 */
export async function findCEPByAddress(p: {
  endereco: string;
  cidade: string;
  uf: string;
}): Promise<string | null> {
  // Remove numbers and extra info for better street matching
  const cleanStreet = p.endereco.split(',')[0].replace(/[0-9]/g, '').trim();
  if (cleanStreet.length < 3) return null;

  const cacheKey = `findcep_${p.uf}_${p.cidade}_${cleanStreet}`.toLowerCase().replace(/\s+/g, '_');
  const cache = getCache();
  if (cache[cacheKey as any]) return (cache[cacheKey as any] as any);

  try {
    const url = `https://viacep.com.br/ws/${p.uf}/${encodeURIComponent(p.cidade)}/${encodeURIComponent(cleanStreet)}/json/`;
    console.log('[geocoding] ViaCEP fetch (Address -> CEP):', url);
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        // Return the first match's CEP
        const foundCEP = data[0].cep.replace(/\D/g, '');
        // We reuse the cache structure but store strings for CEPs
        const currentCache = getCache();
        (currentCache as any)[cacheKey] = foundCEP;
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(currentCache));
        return foundCEP;
      }
    }
    return null;
  } catch (err) {
    console.error('[geocoding] ViaCEP error:', err);
    return null;
  }
}

/**
 * Geocodes by CEP using AwesomeAPI (highly reliable for Brazil)
 */
export async function geocodeByCEP(cep: string): Promise<[number, number] | null> {
  const cleanCEP = cep.replace(/\D/g, '');
  if (cleanCEP.length !== 8) return null;

  const cache = getCache();
  const cacheKey = `cep_${cleanCEP}`;
  if (cache[cacheKey]) return cache[cacheKey];

  try {
    console.log('[geocoding] AwesomeAPI fetch (CEP):', cleanCEP);
    const response = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCEP}`);
    if (response.ok) {
      const data = await response.json();
      if (data.lat && data.lng) {
        const coords: [number, number] = [parseFloat(data.lat), parseFloat(data.lng)];
        saveToCache(cacheKey, coords);
        return coords;
      }
    }
    return null;
  } catch (err) {
    console.error('[geocoding] AwesomeAPI error:', err);
    return null;
  }
}

/**
 * Fetches address data by CEP using ViaCEP.
 */
export async function getAddressByCEP(cep: string): Promise<{
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
} | null> {
  const cleanCEP = cep.replace(/\D/g, '');
  if (cleanCEP.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    if (response.ok) {
      const data = await response.json();
      if (!data.erro) {
        return {
          endereco: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || ''
        };
      }
    }
    return null;
  } catch (err) {
    console.error('[geocoding] ViaCEP error:', err);
    return null;
  }
}

/**
 * Geocodes an address using the Nominatim structured search endpoint.
 * Structured search has significantly better coverage than free-text q=.
 */
async function geocodeStructured(params: {
  street?: string | null;
  city?: string | null;
  state?: string;
  postalcode?: string | null;
}): Promise<[number, number] | null> {
  const qs = new URLSearchParams({
    format: 'json',
    limit: '1',
    countrycodes: 'br',
    addressdetails: '1',
  });
  if (params.street) qs.set('street', params.street);
  if (params.city) qs.set('city', params.city);
  if (params.state) qs.set('state', params.state);
  if (params.postalcode) qs.set('postalcode', params.postalcode);

  const url = `https://nominatim.openstreetmap.org/search?${qs.toString()}`;
  const cacheKey = url;

  const cache = getCache();
  if (cache[cacheKey]) {
    console.log('[geocoding] cache hit (structured):', cacheKey);
    return cache[cacheKey];
  }

  try {
    console.log('[geocoding] structured fetch:', url);
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR' },
    });
    if (response.status === 429) {
      console.warn('[geocoding] rate limited (429).');
      return null;
    }
    const data = await response.json();
    console.log('[geocoding] structured result →', data.length > 0 ? data[0] : 'empty');
    if (data && data.length > 0) {
      const result = data[0];
      // Reject if it's just a city/state/country result
      const lowPrecisionTypes = ['city', 'town', 'village', 'state', 'administrative', 'country'];
      if (lowPrecisionTypes.includes(result.type) || lowPrecisionTypes.includes(result.class)) {
        console.warn('[geocoding] ignoring low precision result (city/state center):', result.type);
        return null;
      }

      const coords: [number, number] = [parseFloat(result.lat), parseFloat(result.lon)];
      saveToCache(cacheKey, coords);
      return coords;
    }
    return null;
  } catch (err) {
    console.error('[geocoding] structured error:', err);
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (!address || address.trim().length < 5) return null;

  const cache = getCache();
  if (cache[address]) {
    console.log('[geocoding] cache hit:', address);
    return cache[address];
  }

  try {
    console.log('[geocoding] fetching:', address);
    // Nominatim API requires 1 request per second
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );

    if (response.status === 429) {
      console.warn('[geocoding] rate limited (429).');
      return null;
    }

    const data = await response.json();
    console.log('[geocoding] result for', address, '→', data.length > 0 ? data[0] : 'empty');
    if (data && data.length > 0) {
      const result = data[0];
      // Reject if it's just a city/state/country result
      const lowPrecisionTypes = ['city', 'town', 'village', 'state', 'administrative', 'country'];
      if (lowPrecisionTypes.includes(result.type) || lowPrecisionTypes.includes(result.class)) {
        console.warn('[geocoding] ignoring low precision result (city/state center):', result.type);
        return null;
      }

      const coords: [number, number] = [parseFloat(result.lat), parseFloat(result.lon)];
      saveToCache(address, coords);
      return coords;
    }

    return null;
  } catch (error) {
    console.error('[geocoding] error:', error);
    return null;
  }
}

/**
 * Builds a list of address variants to try, from most to least specific.
 */
export function constructAddressVariants(p: {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}): string[] {
  const { endereco, numero, bairro, cidade, estado } = p;
  if (!endereco) return [];

  const targetEstado = estado || 'SP';
  const seen = new Set<string>();
  const variants: string[] = [];

  const add = (parts: (string | null | undefined)[]) => {
    const v = parts.filter(Boolean).join(', ');
    if (v && !seen.has(v)) { seen.add(v); variants.push(v); }
  };

  add([endereco, numero, bairro, cidade, targetEstado, 'Brasil']);
  add([endereco, numero, cidade, targetEstado, 'Brasil']);
  add([endereco, bairro, cidade, targetEstado, 'Brasil']);
  add([endereco, cidade, targetEstado, 'Brasil']);
  add([endereco, targetEstado, 'Brasil']);

  return variants;
}

const UF_TO_NAME: Record<string, string> = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
  'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
  'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
  'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
  'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
  'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
  'SE': 'Sergipe', 'TO': 'Tocantins'
};

/**
 * Geocodes using multiple strategies, returning the first successful hit:
 *  1. AwesomeAPI (by CEP) - Phase 0 (New)
 *  2. Free-text variants (rua + numero + bairro + cidade combos)
 *  3. Nominatim structured search (street=, city=, state=)
 *  4. Accent-normalized structured search
 */
export async function geocodeWithFallback(p: {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  cep?: string | null;
  estado?: string | null;
}): Promise<[number, number] | null> {
  const delay = () => new Promise(resolve => setTimeout(resolve, 1100));
  const stateName = p.estado ? (UF_TO_NAME[p.estado.toUpperCase()] || p.estado) : 'São Paulo';
  console.log('[geocoding] Starting fallback pipeline for:', p.endereco, p.cidade, p.estado);

  // ── Phase -1: ViaCEP (Address -> CEP) ──────────────────────────
  let targetCEP = p.cep ? p.cep.replace(/\D/g, '') : '';
  
  if (targetCEP.length !== 8 && p.endereco && p.cidade) {
    console.log('[geocoding] Phase -1: CEP missing or invalid. Trying to find CEP via Address...');
    const foundCEP = await findCEPByAddress({
      endereco: p.endereco,
      cidade: p.cidade,
      uf: p.estado || 'SP'
    });
    if (foundCEP) {
      console.log('[geocoding] Found CEP:', foundCEP);
      targetCEP = foundCEP;
    }
  }

  // ── Phase 0: AwesomeAPI (By CEP) ─────────────────────────────
  // This is the fastest and most reliable for Brazilian CEPs.
  if (targetCEP) {
    console.log('[geocoding] Phase 0: Trying AwesomeAPI (CEP)...');
    const cepResult = await geocodeByCEP(targetCEP);
    if (cepResult) return cepResult;
  }

  // ── Phase 1: High-Precision Structured (CEP + Number) ────────
  if (targetCEP && p.endereco) {
    console.log('[geocoding] Phase 1: Trying Structured Nominatim (CEP + Number)...');
    const streetWithNum = [p.endereco, p.numero].filter(Boolean).join(', ');
    const hpResult = await geocodeStructured({
      street: streetWithNum,
      city: p.cidade ?? undefined,
      state: stateName,
      postalcode: targetCEP
    });
    if (hpResult) return hpResult;
  }

  // ── Phase 2: free-text variants ───────────────────────────────
  console.log('[geocoding] Phase 2: Trying free-text variants...');
  const variants = constructAddressVariants(p);
  for (let i = 0; i < variants.length; i++) {
    console.log(`[geocoding] Trying variant ${i + 1}/${variants.length}:`, variants[i]);
    const result = await geocodeAddress(variants[i]);
    if (result) return result;
    if (i < variants.length - 1) await delay();
  }

  // ── Phase 3: Nominatim structured search ─────────────────────
  if (p.endereco) {
    console.log('[geocoding] Phase 3: Trying Structured Nominatim (No CEP)...');
    await delay();
    const streetWithNum = [p.endereco, p.numero].filter(Boolean).join(', ');
    const r1 = await geocodeStructured({ street: streetWithNum, city: p.cidade ?? undefined, state: stateName });
    if (r1) return r1;

    if (p.numero) {
      await delay();
      const r2 = await geocodeStructured({ street: p.endereco, city: p.cidade ?? undefined, state: stateName });
      if (r2) return r2;
    }

    // ── Phase 4: accent-normalized structured search ────────────
    console.log('[geocoding] Phase 4: Trying Accent-Normalized Structured...');
    await delay();
    const normStreet = p.endereco.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normCity = p.cidade ? p.cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : undefined;
    if (normStreet !== p.endereco || normCity !== p.cidade) {
      const r3 = await geocodeStructured({ street: normStreet, city: normCity, state: stateName });
      if (r3) return r3;
    }
  }

  console.warn('[geocoding] All phases failed for:', p);
  return null;
}
