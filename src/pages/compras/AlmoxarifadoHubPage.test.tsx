import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../hooks/useAuth';
import { AlmoxarifadoHubPage } from './AlmoxarifadoHubPage';

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

const renderHubFor = (...permissions: string[]) => {
  mockedUseAuth.mockReturnValue({
    hasPermission: (permission: string) => permissions.includes(permission),
  } as ReturnType<typeof useAuth>);

  return render(
    <MemoryRouter>
      <AlmoxarifadoHubPage />
    </MemoryRouter>
  );
};

describe('AlmoxarifadoHubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra somente operação e histórico para o operador de compras', () => {
    renderHubFor('almoxarifado_compras_operar');

    expect(screen.getByRole('button', { name: /Lista de Compras/ }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compras Realizadas/ }))
      .toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Estoque/ }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Itens/ }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pedidos/ }))
      .not.toBeInTheDocument();
  });

  it('limita o coordenador à consulta de estoque e aos pedidos', () => {
    renderHubFor('modulo_coordenador');

    expect(screen.getByRole('button', { name: /^Estoque/ }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Itens/ }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pedidos/ }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compras Realizadas/ }))
      .toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lista de Compras/ }))
      .not.toBeInTheDocument();
  });
});
