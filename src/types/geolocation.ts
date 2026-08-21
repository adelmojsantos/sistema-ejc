export type GeolocationStatus = 'pending' | 'verified' | 'failed' | 'legacy_review';
export type GeolocationSource = 'nominatim' | 'gps' | 'manual' | 'legacy';
export type GeolocationPrecision = 'house_number' | 'gps' | 'manual' | 'unknown';
export type RegionalGeolocationSource = 'nominatim' | 'cepaberto' | 'awesomeapi';
export type RegionalGeolocationPrecision = 'street' | 'cep';

export interface AddressInput {
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cep?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface GeolocationCandidate {
  latitude: number;
  longitude: number;
  source: 'cepaberto' | 'awesomeapi' | 'nominatim';
  precision: 'cep' | 'street';
}

export interface GeocodingResult {
  status: 'verified' | 'failed';
  addressFingerprint: string;
  latitude: number | null;
  longitude: number | null;
  source: 'nominatim' | null;
  precision: 'house_number' | null;
  checkedAt: string;
  failureCode: string | null;
  retryable: boolean;
  candidate: GeolocationCandidate | null;
  cached: boolean;
}

export interface PersonGeolocationMetadata {
  geo_status?: GeolocationStatus;
  geo_source?: GeolocationSource | null;
  geo_precision?: GeolocationPrecision | null;
  geo_accuracy_m?: number | null;
  geo_address_fingerprint?: string | null;
  geo_checked_at?: string | null;
  geo_verified_at?: string | null;
  geo_verified_by?: string | null;
  geo_failure_code?: string | null;
  geo_retry_count?: number;
  geo_next_retry_at?: string | null;
  geo_reference_latitude?: number | null;
  geo_reference_longitude?: number | null;
  geo_reference_source?: RegionalGeolocationSource | null;
  geo_reference_precision?: RegionalGeolocationPrecision | null;
  geo_reference_address_fingerprint?: string | null;
  geo_reference_checked_at?: string | null;
}

export function hasRegionalAddress(address: AddressInput): boolean {
  return Boolean(
    address.endereco?.trim()
    && address.cidade?.trim()
    && address.estado?.trim(),
  );
}

export function isRouteReadyLocation(value: PersonGeolocationMetadata & {
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  return value.geo_status === 'verified'
    && value.latitude != null
    && value.longitude != null;
}

export function hasRegionalReference(value: PersonGeolocationMetadata): boolean {
  return value.geo_reference_latitude != null
    && value.geo_reference_longitude != null
    && value.geo_reference_source != null
    && value.geo_reference_precision != null;
}

export function getPlanningCoordinate(value: PersonGeolocationMetadata & {
  latitude?: number | null;
  longitude?: number | null;
}): { latitude: number; longitude: number; exact: boolean } | null {
  if (isRouteReadyLocation(value)) {
    return { latitude: value.latitude!, longitude: value.longitude!, exact: true };
  }
  if (hasRegionalReference(value)) {
    return {
      latitude: value.geo_reference_latitude!,
      longitude: value.geo_reference_longitude!,
      exact: false,
    };
  }
  return null;
}
