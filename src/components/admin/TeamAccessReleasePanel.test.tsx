import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAccessReleasePanel } from './TeamAccessReleasePanel';

const { listCandidatesMock, updatePersonEmailMock } = vi.hoisted(() => ({
  listCandidatesMock: vi.fn(),
  updatePersonEmailMock: vi.fn(),
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

vi.mock('../../services/adminUserService', () => ({
  adminUserService: { updatePersonEmail: updatePersonEmailMock },
}));

const baseCandidate = {
  pessoa_id: 'pessoa-x',
  email: 'x@example.test',
  grupo_ids: ['grupo-1'],
  grupos_nomes: ['Coordenadores de Pasta'],
  user_id: null,
  pessoa_vinculada: false,
  grupos_pendentes_ids: ['grupo-1'],
};

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

  it('filtra por equipe e função e seleciona só as pendências filtradas', async () => {
    const user = userEvent.setup();
    listCandidatesMock.mockResolvedValue([
      { ...baseCandidate, participacao_id: 'p1', nome_completo: 'Ana', equipe_id: 'e1', equipe_nome: 'Liturgia', papel: 'coordenador', status: 'sem_usuario' },
      { ...baseCandidate, participacao_id: 'p2', nome_completo: 'Bruno', equipe_id: 'e1', equipe_nome: 'Liturgia', papel: 'integrante', status: 'perfis_pendentes' },
      { ...baseCandidate, participacao_id: 'p3', nome_completo: 'Carla', equipe_id: 'e2', equipe_nome: 'Cozinha', papel: 'integrante', status: 'sem_usuario' },
    ]);
    render(<TeamAccessReleasePanel encontroId="encontro-1" encontroLabel="52º EJC" />);

    await screen.findByText('Ana');
    await user.selectOptions(screen.getByLabelText('Equipe'), 'e1');
    await user.selectOptions(screen.getByLabelText('Função'), 'integrante');

    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    expect(screen.queryByText('Carla')).not.toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Selecionar pendências filtradas/));
    expect(screen.getByRole('button', { name: /Liberar selecionados \(1\)/ })).toBeEnabled();
  });

  it('permite cadastrar o e-mail de quem está sem e-mail', async () => {
    const user = userEvent.setup();
    listCandidatesMock.mockResolvedValue([
      { ...baseCandidate, participacao_id: 'p1', pessoa_id: 'pessoa-ana', nome_completo: 'Ana', email: null, equipe_id: 'e1', equipe_nome: 'Liturgia', papel: 'coordenador', status: 'sem_email' },
    ]);
    updatePersonEmailMock.mockResolvedValue({ id: 'pessoa-ana', nome_completo: 'Ana', email: 'ana@example.test' });
    render(<TeamAccessReleasePanel encontroId="encontro-1" encontroLabel="52º EJC" />);

    await user.click(await screen.findByRole('button', { name: /Cadastrar e-mail/ }));
    const loadsBeforeSave = listCandidatesMock.mock.calls.length;
    await user.type(screen.getByLabelText('E-mail'), 'Ana@Example.test');
    await user.click(screen.getByRole('button', { name: 'Salvar e-mail' }));

    await waitFor(() => expect(updatePersonEmailMock).toHaveBeenCalledWith('pessoa-ana', 'ana@example.test'));
    await waitFor(() => expect(listCandidatesMock.mock.calls.length).toBeGreaterThan(loadsBeforeSave));
  });
});
