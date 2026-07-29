import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      updateUser: authMocks.updateUser,
      signOut: authMocks.signOut,
    },
    rpc: authMocks.rpc,
  },
}));

import { ResetPasswordPage } from './ResetPasswordPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    Object.values(authMocks).forEach((mock) => mock.mockReset());
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
    authMocks.updateUser.mockResolvedValue({ error: null });
    authMocks.rpc.mockResolvedValue({ error: null });
    authMocks.signOut.mockResolvedValue({ error: null });
  });

  it('rejeita links sem uma sessão de recuperação válida', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Link inválido ou expirado' })
    ).toBeInTheDocument();
  });

  it('define a senha, limpa a pendência e encerra as sessões', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'recovery-token' } },
      error: null,
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Definir nova senha' });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'nova-senha-segura' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'nova-senha-segura' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() => {
      expect(authMocks.updateUser).toHaveBeenCalledWith({
        password: 'nova-senha-segura',
      });
      expect(authMocks.rpc).toHaveBeenCalledWith('clear_temporary_password');
      expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
    });

    expect(
      await screen.findByRole('heading', { name: 'Senha definida com sucesso' })
    ).toBeInTheDocument();
  });
});
