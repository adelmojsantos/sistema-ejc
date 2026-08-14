import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encontroService } from '../services/encontroService';
import type { Encontro } from '../types/encontro';
import { useAuth } from '../hooks/useAuth';
import { EncontroProvider, useEncontros } from './EncontroContext';

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../services/encontroService', () => ({
  encontroService: { listar: vi.fn() },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedListar = vi.mocked(encontroService.listar);

const encontro = (id: string, ativo: boolean): Encontro => ({
  id,
  nome: `${id} EJC`,
  data_inicio: '2026-01-01',
  data_fim: '2026-01-03',
  local: null,
  descricao: null,
  ativo,
  formulario_publico_ativo: false,
  created_at: '2026-01-01T00:00:00Z',
  edicao: ativo ? 52 : 51,
  tema: null,
  musica: null,
  link_musica: null,
  link_youtube: null,
  limite_vagas_online: 0,
  valor_taxa: 0,
});

function ContextProbe() {
  const { encontroSelecionadoId, encontroAtivo, selecionarEncontro, selecaoBloqueada } = useEncontros();
  return (
    <div>
      <span data-testid="selected">{encontroSelecionadoId}</span>
      <span data-testid="active">{encontroAtivo?.id ?? ''}</span>
      <span data-testid="locked">{String(selecaoBloqueada)}</span>
      <button type="button" onClick={() => selecionarEncontro('historico')}>Selecionar histórico</button>
    </div>
  );
}

describe('contexto global do encontro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedListar.mockResolvedValue([
      encontro('historico', false),
      encontro('ativo', true),
    ]);
  });

  it('restaura a seleção válida armazenada para o usuário', async () => {
    localStorage.setItem('encontro-selecionado:user-1', 'historico');
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' } },
      loading: false,
      hasPermission: vi.fn(() => false),
      userParticipacao: null,
    } as unknown as ReturnType<typeof useAuth>);

    render(<EncontroProvider><ContextProbe /></EncontroProvider>);

    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('historico'));
    expect(screen.getByTestId('active')).toHaveTextContent('ativo');
  });

  it('usa o encontro ativo quando a seleção armazenada deixou de existir', async () => {
    localStorage.setItem('encontro-selecionado:user-1', 'removido');
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' } },
      loading: false,
      hasPermission: vi.fn(() => false),
      userParticipacao: null,
    } as unknown as ReturnType<typeof useAuth>);

    render(<EncontroProvider><ContextProbe /></EncontroProvider>);

    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('ativo'));
  });

  it('persiste uma troca válida somente no espaço do usuário atual', async () => {
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' } },
      loading: false,
      hasPermission: vi.fn(() => false),
      userParticipacao: null,
    } as unknown as ReturnType<typeof useAuth>);

    render(<EncontroProvider><ContextProbe /></EncontroProvider>);
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('ativo'));

    act(() => screen.getByRole('button', { name: 'Selecionar histórico' }).click());

    expect(screen.getByTestId('selected')).toHaveTextContent('historico');
    expect(localStorage.getItem('encontro-selecionado:user-1')).toBe('historico');
    expect(localStorage.getItem('encontro-selecionado:user-2')).toBeNull();
  });

  it('mantém o coordenador restrito no encontro da própria participação', async () => {
    const hasPermission = vi.fn((permission: string) => permission === 'modulo_coordenador');
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'coordenador-1' } },
      loading: false,
      hasPermission,
      userParticipacao: { encontro_id: 'ativo', coordenador: true },
    } as unknown as ReturnType<typeof useAuth>);

    render(<EncontroProvider><ContextProbe /></EncontroProvider>);
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('ativo'));

    act(() => screen.getByRole('button', { name: 'Selecionar histórico' }).click());

    expect(screen.getByTestId('locked')).toHaveTextContent('true');
    expect(screen.getByTestId('selected')).toHaveTextContent('ativo');
    expect(localStorage.getItem('encontro-selecionado:coordenador-1')).toBeNull();
  });
});
