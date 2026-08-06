import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: rpcMock, from: vi.fn() },
}));

vi.mock('./encontroService', () => ({ encontroService: { obterInscricaoPublicaAtiva: vi.fn() } }));
vi.mock('./pessoaService', () => ({ pessoaService: { buscarPorSemelhanca: vi.fn() } }));

import { listaEsperaService } from './listaEsperaService';

describe('conversão da lista de espera', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { pessoa_id: 'pessoa-1', participacao_id: 'participacao-1' }, error: null });
  });

  it('aprova uma inscrição criando pessoa, participação e status em uma única RPC', async () => {
    await listaEsperaService.efetivarListaEspera('inscricao-1', {} as never);

    expect(rpcMock).toHaveBeenCalledWith('aprovar_lista_espera', {
      p_lista_espera_id: 'inscricao-1',
      p_pessoa_id: null,
    });
  });

  it('aprova vinculando uma pessoa existente sem criar outra pessoa', async () => {
    await listaEsperaService.vincularPessoaExistente('inscricao-1', 'pessoa-existente', {} as never);

    expect(rpcMock).toHaveBeenCalledWith('aprovar_lista_espera', {
      p_lista_espera_id: 'inscricao-1',
      p_pessoa_id: 'pessoa-existente',
    });
  });
});
