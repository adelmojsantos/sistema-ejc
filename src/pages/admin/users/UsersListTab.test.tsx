import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersListTab } from './UsersListTab';

const { listUsersMock } = vi.hoisted(() => ({ listUsersMock: vi.fn() }));

vi.mock('../../../services/adminUserService', () => ({
    adminUserService: {
        listUsers: listUsersMock,
        listAllUsers: vi.fn(),
        sendPasswordRecovery: vi.fn(),
        deleteUser: vi.fn(),
        securePendingPasswords: vi.fn(),
    },
}));

const summary = {
    totalUsers: 10,
    totalTemporaryPassword: 3,
    totalWithoutPerson: 1,
    totalWithTargetAccess: 4,
    totalWithTargetAccessPendingFirstLogin: 2,
    totalWithTargetAccessWithoutPerson: 1,
    filteredTotal: 1,
};

describe('UsersListTab', () => {
    beforeEach(() => {
        listUsersMock.mockReset();
        listUsersMock.mockResolvedValue({
            users: [{
                id: 'u1',
                email: 'maria@example.test',
                pessoaId: 'p1',
                pessoaVinculo: 'explicit',
                temporary_password: false,
                created_at: '2026-01-01T00:00:00Z',
                grupos: [
                    { grupo_id: 'g-sec', encontro_id: 'atual' },
                    { grupo_id: 'g-coz', encontro_id: 'anterior' },
                ],
                nome: 'Maria',
                equipesNomes: { atual: 'Liturgia', anterior: 'Cozinha' },
            }],
            total: 1,
            page: 0,
            pageSize: 20,
            summary,
        });
    });

    const renderTab = () => render(
        <UsersListTab
            contextId="atual"
            contextLabel="52º EJC"
            grupos={[{ id: 'g-sec', nome: 'Secretaria', descricao: null }, { id: 'g-coz', nome: 'Cozinha', descricao: null }]}
            exportConfigs={[]}
            reloadToken={0}
            onOpenUser={vi.fn()}
            onUserRemoved={vi.fn()}
        />,
    );

    it('abre em "Com acesso neste encontro" e mostra só perfis e equipe do encontro', async () => {
        renderTab();

        expect(await screen.findByText('Maria')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Com acesso neste encontro/ })).toHaveAttribute('aria-selected', 'true');
        expect(listUsersMock).toHaveBeenCalledWith(expect.objectContaining({ accessScope: 'with', targetEncontroId: 'atual' }));

        const row = screen.getByText('Maria').closest('li') as HTMLElement;
        expect(row).toHaveTextContent('Secretaria');
        expect(row).toHaveTextContent('Liturgia');
        expect(row).not.toHaveTextContent('Cozinha');
    });

    it('troca de visão pelos atalhos com contadores', async () => {
        const user = userEvent.setup();
        renderTab();
        await screen.findByText('Maria');

        await user.click(screen.getByRole('tab', { name: /Aguardando 1º acesso\s*2/ }));
        await waitFor(() => expect(listUsersMock).toHaveBeenLastCalledWith(expect.objectContaining({ accessScope: 'with', tempPassword: 'sim' })));

        await user.click(screen.getByRole('tab', { name: /Sem acesso neste encontro\s*6/ }));
        await waitFor(() => expect(listUsersMock).toHaveBeenLastCalledWith(expect.objectContaining({ accessScope: 'without', grupoId: 'all' })));
    });
});
