import { afterEach, describe, expect, it, vi } from 'vitest';
import { findCEPsByAddress, getAddressByCEP } from './cepService';

describe('cepService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('não consulta CEP incompleto', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getAddressByCEP('123')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normaliza somente os campos esperados da resposta do ViaCEP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        logradouro: 'Rua Um',
        bairro: 'Centro',
        localidade: 'Franca',
        uf: 'SP',
        latitude: '-20.5',
      }),
    }));

    await expect(getAddressByCEP('14400-000')).resolves.toEqual({
      endereco: 'Rua Um',
      bairro: 'Centro',
      cidade: 'Franca',
      estado: 'SP',
    });
  });

  it('retorna nulo para CEP inexistente ou falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ erro: true }),
    }));
    await expect(getAddressByCEP('00000000')).resolves.toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(getAddressByCEP('14400000')).resolves.toBeNull();
  });

  it('não faz busca reversa sem UF, cidade e logradouro válidos', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(findCEPsByAddress('', 'Franca', 'Rua Pérola')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('busca e remove CEPs duplicados pelo endereço sem enviar o número', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { cep: '14406-123', logradouro: 'Rua Pérola', bairro: 'Jardim', localidade: 'Franca', uf: 'SP' },
        { cep: '14406-123', logradouro: 'Rua Pérola', bairro: 'Jardim', localidade: 'Franca', uf: 'SP' },
      ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(findCEPsByAddress('sp', 'Franca', 'Rua Pérola')).resolves.toEqual([{
      cep: '14406123',
      endereco: 'Rua Pérola',
      bairro: 'Jardim',
      cidade: 'Franca',
      estado: 'SP',
    }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/SP/Franca/Rua%20P%C3%A9rola/json/',
      expect.any(Object),
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('2040');
  });

  it('usa termo significativo quando o ViaCEP falha com logradouro hifenizado', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { cep: '14403-156', logradouro: 'Rua do Bem Querer', bairro: 'Residencial Paraíso', localidade: 'Franca', uf: 'SP' },
          { cep: '14404-017', logradouro: 'Rua dos Bem-te-vis', bairro: 'Jardim Primavera', localidade: 'Franca', uf: 'SP' },
        ]),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(findCEPsByAddress('SP', 'Franca', 'Rua dos Bem-te-vis')).resolves.toEqual([{
      cep: '14404017',
      endereco: 'Rua dos Bem-te-vis',
      bairro: 'Jardim Primavera',
      cidade: 'Franca',
      estado: 'SP',
    }]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://viacep.com.br/ws/SP/Franca/bem/json/',
      expect.any(Object),
    );
  });
});
