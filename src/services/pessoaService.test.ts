import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMock, eqMock, selectMock, singleMock, fromMock, rpcMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

import {
  normalizarHistoricoParticipacao,
  normalizarPessoaUpdate,
  pessoaService,
} from './pessoaService';

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
    rpcMock.mockResolvedValue({ data: null, error: null });
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

  it.each([
    {
      formato: 'objeto',
      equipes: { nome: 'Círculos' },
      encontros: { nome: '52º EJC', ativo: true, tema: 'Permanecei em mim' },
    },
    {
      formato: 'array',
      equipes: [{ nome: 'Círculos' }],
      encontros: [{ nome: '52º EJC', ativo: true, tema: 'Permanecei em mim' }],
    },
  ])('normaliza relações do histórico retornadas como $formato', ({ equipes, encontros }) => {
    expect(normalizarHistoricoParticipacao({
      id: 'participacao-1',
      participante: false,
      coordenador: true,
      equipes,
      encontros,
    })).toEqual({
      id: 'participacao-1',
      participante: false,
      coordenador: true,
      equipes: { nome: 'Círculos' },
      encontros: { nome: '52º EJC', ativo: true, tema: 'Permanecei em mim' },
    });
  });

  it('consulta o impacto antes da exclusão definitiva', async () => {
    const impacto = {
      pessoa_id: 'pessoa-1',
      nome_completo: 'Ana Silva',
      usuario_vinculado: false,
      participacoes: 2,
      cancelamentos: 1,
      visitas: 1,
      circulos: 1,
      recepcao: 0,
      recreacao: 0,
      dirigencia: 0,
    };
    rpcMock.mockResolvedValueOnce({ data: impacto, error: null });

    await expect(pessoaService.obterImpactoExclusao('pessoa-1')).resolves.toEqual(impacto);
    expect(rpcMock).toHaveBeenCalledWith('get_exclusao_pessoa_impacto', {
      p_pessoa_id: 'pessoa-1',
    });
  });

  it('exclui definitivamente somente pela RPC transacional', async () => {
    await pessoaService.excluirDefinitivamente('pessoa-1', 'Ana Silva');

    expect(rpcMock).toHaveBeenCalledWith('excluir_pessoa_definitivamente', {
      p_pessoa_id: 'pessoa-1',
      p_nome_confirmacao: 'Ana Silva',
    });
  });
});
