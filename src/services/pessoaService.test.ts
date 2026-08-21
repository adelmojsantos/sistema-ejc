import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMock, insertMock, eqMock, selectMock, singleMock, fromMock, rpcMock, resolveReferenceMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  insertMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  resolveReferenceMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

vi.mock('./geolocationService', () => ({
  geolocationService: {
    resolveRegionalReferenceForPersistence: resolveReferenceMock,
  },
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
    insertMock.mockReturnValue({ select: selectMock });
    fromMock.mockReturnValue({ update: updateMock, insert: insertMock });
    rpcMock.mockResolvedValue({ data: null, error: null });
    resolveReferenceMock.mockResolvedValue({
      result: { status: 'failed' },
      update: {
        geo_reference_latitude: -20.54,
        geo_reference_longitude: -47.40,
        geo_reference_source: 'nominatim',
        geo_reference_precision: 'street',
        geo_reference_address_fingerprint: 'fingerprint-atual',
        geo_reference_checked_at: '2026-08-21T12:00:00.000Z',
      },
    });
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

  it('preserva uma localização manual verificada na atualização', () => {
    expect(normalizarPessoaUpdate({
      latitude: -20.5,
      longitude: -47.4,
      geo_status: 'verified',
      geo_source: 'manual',
      geo_precision: 'manual',
      geo_address_fingerprint: 'fingerprint-atual',
      geo_checked_at: '2026-08-18T12:00:00.000Z',
      geo_verified_at: '2026-08-18T12:00:00.000Z',
    })).toMatchObject({
      latitude: -20.5,
      longitude: -47.4,
      geo_status: 'verified',
      geo_source: 'manual',
      geo_precision: 'manual',
      geo_address_fingerprint: 'fingerprint-atual',
    });
  });

  it('preserva referência regional sem convertê-la em localização exata', () => {
    const update = normalizarPessoaUpdate({
      latitude: null,
      longitude: null,
      geo_status: 'pending',
      geo_reference_latitude: -20.54,
      geo_reference_longitude: -47.40,
      geo_reference_source: 'nominatim',
      geo_reference_precision: 'street',
      geo_reference_address_fingerprint: 'fingerprint-atual',
      geo_reference_checked_at: '2026-08-19T12:00:00.000Z',
    });

    expect(update).toMatchObject({
      latitude: null,
      longitude: null,
      geo_status: 'pending',
      geo_reference_latitude: -20.54,
      geo_reference_longitude: -47.40,
      geo_reference_precision: 'street',
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

  it('obtém localização aproximada automaticamente ao criar pessoa com endereço suficiente', async () => {
    await pessoaService.criar({
      nome_completo: 'Ana Silva',
      telefone: '35999990000',
      endereco: 'Rua Um',
      numero: '10',
      cidade: 'Franca',
      estado: 'SP',
    } as never);

    expect(resolveReferenceMock).toHaveBeenCalledWith(expect.objectContaining({
      endereco: 'Rua Um',
      numero: '10',
      cidade: 'Franca',
      estado: 'SP',
    }));
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        geo_reference_latitude: -20.54,
        geo_reference_longitude: -47.40,
        geo_reference_precision: 'street',
      }),
    ]);
  });

  it('salva a pessoa mesmo quando a localização aproximada está indisponível', async () => {
    resolveReferenceMock.mockRejectedValueOnce(new Error('provider unavailable'));

    await pessoaService.criar({
      nome_completo: 'Ana Silva',
      telefone: '35999990000',
      endereco: 'Rua Um',
      numero: '10',
      cidade: 'Franca',
      estado: 'SP',
    } as never);

    expect(insertMock).toHaveBeenCalledWith([
      expect.not.objectContaining({ geo_reference_latitude: expect.any(Number) }),
    ]);
  });

  it('não consulta localização aproximada em atualização sem campos de endereço', async () => {
    await pessoaService.atualizar('pessoa-1', { email: 'ana@example.com' });

    expect(resolveReferenceMock).not.toHaveBeenCalled();
  });

  it('envia o filtro específico e a paginação para a busca de pessoas', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { data: [{ id: 'pessoa-1', nome_completo: 'Natália Silva' }], count: 1 },
      error: null,
    });

    await expect(pessoaService.buscarPorCampoComPaginacao(
      'endereco',
      '  Rua Pérola  ',
      2,
      10,
      'encontro-1',
    )).resolves.toMatchObject({ count: 1 });

    expect(rpcMock).toHaveBeenCalledWith('search_pessoas_by_field', {
      p_search_field: 'endereco',
      p_search_term: 'Rua Pérola',
      p_encontro_id: 'encontro-1',
      p_page: 2,
      p_page_size: 10,
    });
  });

  it('envia o filtro agregado sem incluir comunidade', async () => {
    rpcMock.mockResolvedValueOnce({ data: { data: [], count: 0 }, error: null });

    await pessoaService.buscarPorCampoComPaginacao('todos', 'Natalia', 1, 10);

    expect(rpcMock).toHaveBeenCalledWith('search_pessoas_by_field', {
      p_search_field: 'todos',
      p_search_term: 'Natalia',
      p_encontro_id: null,
      p_page: 1,
      p_page_size: 10,
    });
  });

  it('rejeita resposta incompleta da busca tipada', async () => {
    rpcMock.mockResolvedValueOnce({ data: { data: [] }, error: null });

    await expect(pessoaService.buscarPorCampoComPaginacao('nome', 'Natalia'))
      .rejects.toThrow('resposta incompleta');
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
