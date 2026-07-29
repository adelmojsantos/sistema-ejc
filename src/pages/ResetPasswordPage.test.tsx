import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
  refreshSession: vi.fn(),
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
      refreshSession: authMocks.refreshSession,
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
    authMocks.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'refreshed-token' } },
      error: null,
    });
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

    await screen.findByRole('heading', { name: 'Cadastrar ou alterar senha' });

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
      await screen.findByRole('heading', { name: 'Senha salva com sucesso' })
    ).toBeInTheDocument();
  });

  it('explica quando a senha informada já é a senha atual', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'recovery-token' } },
      error: null,
    });
    authMocks.updateUser.mockResolvedValue({
      error: { code: 'same_password', message: 'New password should be different' },
    });

    renderPage();
    await screen.findByRole('heading', { name: 'Cadastrar ou alterar senha' });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'senha-ja-cadastrada' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'senha-ja-cadastrada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(
      await screen.findByText(/Essa senha já está cadastrada/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Entrar com essa senha' })
    ).toBeInTheDocument();
    expect(authMocks.rpc).not.toHaveBeenCalled();
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });

  it('encerra a sessão temporária antes de entrar com a senha já cadastrada', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'recovery-token' } },
      error: null,
    });
    authMocks.updateUser.mockResolvedValue({
      error: { code: 'same_password', message: 'New password should be different' },
    });

    renderPage();
    await screen.findByRole('heading', { name: 'Cadastrar ou alterar senha' });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'senha-ja-cadastrada' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'senha-ja-cadastrada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Entrar com essa senha' })
    );

    await waitFor(() => {
      expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });
  });

  it('não informa falha na senha quando apenas a limpeza da pendência falha', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'recovery-token' } },
      error: null,
    });
    authMocks.rpc.mockResolvedValue({ error: new Error('rpc indisponível') });

    renderPage();
    await screen.findByRole('heading', { name: 'Cadastrar ou alterar senha' });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'uma-senha-realmente-nova' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'uma-senha-realmente-nova' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(
      await screen.findByRole('heading', { name: 'Senha salva com sucesso' })
    ).toBeInTheDocument();
    expect(authMocks.rpc).toHaveBeenCalledTimes(2);
    expect(authMocks.refreshSession).toHaveBeenCalled();
    expect(screen.getByText(/Sua senha foi salva/)).toBeInTheDocument();
  });
});
