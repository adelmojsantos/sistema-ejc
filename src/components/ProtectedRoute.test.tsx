import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../hooks/useAuth';

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/restrito']}>
      <Routes>
        <Route path="/login" element={<div>Login</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route
          path="/restrito"
          element={(
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <div>Conteúdo autorizado</div>
            </ProtectedRoute>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('comunica que a autorização ainda está sendo verificada', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: true,
      profileLoading: false,
      mustChangePassword: false,
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuth>);

    renderProtected();

    expect(screen.getByRole('status')).toHaveTextContent('Verificando acesso');
  });

  it('redireciona visitantes para o login', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      profileLoading: false,
      mustChangePassword: false,
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuth>);

    renderProtected();

    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('nega a rota quando a permissão exigida não existe', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
      loading: false,
      profileLoading: false,
      mustChangePassword: false,
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuth>);

    renderProtected();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renderiza o conteúdo quando a permissão existe', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'admin-1' },
      profile: { id: 'admin-1' },
      loading: false,
      profileLoading: false,
      mustChangePassword: false,
      hasPermission: (permission: string) => permission === 'modulo_admin',
    } as unknown as ReturnType<typeof useAuth>);

    renderProtected();

    expect(screen.getByText('Conteúdo autorizado')).toBeInTheDocument();
  });
});
