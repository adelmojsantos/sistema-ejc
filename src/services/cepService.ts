export interface CepAddress {
  cep?: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface ViaCepResponse {
  cep?: unknown;
  logradouro?: unknown;
  bairro?: unknown;
  localidade?: unknown;
  uf?: unknown;
  erro?: unknown;
}

function normalizeResult(data: ViaCepResponse): CepAddress {
  return {
    cep: typeof data.cep === 'string' ? data.cep.replace(/\D/g, '') : undefined,
    endereco: typeof data.logradouro === 'string' ? data.logradouro : '',
    bairro: typeof data.bairro === 'string' ? data.bairro : '',
    cidade: typeof data.localidade === 'string' ? data.localidade : '',
    estado: typeof data.uf === 'string' ? data.uf : '',
  };
}

const STREET_STOP_WORDS = new Set([
  'alameda', 'avenida', 'av', 'estrada', 'largo', 'praca', 'rodovia', 'rua',
  'travessa', 'viela', 'da', 'das', 'de', 'do', 'dos', 'e',
]);

function normalizedWords(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STREET_STOP_WORDS.has(word));
}

async function queryAddress(
  estado: string,
  cidade: string,
  endereco: string,
): Promise<CepAddress[]> {
  const path = [estado, cidade, endereco].map(encodeURIComponent).join('/');
  const response = await fetch(`https://viacep.com.br/ws/${path}/json/`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [];

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) return [];

  const unique = new Map<string, CepAddress>();
  for (const item of payload) {
    if (!item || typeof item !== 'object') continue;
    const result = normalizeResult(item as ViaCepResponse);
    if (result.cep?.length !== 8 || !result.endereco || !result.cidade || !result.estado) continue;
    unique.set(result.cep, result);
  }
  return [...unique.values()];
}

export async function getAddressByCEP(cep: string): Promise<CepAddress | null> {
  const cleanCEP = cep.replace(/\D/g, '');
  if (cleanCEP.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const data = await response.json() as ViaCepResponse;
    if (data.erro === true) return null;
    const result = normalizeResult(data);
    const { cep: _cep, ...address } = result;
    return address;
  } catch {
    return null;
  }
}

export async function findCEPsByAddress(
  estado: string,
  cidade: string,
  endereco: string,
): Promise<CepAddress[]> {
  const cleanState = estado.trim().toUpperCase();
  const cleanCity = cidade.trim();
  const cleanStreet = endereco.trim();
  if (!/^[A-Z]{2}$/.test(cleanState) || cleanCity.length < 3 || cleanStreet.length < 3) {
    return [];
  }

  try {
    const directResults = await queryAddress(cleanState, cleanCity, cleanStreet);
    if (directResults.length > 0) return directResults;

    // O índice reverso do ViaCEP pode falhar com nomes compostos ou hifenizados.
    // Fazemos no máximo uma consulta adicional e validamos todos os termos para
    // não transformar uma busca ampla em sugestão de CEP incorreto.
    const expectedWords = normalizedWords(cleanStreet);
    const fallbackTerm = [...expectedWords].sort((left, right) => right.length - left.length)[0];
    if (!fallbackTerm || fallbackTerm === cleanStreet.toLowerCase()) return [];

    const fallbackResults = await queryAddress(cleanState, cleanCity, fallbackTerm);
    return fallbackResults.filter((result) => {
      const resultWords = new Set(normalizedWords(result.endereco));
      return expectedWords.every((word) => resultWords.has(word));
    });
  } catch {
    return [];
  }
}
