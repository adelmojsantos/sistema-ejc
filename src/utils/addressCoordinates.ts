export type Coordinates = [number, number] | [null, null];

/**
 * Evita manter coordenadas antigas quando um novo endereço não pôde ser localizado.
 */
export function resolveAddressCoordinates(
  geocoded: [number, number] | null,
  addressChanged: boolean,
  existingLatitude?: number | null,
  existingLongitude?: number | null,
): Coordinates {
  if (geocoded) return geocoded;
  if (addressChanged) return [null, null];
  if (existingLatitude != null && existingLongitude != null) {
    return [existingLatitude, existingLongitude];
  }
  return [null, null];
}
