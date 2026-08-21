import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitaGrupo, VisitaParticipacaoEnriched } from '../../types/visitacao';
import { TrocaDuplasModal } from './TrocaDuplasModal';

const { trocarEncontristasEntreDuplasMock } = vi.hoisted(() => ({
  trocarEncontristasEntreDuplasMock: vi.fn(),
}));

vi.mock('../../services/visitacaoService', () => ({
  visitacaoService: {
    trocarEncontristasEntreDuplas: trocarEncontristasEntreDuplasMock,
  },
}));

const grupos = [
  { id: 'grupo-a', nome: 'Aline & Bruno' },
  { id: 'grupo-b', nome: 'Carla & Diego' },
] as VisitaGrupo[];

const vinculos = [
  {
    id: 'visita-1',
    grupo_id: 'grupo-a',
    participacao_id: 'participante-1',
    visitante: false,
    status: 'pendente',
    participacoes: { pessoas: { nome_completo: 'Encontrista Um' } },
  },
  {
    id: 'visita-2',
    grupo_id: 'grupo-b',
    participacao_id: 'participante-2',
    visitante: false,
    status: 'realizada',
    participacoes: { pessoas: { nome_completo: 'Encontrista Dois' } },
  },
] as VisitaParticipacaoEnriched[];

describe('TrocaDuplasModal', () => {
  beforeEach(() => {
    trocarEncontristasEntreDuplasMock.mockReset();
    trocarEncontristasEntreDuplasMock.mockResolvedValue({
      modo: 'individual',
      movidos_a_para_b: 1,
      movidos_b_para_a: 0,
    });
  });

  it('envia a seleção inteira em uma única operação transacional', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <TrocaDuplasModal
        isOpen
        onClose={onClose}
        grupos={grupos}
        vinculos={vinculos}
        onSuccess={onSuccess}
      />
    );

    const [origem, destino] = screen.getAllByRole('combobox');
    await user.selectOptions(origem, 'grupo-a');
    await user.selectOptions(destino, 'grupo-b');
    await user.click(screen.getByRole('checkbox', { name: /Encontrista Um/i }));
    await user.click(screen.getByRole('button', { name: /Mover Selecionados/i }));

    await waitFor(() => expect(trocarEncontristasEntreDuplasMock).toHaveBeenCalledTimes(1));
    expect(trocarEncontristasEntreDuplasMock).toHaveBeenCalledWith(
      'grupo-a',
      'grupo-b',
      'individual',
      ['visita-1']
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
