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

const passkeyMocks = vi.hoisted(() => ({
  available: false,
  signIn: vi.fn(),
}));

vi.mock('../services/passkeyService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/passkeyService')>();
  return {
    ...actual,
    isPasskeyLoginAvailable: () => passkeyMocks.available,
    passkeyService: { ...actual.passkeyService, signIn: passkeyMocks.signIn },
  };
});

import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => {
    authMocks.signInWithPassword.mockReset();
    passkeyMocks.signIn.mockReset();
    passkeyMocks.available = false;
    sessionStorage.clear();
  });

  const renderLogin = () => render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

  it('não exibe entrada com chave de acesso quando o recurso está indisponível', () => {
    renderLogin();
    expect(screen.queryByRole('button', { name: /Entrar com chave de acesso/ })).not.toBeInTheDocument();
  });

  it('entra com chave de acesso quando o recurso está disponível', async () => {
    passkeyMocks.available = true;
    passkeyMocks.signIn.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /Entrar com chave de acesso/ }));

    await vi.waitFor(() => expect(passkeyMocks.signIn).toHaveBeenCalledTimes(1));
    expect(authMocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('mostra mensagem neutra quando a confirmação é cancelada', async () => {
    passkeyMocks.available = true;
    passkeyMocks.signIn.mockRejectedValue({
      code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
      cause: { name: 'NotAllowedError' },
    });
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /Entrar com chave de acesso/ }));

    expect(await screen.findByText(/confirmação não foi concluída/)).toBeInTheDocument();
  });

  it('informa quando a sessão foi encerrada por inatividade', () => {
    sessionStorage.setItem('ejc-session-expired-reason', 'idle');
    renderLogin();

    expect(screen.getByRole('status')).toHaveTextContent('período sem uso');
  });

  it('agenda o convite de chave de acesso após login com senha', async () => {
    authMocks.signInWithPassword.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'usuario@exemplo.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-correta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no Sistema' }));

    await vi.waitFor(() => expect(sessionStorage.getItem('ejc-passkey-offer-pending')).toBe('true'));
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
