import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import { inscricaoService, SECRETARIA_SAFE_PERSON_FIELDS } from './inscricaoService';

describe('campos de pessoa permitidos nas listas da Secretaria', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it.each([
    'alergia',
    'restricao_alimentar',
    'medicamento_continuo',
    'observacoes_saude',
    'possui_alergia',
    'possui_restricao_alimentar',
    'possui_observacao_saude',
    'usa_medicamento_continuo',
  ])('não solicita o campo sensível %s', (field) => {
    expect(SECRETARIA_SAFE_PERSON_FIELDS).not.toContain(field);
  });

  it('mantém somente os dados de identificação necessários ao fluxo', () => {
    expect(SECRETARIA_SAFE_PERSON_FIELDS).toContain('nome_completo');
    expect(SECRETARIA_SAFE_PERSON_FIELDS).toContain('telefone');
    expect(SECRETARIA_SAFE_PERSON_FIELDS).toContain('endereco');
  });

  it('desvincula integrantes somente pela operação transacional', async () => {
    rpcMock.mockResolvedValueOnce({ data: { participacao_id: 'participacao-1' }, error: null });

    await inscricaoService.desvincularDoEncontro('participacao-1');

    expect(rpcMock).toHaveBeenCalledWith('desvincular_integrante_encontro', {
      p_participacao_id: 'participacao-1',
    });
  });

  it('cancela a participação pela operação que preserva o histórico', async () => {
    rpcMock.mockResolvedValueOnce({ data: { cancelamento_id: 'cancelamento-1' }, error: null });

    await expect(inscricaoService.cancelarParticipacao(
      'participacao-1',
      'Desistência comunicada à Secretaria',
    )).resolves.toEqual({ cancelamento_id: 'cancelamento-1' });

    expect(rpcMock).toHaveBeenCalledWith('cancelar_participacao', {
      p_participacao_id: 'participacao-1',
      p_motivo: 'Desistência comunicada à Secretaria',
    });
  });

  it('restaura a participação cancelada pela operação transacional', async () => {
    rpcMock.mockResolvedValueOnce({ data: { participacao_id: 'participacao-1' }, error: null });

    await expect(
      inscricaoService.restaurarParticipacaoCancelada('cancelamento-1'),
    ).resolves.toEqual({ participacao_id: 'participacao-1' });

    expect(rpcMock).toHaveBeenCalledWith('restaurar_participacao_cancelada', {
      p_cancelamento_id: 'cancelamento-1',
    });
  });
});
