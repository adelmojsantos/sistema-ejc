import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LibraryToolbar } from './LibraryToolbar';

const baseProps = {
  selectedCount: 1,
  selectedFileCount: 0,
  selectedFolderCount: 1,
  canBatchDownload: true,
  selectedGoogleCount: 0,
  totalItems: 1,
  searchQuery: '',
  filterType: 'all' as const,
  sortBy: 'name' as const,
  viewMode: 'grid' as const,
  onSearchChange: vi.fn(),
  onFilterChange: vi.fn(),
  onSortChange: vi.fn(),
  onViewModeChange: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  onBatchDownload: vi.fn(),
  onBatchDelete: vi.fn(),
  onOpenGoogle: vi.fn(),
  onRefresh: vi.fn(),
};

describe('LibraryToolbar', () => {
  it('não oferece download quando somente pastas estão selecionadas', () => {
    render(<LibraryToolbar {...baseProps} />);

    expect(screen.queryByRole('button', { name: /baixar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /excluir/i })).toBeInTheDocument();
  });

  it('explicita que somente os arquivos serão baixados em uma seleção mista', () => {
    render(
      <LibraryToolbar
        {...baseProps}
        selectedCount={3}
        selectedFileCount={2}
        selectedFolderCount={1}
        totalItems={3}
      />,
    );

    expect(screen.getByRole('button', { name: 'Baixar arquivos (2)' })).toBeInTheDocument();
  });

  it('troca download por abrir no Drive quando a seleção possui item Google', () => {
    render(
      <LibraryToolbar
        {...baseProps}
        selectedCount={2}
        selectedFileCount={1}
        selectedFolderCount={1}
        selectedGoogleCount={2}
        canBatchDownload={false}
        totalItems={2}
      />,
    );

    expect(screen.queryByRole('button', { name: /baixar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir no Drive (2)' })).toBeInTheDocument();
  });
});
