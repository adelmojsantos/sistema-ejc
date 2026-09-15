import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: authMocks.signInWithPassword,
    },
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: null, mustChangePassword: false }),
}));

import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => {
    authMocks.signInWithPassword.mockReset();
  });

  it('explica credenciais inválidas em português', async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      error: {
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'usuario@exemplo.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'senha-incorreta' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no Sistema' }));

    expect(
      await screen.findByText('E-mail ou senha incorretos. Confira os dados e tente novamente.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Invalid login credentials')).not.toBeInTheDocument();
  });
});
