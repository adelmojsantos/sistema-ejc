import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EncontroProvider } from './EncontroContext';
import { EquipeProvider } from './EquipeContext';
import { encontroService } from '../services/encontroService';
import { equipeService } from '../services/equipeService';
import { useAuth } from '../hooks/useAuth';

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../services/encontroService', () => ({
  encontroService: { listar: vi.fn() },
}));
vi.mock('../services/equipeService', () => ({
  equipeService: { listar: vi.fn() },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedListarEncontros = vi.mocked(encontroService.listar);
const mockedListarEquipes = vi.mocked(equipeService.listar);

describe('providers administrativos em rotas públicas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não consulta encontros nem equipes sem sessão autenticada', async () => {
    mockedUseAuth.mockReturnValue({
      session: null,
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(
      <EncontroProvider>
        <EquipeProvider>
          <div>Página pública</div>
        </EquipeProvider>
      </EncontroProvider>
    );

    await waitFor(() => {
      expect(mockedListarEncontros).not.toHaveBeenCalled();
      expect(mockedListarEquipes).not.toHaveBeenCalled();
    });
  });

  it('carrega os caches quando há sessão autenticada', async () => {
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' } },
      loading: false,
    } as ReturnType<typeof useAuth>);
    mockedListarEncontros.mockResolvedValue([]);
    mockedListarEquipes.mockResolvedValue([]);

    render(
      <EncontroProvider>
        <EquipeProvider>
          <div>Área interna</div>
        </EquipeProvider>
      </EncontroProvider>
    );

    await waitFor(() => {
      expect(mockedListarEncontros).toHaveBeenCalledTimes(1);
      expect(mockedListarEquipes).toHaveBeenCalledTimes(1);
    });
  });
});
