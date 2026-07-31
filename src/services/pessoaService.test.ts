import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMock, eqMock, selectMock, singleMock, fromMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

import { normalizarPessoaUpdate, pessoaService } from './pessoaService';

describe('pessoaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleMock.mockResolvedValue({
      data: { id: 'pessoa-1', nome_completo: 'Ana Silva' },
      error: null,
    });
    selectMock.mockReturnValue({ single: singleMock });
    eqMock.mockReturnValue({ select: selectMock });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
  });

  it('normaliza somente campos pessoais e preserva atualizações parciais', () => {
    expect(normalizarPessoaUpdate({
      nome_completo: '  Ana Silva  ',
      cpf: '123.456.789-00',
      telefone: '(35) 99999-0000',
      cep: '37270-000',
      email: '  ana@example.com  ',
    })).toEqual({
      nome_completo: 'Ana Silva',
      cpf: '12345678900',
      telefone: '35999990000',
      cep: '37270000',
      email: 'ana@example.com',
    });
  });

  it('não envia vínculo de encontro quando uma tela edita a pessoa', async () => {
    await pessoaService.atualizar('pessoa-1', {
      nome_completo: '  Ana Silva  ',
      email: 'ana@example.com',
    });

    expect(updateMock).toHaveBeenCalledWith({
      nome_completo: 'Ana Silva',
      email: 'ana@example.com',
    });
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('participante');
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('encontro_id');
  });
});
