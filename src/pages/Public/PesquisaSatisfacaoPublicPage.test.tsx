import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  obterGeneralInfo: vi.fn(),
  obterPublicInfo: vi.fn(),
  listarPerguntasPublicas: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams('encontro=encontro-1')],
  };
});

vi.mock('../../services/pesquisaSatisfacaoService', () => ({
  pesquisaSatisfacaoService: {
    obterGeneralInfo: mocks.obterGeneralInfo,
    obterPublicInfo: mocks.obterPublicInfo,
    listarPerguntasPublicas: mocks.listarPerguntasPublicas,
  },
}));

import PesquisaSatisfacaoPublicPage from './PesquisaSatisfacaoPublicPage';

describe('PesquisaSatisfacaoPublicPage - acesso geral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listarPerguntasPublicas.mockResolvedValue([]);
    mocks.obterGeneralInfo.mockResolvedValue({
      encontro_id: 'encontro-1',
      encontro_nome: 'Encontro de teste',
      equipes: [{ equipe_id: 'equipe-1', nome: 'Equipe Teste' }],
    });
    mocks.obterPublicInfo.mockResolvedValue({
      encontro_id: 'encontro-1',
      encontro_nome: 'Encontro de teste',
      equipe_id: 'equipe-1',
      equipe_nome: 'Equipe Teste',
      participantes: [{ participacao_id: 'participacao-1', nome: 'Integrante Teste' }],
    });
  });

  it('mantém os integrantes bloqueados até a equipe ser selecionada', async () => {
    render(<PesquisaSatisfacaoPublicPage />);

    const equipeSelect = await screen.findByLabelText('Minha equipe é');
    const integranteSelect = screen.getByLabelText('Meu nome é');
    expect(integranteSelect).toBeDisabled();

    fireEvent.change(equipeSelect, { target: { value: 'equipe-1' } });

    await waitFor(() => {
      expect(mocks.obterPublicInfo).toHaveBeenCalledWith('encontro-1', 'equipe-1');
      expect(integranteSelect).toBeEnabled();
    });
    expect(screen.getByRole('option', { name: 'Integrante Teste' })).toBeInTheDocument();
  });
});
