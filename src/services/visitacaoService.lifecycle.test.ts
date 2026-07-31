import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, removePublicImageMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  removePublicImageMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock('./publicImageStorageService', () => ({
  removePublicImage: removePublicImageMock,
  uploadPublicImage: vi.fn(),
}));

import { VISIT_PARTICIPATION_BY_ENCOUNTER_SELECT, visitacaoService } from './visitacaoService';

const impact = {
  grupo_id: 'grupo-1',
  nome: 'Ana & Bruno',
  foto_url: 'https://images.example.test/dupla.webp',
  visitantes: [],
  visitantes_total: 2,
  encontristas_total: 3,
  pendentes_total: 2,
  realizadas_total: 1,
  ausentes_total: 0,
  fotos_familia_total: 1,
  intencoes_camiseta_total: 1,
  presencas_total: 0,
  desistentes_total: 0,
};

describe('ciclo seguro das duplas de visitação', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    removePublicImageMock.mockReset();
  });

  it('exige correspondência com o encontro ao carregar vínculos de visitação', () => {
    expect(VISIT_PARTICIPATION_BY_ENCOUNTER_SELECT).toContain('participacoes:participacao_id!inner');
  });

  it('cria os dois vínculos por uma única operação transacional', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'grupo-1', nome: 'Ana & Bruno' }, error: null });

    await visitacaoService.criarDuplaTransacional('encontro-1', 'ana-1', 'bruno-1');

    expect(rpcMock).toHaveBeenCalledWith('create_visita_grupo', {
      p_encontro_id: 'encontro-1',
      p_visitante_a_id: 'ana-1',
      p_visitante_b_id: 'bruno-1',
    });
  });

  it('substitui o visitante por uma única operação transacional', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'grupo-1', nome: 'Carlos & Bruno' }, error: null });

    await visitacaoService.substituirVisitante('grupo-1', 'vinculo-ana', 'carlos-1');

    expect(rpcMock).toHaveBeenCalledWith('replace_visita_grupo_visitor', {
      p_grupo_id: 'grupo-1',
      p_vinculo_visitante_id: 'vinculo-ana',
      p_nova_participacao_id: 'carlos-1',
    });
  });

  it('consulta o impacto antes da dissolução', async () => {
    rpcMock.mockResolvedValue({ data: impact, error: null });

    await expect(visitacaoService.obterImpactoExclusaoGrupo('grupo-1')).resolves.toEqual(impact);
    expect(rpcMock).toHaveBeenCalledWith('get_visita_grupo_delete_impact', { p_grupo_id: 'grupo-1' });
  });

  it('remove a foto da dupla somente depois da dissolução confirmada pelo banco', async () => {
    rpcMock.mockResolvedValue({ data: impact, error: null });
    removePublicImageMock.mockResolvedValue(undefined);

    await visitacaoService.dissolverGrupo('grupo-1');

    expect(rpcMock).toHaveBeenCalledWith('dissolve_visita_grupo', { p_grupo_id: 'grupo-1' });
    expect(removePublicImageMock).toHaveBeenCalledWith(impact.foto_url);
  });

  it('não remove a foto quando a transação do banco falha', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('database failure') });

    await expect(visitacaoService.dissolverGrupo('grupo-1')).rejects.toThrow('database failure');
    expect(removePublicImageMock).not.toHaveBeenCalled();
  });

  it('reatribui o registro preservado em vez de criar outro no frontend', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'visita-1', grupo_id: 'grupo-2' }, error: null });

    await visitacaoService.vincularOuReatribuirEncontrista('grupo-2', 'encontrista-1');

    expect(rpcMock).toHaveBeenCalledWith('assign_visita_participant', {
      p_grupo_id: 'grupo-2',
      p_participacao_id: 'encontrista-1',
    });
  });
});
