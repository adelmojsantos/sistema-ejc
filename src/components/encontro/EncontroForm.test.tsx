import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Encontro } from '../../types/encontro';
import { EncontroForm } from './EncontroForm';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../services/encontroService', () => ({
    encontroService: { uploadLogoEncontro: vi.fn() },
}));

const LOGO_URL = 'https://arquivos.example.test/fotos/quadrante/encontro-52-1.webp';

const encontro: Encontro = {
    id: 'encontro-52',
    nome: '52º EJC',
    data_inicio: '2027-01-29',
    data_fim: '2027-01-31',
    local: null,
    descricao: null,
    ativo: true,
    formulario_publico_ativo: false,
    created_at: '2026-08-11T00:00:00Z',
    edicao: 52,
    tema: null,
    musica: null,
    link_musica: null,
    link_youtube: null,
    limite_vagas_online: 0,
    valor_taxa: 0,
    logo_url: LOGO_URL,
};

describe('EncontroForm - logo do encontro', () => {
    afterEach(cleanup);

    it('permite criar o encontro sem logo', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<EncontroForm title="Novo Encontro" onSubmit={onSubmit} onCancel={vi.fn()} />);

        expect(screen.getByRole('button', { name: /Enviar logo/ })).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox', { name: /Nome do Encontro/ }), { target: { value: '53º EJC' } });
        fireEvent.change(screen.getByLabelText(/Data Início/), { target: { value: '2027-07-01' } });
        fireEvent.change(screen.getByLabelText(/Data Fim/), { target: { value: '2027-07-03' } });
        fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0]).toMatchObject({ nome: '53º EJC', logo_url: null });
    });

    it('envia a remoção do logo ao salvar a edição', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<EncontroForm title="Editando" initialData={encontro} onSubmit={onSubmit} onCancel={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /Remover/ }));
        fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0]).toMatchObject({ logo_url: null });
    });

    it('mantém o logo somente leitura em encontro encerrado', () => {
        render(
            <EncontroForm
                title="Editando"
                initialData={{ ...encontro, ativo: false, data_fim: '2025-01-31' }}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByText('Encontro encerrado: o logo é somente leitura.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Trocar logo/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Visualizar$/ })).toBeInTheDocument();
    });
});
