import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock, rpcMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: invokeMock },
    rpc: rpcMock,
  },
}));

import { geolocationService, getAddressFingerprint } from './geolocationService';
import { hasRegionalAddress } from '../types/geolocation';

describe('geolocationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('aceita endereço regional sem número residencial', () => {
    expect(hasRegionalAddress({ endereco: 'Rua Um', cidade: 'Franca', estado: 'SP' })).toBe(true);
    expect(hasRegionalAddress({ endereco: 'Rua Um', cidade: 'Franca', estado: '' })).toBe(false);
  });

  it('normaliza endereço antes de obter o fingerprint', async () => {
    rpcMock.mockResolvedValue({ data: 'fingerprint-1', error: null });

    await expect(getAddressFingerprint({
      endereco: '  Rua Um ',
      numero: ' 10 ',
      cep: '14400-000',
      estado: 'sp',
    })).resolves.toBe('fingerprint-1');

    expect(rpcMock).toHaveBeenCalledWith('build_address_fingerprint', {
      p_endereco: 'Rua Um',
      p_numero: '10',
      p_complemento: null,
      p_cep: '14400000',
      p_bairro: null,
      p_cidade: null,
      p_estado: 'SP',
    });
  });

  it('converte um candidato público apenas em referência regional aproximada', () => {
    expect(geolocationService.regionalReferenceFromResult({
      status: 'failed',
      addressFingerprint: 'fingerprint-1',
      latitude: null,
      longitude: null,
      source: null,
      precision: null,
      checkedAt: '2026-08-17T12:00:00.000Z',
      failureCode: 'manual_confirmation_required',
      retryable: false,
      candidate: { latitude: -20.5, longitude: -47.4, source: 'nominatim', precision: 'street' },
      cached: false,
    })).toMatchObject({
      geo_reference_latitude: -20.5,
      geo_reference_longitude: -47.4,
      geo_reference_source: 'nominatim',
      geo_reference_precision: 'street',
      geo_reference_address_fingerprint: 'fingerprint-1',
    });
  });

  it('mantém a referência nula quando nenhum candidato é encontrado', () => {
    const metadata = geolocationService.regionalReferenceFromResult({
      status: 'failed',
      addressFingerprint: 'fingerprint-2',
      latitude: null,
      longitude: null,
      source: null,
      precision: null,
      checkedAt: '2026-08-17T12:00:00.000Z',
      failureCode: 'provider_unavailable',
      retryable: true,
      candidate: null,
      cached: false,
    });

    expect(metadata).toMatchObject({
      geo_reference_latitude: null,
      geo_reference_longitude: null,
      geo_reference_source: null,
      geo_reference_precision: null,
    });
  });

  it('rejeita contrato incompleto da Edge Function', async () => {
    invokeMock.mockResolvedValue({ data: { status: 'verified' }, error: null });
    await expect(geolocationService.geocode({ endereco: 'Rua Um' }))
      .rejects.toThrow('resposta incompleta');
  });

  it('não promove nem mesmo um resultado legado verificado a coordenada exata', async () => {
    invokeMock.mockResolvedValue({
      data: {
        status: 'verified',
        addressFingerprint: 'fingerprint-3',
        latitude: -20.5,
        longitude: -47.4,
        source: 'nominatim',
        precision: 'house_number',
        checkedAt: '2026-08-17T12:00:00.000Z',
        failureCode: null,
        retryable: false,
        candidate: null,
        cached: false,
      },
      error: null,
    });

    await expect(geolocationService.resolveRegionalReferenceForPersistence({ endereco: 'Rua Um', numero: '10' }))
      .resolves.toMatchObject({
        update: {
          geo_reference_latitude: -20.5,
          geo_reference_longitude: -47.4,
          geo_reference_precision: 'street',
        },
      });
  });

  it('mantém referência nula quando o provedor fica indisponível', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'offline' } });
    rpcMock.mockResolvedValue({ data: 'fingerprint-4', error: null });

    await expect(geolocationService.resolveRegionalReferenceForPersistence({ endereco: 'Rua Um', numero: '10' }))
      .resolves.toMatchObject({
        update: {
          geo_reference_latitude: null,
          geo_reference_longitude: null,
        },
      });
  });
});
