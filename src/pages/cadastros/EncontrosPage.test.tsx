import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Encontro } from '../../types/encontro';
import { EncontrosPage } from './EncontrosPage';

const encontro: Encontro = {
  id: 'encontro-52',
  nome: '52º EJC',
  data_inicio: '2027-01-29',
  data_fim: '2027-01-31',
  local: 'Salão Nossa Senhora Aparecida',
  descricao: null,
  ativo: true,
  formulario_publico_ativo: true,
  created_at: '2026-08-11T00:00:00Z',
  edicao: 52,
  tema: 'Tema do encontro',
  musica: 'Música-tema',
  link_musica: null,
  link_youtube: null,
  limite_vagas_online: 100,
  valor_taxa: 100,
  pix_taxa_chave: 'pix@example.test',
  pix_taxa_tipo: 'email',
};

const listar = vi.fn();

vi.mock('../../services/encontroService', () => ({
  encontroService: {
    listar: (...args: unknown[]) => listar(...args),
    criar: vi.fn(),
    atualizar: vi.fn(),
    excluir: vi.fn(),
  },
}));

describe('EncontrosPage deep link', () => {
  beforeEach(() => {
    listar.mockReset();
    listar.mockResolvedValue([encontro]);
  });

  it('abre diretamente a edição do encontro informado na rota', async () => {
    render(
      <MemoryRouter initialEntries={['/cadastros/encontros/encontro-52/editar']}>
        <Routes>
          <Route path="/cadastros/encontros/:id/editar" element={<EncontrosPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Editando: 52º EJC' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tema do encontro')).toBeInTheDocument();
  });
});
