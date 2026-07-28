import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuadranteAuthPage } from './QuadranteAuthPage';
import { quadranteService } from '../../services/quadranteService';
import { useAuth } from '../../hooks/useAuth';

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../services/quadranteService', () => ({
  quadranteService: {
    obterInfoPublica: vi.fn(),
    validarAcesso: vi.fn(),
  },
}));
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedInfo = vi.mocked(quadranteService.obterInfoPublica);
const mockedValidate = vi.mocked(quadranteService.validarAcesso);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/q/00000000-0000-0000-0000-000000000001']}>
      <Routes>
        <Route path="/q/:token" element={<QuadranteAuthPage />} />
        <Route path="/quadrante/:token/publico" element={<div>Quadrante público</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('acesso público ao Quadrante', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      session: null,
      loading: false,
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('abre diretamente quando o encontro não exige PIN', async () => {
    mockedInfo.mockResolvedValue({
      nome: 'EJC Teste',
      quadrante_ativo: true,
      tem_pin: false,
    });

    renderPage();

    expect(await screen.findByText('Quadrante público')).toBeInTheDocument();
    expect(mockedValidate).not.toHaveBeenCalled();
  });

  it('valida e guarda o PIN somente na sessão da aba', async () => {
    mockedInfo.mockResolvedValue({
      nome: 'EJC Teste',
      quadrante_ativo: true,
      tem_pin: true,
    });
    mockedValidate.mockResolvedValue(true);
    const user = userEvent.setup();

    renderPage();

    const input = await screen.findByLabelText('Digite o Código de Acesso:');
    await user.type(input, '1234');
    await user.click(screen.getByRole('button', { name: /acessar quadrante/i }));

    await waitFor(() => {
      expect(mockedValidate).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        '1234'
      );
      expect(sessionStorage.getItem('q_auth_00000000-0000-0000-0000-000000000001'))
        .toBe('1234');
      expect(screen.getByText('Quadrante público')).toBeInTheDocument();
    });
  });
});
