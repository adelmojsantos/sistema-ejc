/**
 * Centralized Geocoding Utility for Sistema EJC
 * Handles Nominatim API calls with rate limiting and local caching.
 */

interface GeocodeResult {
  lat: number;
  lng: number;
}

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
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (!address || address.trim().length < 5) return null;

  const cache = getCache();
  if (cache[address]) {
    return cache[address];
  }

  try {
    // Nominatim API requires 1 request per second
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    
    if (response.status === 429) {
      console.warn('Geocoding rate limited (429).');
      return null;
    }

    const data = await response.json();
    if (data && data.length > 0) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      saveToCache(address, coords);
      return coords;
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Helper to construct a full address string for geocoding
 */
export function constructFullAddress(p: { endereco?: string | null, numero?: string | null, bairro?: string | null, cidade?: string | null }): string {
  const parts = [];
  if (p.endereco) parts.push(p.endereco);
  if (p.numero) parts.push(p.numero);
  if (p.bairro) parts.push(p.bairro);
  if (p.cidade) parts.push(p.cidade);
  parts.push('SP', 'Brasil');
  return parts.join(', ');
}
