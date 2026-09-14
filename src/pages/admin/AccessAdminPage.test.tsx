import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAccessService } from '../../services/adminAccessService';
import { bibliotecaService } from '../../services/bibliotecaService';
import { AccessAdminPage } from './AccessAdminPage';

vi.mock('../../services/adminAccessService', () => ({
    adminAccessService: {
        listGrupos: vi.fn(),
        listPermissoes: vi.fn(),
        listGrupoPermissoes: vi.fn(),
        updateGrupoPermissoes: vi.fn(),
        createGrupo: vi.fn(),
        deleteGrupo: vi.fn(),
    },
}));

vi.mock('../../services/bibliotecaService', () => ({
    bibliotecaService: {
        sincronizarGoogleDrive: vi.fn(),
        obterStatusGoogleDrive: vi.fn(),
    },
}));

const mockedAccessService = vi.mocked(adminAccessService);
const mockedBibliotecaService = vi.mocked(bibliotecaService);

describe('AccessAdminPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAccessService.listGrupos.mockResolvedValue([
            { id: 'group-1', nome: 'Secretaria', descricao: 'Acessos da secretaria' },
        ]);
        mockedAccessService.listPermissoes.mockResolvedValue([
            {
                id: 'permission-dashboard',
                chave: 'modulo_dashboard',
                nome: 'Página inicial',
                descricao: 'Permite acessar a página inicial.',
            },
            {
                id: 'permission-library',
                chave: 'modulo_biblioteca',
                nome: 'Acesso à Biblioteca',
                descricao: 'Permite acessar, enviar e gerenciar a biblioteca global de arquivos do sistema.',
            },
            {
                id: 'permission-library-import',
                chave: 'biblioteca_google_importar',
                nome: 'Biblioteca — Importar de outro Drive',
                descricao: 'Permite importar pastas e arquivos de outro Google Drive.',
            },
        ]);
        mockedAccessService.listGrupoPermissoes.mockResolvedValue([
            { grupo_id: 'group-1', permissao_id: 'permission-dashboard' },
        ]);
        mockedAccessService.updateGrupoPermissoes.mockResolvedValue();
        mockedBibliotecaService.sincronizarGoogleDrive.mockResolvedValue({
            accountEmail: 'biblioteca@example.test',
            results: [],
        });
        mockedBibliotecaService.obterStatusGoogleDrive.mockResolvedValue({
            connected: true,
            accountEmail: 'biblioteca@example.test',
            connectedAt: '2026-09-14T12:00:00Z',
            lastError: null,
            pendingCount: 0,
            errorCount: 0,
        });
    });

    it('mostra nomes curtos, separa módulos e não exibe chaves técnicas', async () => {
        const user = userEvent.setup();
        render(<AccessAdminPage />);

        await user.click(await screen.findByRole('heading', { name: 'Secretaria' }));

        expect(screen.getByRole('region', { name: 'Módulos' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Permissões específicas' })).toBeInTheDocument();
        expect(screen.getByText('Biblioteca')).toBeInTheDocument();
        expect(screen.getAllByText('O que libera?').length).toBeGreaterThan(0);
        expect(screen.queryByText('modulo_biblioteca')).not.toBeInTheDocument();
    });

    it('explica o acesso completo da Biblioteca em um modal', async () => {
        const user = userEvent.setup();
        render(<AccessAdminPage />);

        await user.click(await screen.findByRole('heading', { name: 'Secretaria' }));
        await user.click(screen.getByRole('button', { name: 'Ver detalhes de Biblioteca' }));

        expect(screen.getByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument();
        expect(screen.getByText(/Libera o gerenciamento de todo o acervo/)).toBeInTheDocument();
        expect(screen.getByText(/use o compartilhamento da própria Biblioteca/)).toBeInTheDocument();
    });

    it('altera a Biblioteca pelo toggle e salva somente após uma mudança', async () => {
        const user = userEvent.setup();
        render(<AccessAdminPage />);

        await user.click(await screen.findByRole('heading', { name: 'Secretaria' }));

        const saveButton = screen.getByRole('button', { name: 'Salvar' });
        expect(saveButton).toBeDisabled();

        await user.click(screen.getByRole('switch', { name: 'Biblioteca: bloqueado' }));

        expect(screen.getByText('Alterações ainda não salvas')).toBeInTheDocument();
        expect(saveButton).toBeEnabled();

        await user.click(saveButton);

        await waitFor(() => {
            expect(mockedAccessService.updateGrupoPermissoes).toHaveBeenCalledWith(
                'group-1',
                ['permission-dashboard', 'permission-library']
            );
            expect(mockedBibliotecaService.sincronizarGoogleDrive).toHaveBeenCalledWith(25);
        });
    });
});
