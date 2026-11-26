import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EncontreiroFotoModal, type EncontreiroFotoTarget } from './EncontreiroFotoModal';

const uploadFotoEncontreiro = vi.fn();
const definirFotoEncontreiro = vi.fn();
const toastError = vi.fn();

vi.mock('../../services/inscricaoService', () => ({
    inscricaoService: {
        uploadFotoEncontreiro: (...args: unknown[]) => uploadFotoEncontreiro(...args),
        definirFotoEncontreiro: (...args: unknown[]) => definirFotoEncontreiro(...args),
    },
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: (...args: unknown[]) => toastError(...args),
        loading: vi.fn(() => 'toast-id'),
    },
}));

const FOTO_URL = 'https://arquivos.example.test/fotos/encontreiros/p1.webp';

const semFoto: EncontreiroFotoTarget = { id: 'p1', nome: 'Integrante Teste', foto_url: null, foto_posicao_y: null };
const comFoto: EncontreiroFotoTarget = { ...semFoto, foto_url: FOTO_URL, foto_posicao_y: 30 };

// Input da galeria do MobileFileUploadButton (o da câmera usa o atributo capture).
const galleryInput = () => {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]:not([capture])');
    if (!input) throw new Error('Input de galeria não encontrado');
    return input;
};

describe('EncontreiroFotoModal', () => {
    beforeEach(() => {
        uploadFotoEncontreiro.mockReset();
        definirFotoEncontreiro.mockReset();
        toastError.mockReset();
    });
    afterEach(cleanup);

    it('não renderiza sem integrante selecionado', () => {
        render(<EncontreiroFotoModal target={null} onClose={vi.fn()} onChange={vi.fn()} />);
        expect(screen.queryByText('Sem foto')).not.toBeInTheDocument();
    });

    it('envia a foto e grava pela RPC com enquadramento padrão', async () => {
        const onChange = vi.fn();
        uploadFotoEncontreiro.mockResolvedValue(FOTO_URL);
        definirFotoEncontreiro.mockResolvedValue(undefined);
        render(<EncontreiroFotoModal target={semFoto} onClose={vi.fn()} onChange={onChange} />);

        expect(screen.getByRole('button', { name: /Adicionar foto/ })).toBeEnabled();
        const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
        fireEvent.change(galleryInput(), { target: { files: [file] } });

        await waitFor(() => expect(onChange).toHaveBeenCalledWith('p1', { foto_url: FOTO_URL, foto_posicao_y: 50 }));
        expect(uploadFotoEncontreiro).toHaveBeenCalledWith('p1', file);
        expect(definirFotoEncontreiro).toHaveBeenCalledWith('p1', FOTO_URL, 50);
    });

    it('ignora arquivos que não são imagem', () => {
        render(<EncontreiroFotoModal target={semFoto} onClose={vi.fn()} onChange={vi.fn()} />);

        const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.change(galleryInput(), { target: { files: [file] } });

        expect(uploadFotoEncontreiro).not.toHaveBeenCalled();
        expect(toastError).toHaveBeenCalled();
    });

    it('salva o enquadramento mantendo a foto atual', async () => {
        const onChange = vi.fn();
        definirFotoEncontreiro.mockResolvedValue(undefined);
        render(<EncontreiroFotoModal target={comFoto} onClose={vi.fn()} onChange={onChange} />);

        fireEvent.change(screen.getByLabelText('Enquadramento'), { target: { value: '70' } });
        fireEvent.click(screen.getByRole('button', { name: 'Salvar enquadramento' }));

        await waitFor(() => expect(onChange).toHaveBeenCalledWith('p1', { foto_url: FOTO_URL, foto_posicao_y: 70 }));
        expect(definirFotoEncontreiro).toHaveBeenCalledWith('p1', FOTO_URL, 70);
    });

    it('remove a foto somente após confirmação', async () => {
        const onChange = vi.fn();
        definirFotoEncontreiro.mockResolvedValue(undefined);
        render(<EncontreiroFotoModal target={comFoto} onClose={vi.fn()} onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: /Remover/ }));
        expect(definirFotoEncontreiro).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

        await waitFor(() => expect(onChange).toHaveBeenCalledWith('p1', { foto_url: null, foto_posicao_y: 50 }));
        expect(definirFotoEncontreiro).toHaveBeenCalledWith('p1', null);
    });

    it('mostra o erro do banco quando a permissão é negada', async () => {
        uploadFotoEncontreiro.mockResolvedValue(FOTO_URL);
        definirFotoEncontreiro.mockRejectedValue({
            code: '42501',
            message: 'Você não possui permissão para alterar a foto deste integrante',
        });
        render(<EncontreiroFotoModal target={semFoto} onClose={vi.fn()} onChange={vi.fn()} />);

        const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
        fireEvent.change(galleryInput(), { target: { files: [file] } });

        await waitFor(() => expect(toastError).toHaveBeenCalled());
        expect(toastError.mock.calls[0][0]).toMatch(/permissão/);
    });
});
