import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fromMock,
  listarGruposMock,
  listarCirculosMock,
  listarPedidosMock,
  listarComprasMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  listarGruposMock: vi.fn(),
  listarCirculosMock: vi.fn(),
  listarPedidosMock: vi.fn(),
  listarComprasMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('./visitacaoService', () => ({ visitacaoService: { listarGrupos: listarGruposMock } }));
vi.mock('./circuloParticipacaoService', () => ({
  circuloParticipacaoService: { listarPorEncontro: listarCirculosMock },
}));
vi.mock('./almoxarifadoService', () => ({
  almoxarifadoService: {
    listarPedidos: listarPedidosMock,
    listarCompras: listarComprasMock,
  },
}));

import { globalSearchService } from './globalSearchService';

function participationQuery(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    limit: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.limit.mockResolvedValue({ data, error });
  return query;
}

const noScope = {
  pessoas: false,
  equipes: false,
  duplas: false,
  circulos: false,
  pedidos: false,
  compras: false,
};

describe('busca global de registros', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restringe pessoas ao encontro selecionado e mantém o papel contextual', async () => {
    const query = participationQuery([{
      id: 'participacao-1',
      participante: true,
      coordenador: false,
      pessoas: [{ id: 'pessoa-1', nome_completo: 'Maria da Silva' }],
      equipes: [],
    }]);
    fromMock.mockReturnValue(query);

    const response = await globalSearchService.search({
      encontroId: 'encontro-historico',
      term: 'Maria',
      scope: { ...noScope, pessoas: true },
    });

    expect(fromMock).toHaveBeenCalledWith('participacoes');
    expect(query.eq).toHaveBeenCalledWith('encontro_id', 'encontro-historico');
    expect(query.ilike).toHaveBeenCalledWith('pessoas.nome_completo', '%Maria%');
    expect(response).toEqual({
      results: [{
        id: 'pessoa-1',
        participacaoId: 'participacao-1',
        type: 'pessoa',
        title: 'Maria da Silva',
        description: 'Encontrista',
      }],
      partialFailure: false,
    });
  });

  it('elimina equipes repetidas originadas por diferentes participações', async () => {
    const equipe = { id: 'equipe-1', nome: 'Secretaria' };
    fromMock.mockReturnValue(participationQuery([
      { id: 'p-1', participante: false, coordenador: true, pessoas: null, equipes: equipe },
      { id: 'p-2', participante: false, coordenador: false, pessoas: null, equipes: [equipe] },
    ]));

    const response = await globalSearchService.search({
      encontroId: 'encontro-1',
      term: 'Secretaria',
      scope: { ...noScope, equipes: true },
    });

    expect(response.results).toHaveLength(1);
    expect(response.results[0]).toMatchObject({
      id: 'equipe-1',
      type: 'equipe',
      title: 'Secretaria',
    });
  });

  it('mantém resultados disponíveis quando um módulo falha', async () => {
    listarGruposMock.mockResolvedValue([{ id: 'dupla-1', nome: 'Ana & João' }]);
    listarCirculosMock.mockRejectedValue(new Error('círculos indisponíveis'));

    const response = await globalSearchService.search({
      encontroId: 'encontro-1',
      term: 'Ana',
      scope: { ...noScope, duplas: true, circulos: true },
    });

    expect(listarGruposMock).toHaveBeenCalledWith('encontro-1');
    expect(listarCirculosMock).toHaveBeenCalledWith('encontro-1');
    expect(response.results).toEqual([expect.objectContaining({ id: 'dupla-1', type: 'dupla' })]);
    expect(response.partialFailure).toBe(true);
  });
});
