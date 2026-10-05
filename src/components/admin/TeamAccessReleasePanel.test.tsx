import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAccessReleasePanel } from './TeamAccessReleasePanel';

const { listCandidatesMock } = vi.hoisted(() => ({
  listCandidatesMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../services/accessProvisioningService', () => ({
  accessProvisioningService: {
    listCandidates: listCandidatesMock,
    prepareCandidates: vi.fn(),
  },
}));

describe('TeamAccessReleasePanel', () => {
  beforeEach(() => {
    listCandidatesMock.mockResolvedValue([{
      participacao_id: 'participacao-1',
      pessoa_id: 'pessoa-1',
      nome_completo: 'Maria da Silva',
      email: 'maria@example.test',
      equipe_id: 'equipe-1',
      equipe_nome: 'Liturgia',
      papel: 'coordenador',
      grupo_ids: ['grupo-1'],
      grupos_nomes: ['Coordenadores de Pasta'],
      user_id: 'usuario-1',
      pessoa_vinculada: true,
      grupos_pendentes_ids: ['grupo-1'],
      status: 'perfis_pendentes',
    }]);
  });

  it('limita a lista por padrão e permite expandir e recolher', async () => {
    const user = userEvent.setup();
    render(<TeamAccessReleasePanel encontroId="encontro-1" encontroLabel="52º EJC" />);

    const list = await screen.findByRole('region', { name: 'Pessoas com acesso previsto' });
    const expandButton = screen.getByRole('button', { name: 'Expandir lista' });

    expect(list).toHaveClass('team-access-candidate-list');
    expect(list).not.toHaveClass('team-access-candidate-list--expanded');
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(expandButton);

    expect(list).toHaveClass('team-access-candidate-list--expanded');
    expect(screen.getByRole('button', { name: 'Recolher lista' })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Recolher lista' }));

    await waitFor(() => expect(list).not.toHaveClass('team-access-candidate-list--expanded'));
  });
});
