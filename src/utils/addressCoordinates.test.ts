import { describe, expect, it } from 'vitest';
import { resolveAddressCoordinates } from './addressCoordinates';

describe('resolveAddressCoordinates', () => {
  it('usa a nova localização quando o endereço é encontrado', () => {
    expect(resolveAddressCoordinates([1, 2], true, 3, 4)).toEqual([1, 2]);
  });

  it('limpa a localização antiga quando o endereço mudou e não foi localizado', () => {
    expect(resolveAddressCoordinates(null, true, 3, 4)).toEqual([null, null]);
  });

  it('preserva a localização quando o endereço não mudou', () => {
    expect(resolveAddressCoordinates(null, false, 3, 4)).toEqual([3, 4]);
  });
});
