import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EncontroLogoField } from './EncontroLogoField';

const uploadLogoEncontro = vi.fn();

vi.mock('../../services/encontroService', () => ({
    encontroService: {
        uploadLogoEncontro: (...args: unknown[]) => uploadLogoEncontro(...args),
    },
}));

vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

const LOGO_URL = 'https://arquivos.example.test/fotos/quadrante/encontro-52-1.webp';

describe('EncontroLogoField', () => {
    beforeEach(() => uploadLogoEncontro.mockReset());
    afterEach(cleanup);

    it('é opcional: sem logo mostra o estado vazio e permite enviar', () => {
        render(<EncontroLogoField logoUrl={null} onChange={vi.fn()} />);

        expect(screen.getByText('Sem logo')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Enviar logo/ })).toBeEnabled();
        expect(screen.queryByRole('button', { name: /Visualizar/ })).not.toBeInTheDocument();
    });

    it('envia o logo de um encontro ainda não criado e devolve a URL ao formulário', async () => {
        const onChange = vi.fn();
        const onUploadingChange = vi.fn();
        uploadLogoEncontro.mockResolvedValue(LOGO_URL);
        render(<EncontroLogoField logoUrl={null} onChange={onChange} onUploadingChange={onUploadingChange} />);

        const file = new File(['logo'], 'logo.png', { type: 'image/png' });
        fireEvent.change(screen.getByTestId('encontro-logo-input'), { target: { files: [file] } });

        await waitFor(() => expect(onChange).toHaveBeenCalledWith(LOGO_URL));
        expect(uploadLogoEncontro).toHaveBeenCalledWith(file, undefined);
        expect(onUploadingChange).toHaveBeenNthCalledWith(1, true);
        expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    });

    it('ignora arquivos que não são imagem', () => {
        const onChange = vi.fn();
        render(<EncontroLogoField logoUrl={null} encontroId="encontro-52" onChange={onChange} />);

        const file = new File(['%PDF'], 'logo.pdf', { type: 'application/pdf' });
        fireEvent.change(screen.getByTestId('encontro-logo-input'), { target: { files: [file] } });

        expect(uploadLogoEncontro).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('permite trocar e remover o logo existente', () => {
        const onChange = vi.fn();
        render(<EncontroLogoField logoUrl={LOGO_URL} encontroId="encontro-52" onChange={onChange} />);

        expect(screen.getByRole('button', { name: /Trocar logo/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Remover/ }));

        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('fica somente leitura em encontro encerrado, mantendo visualizar e baixar', () => {
        render(
            <EncontroLogoField
                logoUrl={LOGO_URL}
                onChange={vi.fn()}
                readOnlyMessage="Encontro encerrado: o logo é somente leitura."
            />,
        );

        expect(screen.getByText('Encontro encerrado: o logo é somente leitura.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Trocar logo/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Visualizar$/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Baixar/ })).toBeInTheDocument();
    });

    it('no Quadrante mostra apenas a prévia, com dica e link para o cadastro do encontro', () => {
        render(
            <MemoryRouter>
                <EncontroLogoField
                    logoUrl={LOGO_URL}
                    encontroNome="52º EJC"
                    editPath="/cadastros/encontros/encontro-52/editar#logo-encontro"
                />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('button', { name: /Trocar logo/ })).not.toBeInTheDocument();
        expect(screen.getByRole('tooltip')).toHaveTextContent('O logo é cadastrado e atualizado no cadastro do encontro');
        expect(screen.getByRole('button', { name: 'Onde alterar o logo' })).toHaveAccessibleDescription(
            /cadastro do encontro/,
        );
        expect(screen.getByRole('link', { name: /Alterar no cadastro do encontro/ })).toHaveAttribute(
            'href',
            '/cadastros/encontros/encontro-52/editar#logo-encontro',
        );
    });

    it('abre a visualização ampliada com dimensões, formato e link para nova aba', () => {
        render(<EncontroLogoField logoUrl={LOGO_URL} encontroNome="52º EJC" />);

        fireEvent.click(screen.getByRole('button', { name: /^Visualizar$/ }));

        const enlarged = screen.getByRole('img', { name: 'Logo 52º EJC em tamanho ampliado' });
        Object.defineProperty(enlarged, 'naturalWidth', { value: 1200 });
        Object.defineProperty(enlarged, 'naturalHeight', { value: 800 });
        fireEvent.load(enlarged);

        expect(screen.getByText(/1200 × 800 px · WebP/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Abrir em nova aba/ })).toHaveAttribute('href', LOGO_URL);

        fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
        expect(screen.queryByRole('img', { name: /em tamanho ampliado/ })).not.toBeInTheDocument();
    });
});
