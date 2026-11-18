import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
    getSession: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
}));

vi.mock('../lib/supabase', () => {
    const emptyResult = { data: null, error: null };
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'ilike', 'limit']) {
        chain[method] = () => chain;
    }
    chain.maybeSingle = () => Promise.resolve(emptyResult);
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);

    const channel = { on: () => channel, subscribe: () => channel, unsubscribe: vi.fn() };

    return {
        supabase: {
            auth: authMocks,
            from: () => chain,
            rpc: () => Promise.resolve({ data: false, error: null }),
            channel: () => channel,
        },
    };
});

import { AuthProvider } from './AuthContext';
import { useAuth } from '../hooks/useAuth';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);

function jwtWithSession(sessionId: string): string {
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
    return `${encode({ alg: 'HS256' })}.${encode({ session_id: sessionId })}.assinatura`;
}

const session = {
    access_token: jwtWithSession('sessao-1'),
    user: { id: 'user-1', email: 'usuario@exemplo.com' },
};

function UserProbe() {
    const { user, loading, signOut } = useAuth();
    if (loading) return <span>carregando</span>;
    return (
        <>
            <span>{user ? 'autenticado' : 'deslogado'}</span>
            <button type="button" onClick={() => void signOut()}>Sair</button>
        </>
    );
}

function renderProvider() {
    return render(
        <AuthProvider>
            <UserProbe />
        </AuthProvider>
    );
}

describe('AuthProvider — sessão', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        localStorage.clear();
        sessionStorage.clear();
        authMocks.getSession.mockResolvedValue({ data: { session } });
        authMocks.signOut.mockResolvedValue({ error: null });
        authMocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('mantém a sessão ativa dentro dos limites', async () => {
        renderProvider();

        expect(await screen.findByText('autenticado')).toBeInTheDocument();
        expect(authMocks.signOut).not.toHaveBeenCalled();
    });

    it('encerra a sessão ao abrir o sistema depois de 12 horas sem uso', async () => {
        localStorage.setItem('ejc-session-policy:v1', JSON.stringify({
            sessionKey: 'session:sessao-1',
            signedInAt: NOW - 13 * HOUR,
            lastActivityAt: NOW - 13 * HOUR,
        }));

        renderProvider();

        expect(await screen.findByText('deslogado')).toBeInTheDocument();
        expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
        expect(sessionStorage.getItem('ejc-session-expired-reason')).toBe('idle');
    });

    it('encerra a sessão na primeira interação após o limite de inatividade', async () => {
        renderProvider();
        expect(await screen.findByText('autenticado')).toBeInTheDocument();

        vi.setSystemTime(NOW + 12 * HOUR + 1000);
        act(() => {
            fireEvent.pointerDown(window);
        });

        await waitFor(() => expect(screen.getByText('deslogado')).toBeInTheDocument());
        expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('"Sair" encerra apenas a sessão deste aparelho', async () => {
        renderProvider();
        expect(await screen.findByText('autenticado')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

        await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    });
});
