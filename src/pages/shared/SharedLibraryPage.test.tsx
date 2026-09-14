import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../hooks/useAuth';
import LibraryPage from './SharedLibraryPage';

vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../hooks/useBiblioteca', () => ({
    useBiblioteca: vi.fn(),
}));

vi.mock('../../hooks/useSharedLibraryAccess', () => ({
    useSharedLibraryAccess: vi.fn(),
}));

vi.mock('../../services/bibliotecaService', () => ({
    bibliotecaService: {},
}));

vi.mock('../admin/BibliotecaPage', () => ({
    BibliotecaPage: () => <div>Biblioteca administrativa</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('LibraryPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('atualiza o perfil antes de decidir se o usuário pode gerenciar a Biblioteca', async () => {
        let finishRefresh: (() => void) | undefined;
        const refreshProfile = vi.fn(() => new Promise<void>((resolve) => {
            finishRefresh = resolve;
        }));

        mockedUseAuth.mockReturnValue({
            hasPermission: (permission: string) => permission === 'modulo_biblioteca',
            refreshProfile,
        } as unknown as ReturnType<typeof useAuth>);

        render(<LibraryPage />);

        expect(screen.getByText('Atualizando seu acesso à Biblioteca...')).toBeInTheDocument();
        expect(screen.queryByText('Biblioteca administrativa')).not.toBeInTheDocument();
        expect(refreshProfile).toHaveBeenCalledWith({ force: true });

        finishRefresh?.();

        expect(await screen.findByText('Biblioteca administrativa')).toBeInTheDocument();
    });
});
