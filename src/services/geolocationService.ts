import { supabase } from '../lib/supabase';
import type {
  AddressInput,
  GeocodingResult,
  PersonGeolocationMetadata,
} from '../types/geolocation';

interface AddressFingerprintRpcResult {
  data: string | null;
  error: { message?: string } | null;
}

function cleanAddress(address: AddressInput): AddressInput {
  const cleanText = (value: string | null | undefined) => value?.trim() || null;
  return {
    endereco: cleanText(address.endereco),
    numero: cleanText(address.numero),
    complemento: cleanText(address.complemento),
    cep: address.cep?.replace(/\D/g, '') || null,
    bairro: cleanText(address.bairro),
    cidade: cleanText(address.cidade),
    estado: cleanText(address.estado)?.toUpperCase() || null,
  };
}

export async function getAddressFingerprint(address: AddressInput): Promise<string> {
  const clean = cleanAddress(address);
  const { data, error } = await supabase.rpc('build_address_fingerprint', {
    p_endereco: clean.endereco,
    p_numero: clean.numero,
    p_complemento: clean.complemento,
    p_cep: clean.cep,
    p_bairro: clean.bairro,
    p_cidade: clean.cidade,
    p_estado: clean.estado,
  }) as AddressFingerprintRpcResult;

  if (error || !data) {
    throw new Error(error?.message || 'Não foi possível identificar a versão do endereço.');
  }
  return data;
}

function validateResult(value: unknown): GeocodingResult {
  if (!value || typeof value !== 'object') {
    throw new Error('O serviço de geolocalização retornou uma resposta inválida.');
  }

  const result = value as Partial<GeocodingResult>;
  if ((result.status !== 'verified' && result.status !== 'failed')
    || typeof result.addressFingerprint !== 'string'
    || typeof result.checkedAt !== 'string') {
    throw new Error('O serviço de geolocalização retornou uma resposta incompleta.');
  }

  return result as GeocodingResult;
}

export const geolocationService = {
  async geocodeTeamMember(personId: string, force = true): Promise<GeocodingResult> {
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: { personId, force },
    });
    if (error) throw new Error('Não foi possível atualizar a localização do integrante.');
    return validateResult(data);
  },
  async geocode(address: AddressInput, force = false): Promise<GeocodingResult> {
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: { address: cleanAddress(address), force },
    });

    if (error) {
      throw new Error('Não foi possível consultar o serviço de geolocalização.');
    }
    return validateResult(data);
  },

  async verifiedMetadata(
    address: AddressInput,
    source: 'gps' | 'manual',
    accuracyM?: number | null,
    verifiedBy?: string | null,
  ): Promise<PersonGeolocationMetadata> {
    const checkedAt = new Date().toISOString();
    return {
      geo_status: 'verified',
      geo_source: source,
      geo_precision: source,
      geo_accuracy_m: accuracyM ?? null,
      geo_address_fingerprint: await getAddressFingerprint(address),
      geo_checked_at: checkedAt,
      geo_verified_at: checkedAt,
      geo_verified_by: verifiedBy ?? null,
      geo_failure_code: null,
      geo_retry_count: 0,
      geo_next_retry_at: null,
    };
  },

  regionalReferenceFromResult(result: GeocodingResult): PersonGeolocationMetadata {
    const candidate = result.candidate || (result.latitude != null
      && result.longitude != null
      && result.source
      ? {
          latitude: result.latitude,
          longitude: result.longitude,
          source: result.source,
          precision: 'street' as const,
        }
      : null);

    if (!candidate) {
      return {
        geo_reference_latitude: null,
        geo_reference_longitude: null,
        geo_reference_source: null,
        geo_reference_precision: null,
        geo_reference_address_fingerprint: null,
        geo_reference_checked_at: result.checkedAt,
      };
    }

    return {
      geo_reference_latitude: candidate.latitude,
      geo_reference_longitude: candidate.longitude,
      geo_reference_source: candidate.source,
      geo_reference_precision: candidate.precision,
      geo_reference_address_fingerprint: result.addressFingerprint,
      geo_reference_checked_at: result.checkedAt,
    };
  },

  async resolveRegionalReferenceForPersistence(address: AddressInput, force = false) {
    try {
      const result = await this.geocode(address, force);
      return {
        result,
        update: this.regionalReferenceFromResult(result),
      };
    } catch {
      const result: GeocodingResult = {
        status: 'failed',
        addressFingerprint: await getAddressFingerprint(address),
        latitude: null,
        longitude: null,
        source: null,
        precision: null,
        checkedAt: new Date().toISOString(),
        failureCode: 'provider_unavailable',
        retryable: true,
        candidate: null,
        cached: false,
      };
      return {
        result,
        update: this.regionalReferenceFromResult(result),
      };
    }
  },
};
