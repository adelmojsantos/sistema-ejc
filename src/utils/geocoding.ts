/**
 * Centralized Geocoding Utility for Sistema EJC
 * Handles Nominatim API calls with rate limiting and local caching.
 */

const GEO_CACHE_KEY = 'ejc_geocoding_cache';

/**
 * Gets the cache from localStorage
 */
function getCache(): Record<string, [number, number]> {
  try {
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch (e) {
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
 * Geocodes a text address to [lat, lng]
 */
/**
 * Normalizes a string by removing diacritics (accents).
 */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Geocodes an address using the Nominatim structured search endpoint.
 * Structured search has significantly better coverage than free-text q=.
 */
async function geocodeStructured(params: {
  street?: string | null;
  city?: string | null;
  state?: string;
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
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
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
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
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
 * Nominatim often fails when the bairro name is unrecognized — so we try
 * progressively simpler versions of the address.
 */
export function constructAddressVariants(p: {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
}): string[] {
  const { endereco, numero, bairro, cidade } = p;
  if (!endereco) return [];

  const seen = new Set<string>();
  const variants: string[] = [];

  const add = (parts: (string | null | undefined)[]) => {
    const v = parts.filter(Boolean).join(', ');
    if (v && !seen.has(v)) { seen.add(v); variants.push(v); }
  };

  // 1. Rua, Número, Bairro, Cidade, SP, Brasil (mais específico)
  add([endereco, numero, bairro, cidade, 'SP', 'Brasil']);
  // 2. Rua, Número, Cidade, SP, Brasil (sem bairro)
  add([endereco, numero, cidade, 'SP', 'Brasil']);
  // 3. Rua, Bairro, Cidade, SP, Brasil (sem número)
  add([endereco, bairro, cidade, 'SP', 'Brasil']);
  // 4. Rua, Cidade, SP, Brasil (só rua + cidade)
  add([endereco, cidade, 'SP', 'Brasil']);
  // 5. Rua, SP, Brasil (última tentativa)
  add([endereco, 'SP', 'Brasil']);

  console.log('[geocoding] variants to try:', variants);
  return variants;
}

/**
 * Helper to construct a full address string for geocoding (legacy compat).
 */
export function constructFullAddress(p: { endereco?: string | null, numero?: string | null, bairro?: string | null, cidade?: string | null }): string {
  return constructAddressVariants(p)[0] ?? '';
}

/**
 * Geocodes using multiple strategies, returning the first successful hit:
 *  1. Free-text variants (rua + numero + bairro + cidade combos)
 *  2. Nominatim structured search (street=, city=, state=) — better coverage
 *  3. Accent-normalized structured search
 *  4. City-only structured search (approximate fallback)
 */
export async function geocodeWithFallback(p: {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
}): Promise<[number, number] | null> {
  const delay = () => new Promise(resolve => setTimeout(resolve, 1100));

  // ── Phase 1: free-text variants ───────────────────────────────
  const variants = constructAddressVariants(p);
  for (let i = 0; i < variants.length; i++) {
    const result = await geocodeAddress(variants[i]);
    if (result) return result;
    if (i < variants.length - 1) await delay();
  }

  // ── Phase 2: Nominatim structured search ─────────────────────
  if (p.endereco) {
    await delay();
    const streetWithNum = [p.endereco, p.numero].filter(Boolean).join(', ');
    const r1 = await geocodeStructured({ street: streetWithNum, city: p.cidade ?? undefined, state: 'São Paulo' });
    if (r1) return r1;

    // Without number
    if (p.numero) {
      await delay();
      const r2 = await geocodeStructured({ street: p.endereco, city: p.cidade ?? undefined, state: 'São Paulo' });
      if (r2) return r2;
    }

    // ── Phase 3: accent-normalized structured search ────────────
    await delay();
    const normStreet = normalize(streetWithNum);
    const normCity = p.cidade ? normalize(p.cidade) : undefined;
    if (normStreet !== streetWithNum || normCity !== p.cidade) {
      const r3 = await geocodeStructured({ street: normStreet, city: normCity, state: 'Sao Paulo' });
      if (r3) return r3;
    }
  }

  // ── Phase 4: city-only (approximate — at least pins the city) ─
  if (p.cidade) {
    await delay();
    const r4 = await geocodeStructured({ city: p.cidade, state: 'São Paulo' });
    if (r4) return r4;
  }

  return null;
}

