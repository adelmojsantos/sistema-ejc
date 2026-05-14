import React from 'react';
import { Search, CheckSquare, Square, Download, Trash2, LayoutGrid, List as ListIcon } from 'lucide-react';
import type { FilterType, SortBy, ViewMode } from '../../../hooks/useBiblioteca';

interface LibraryToolbarProps {
  selectedCount: number;
  totalItems: number;
  searchQuery: string;
  filterType: FilterType;
  sortBy: SortBy;
  viewMode: ViewMode;
  onSearchChange: (query: string) => void;
  onFilterChange: (filter: FilterType) => void;
  onSortChange: (sort: SortBy) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
  isReadOnly?: boolean;
}

export const LibraryToolbar: React.FC<LibraryToolbarProps> = ({
  selectedCount,
  totalItems,
  searchQuery,
  filterType,
  sortBy,
  viewMode,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onViewModeChange,
  onSelectAll,
  onClearSelection,
  onBatchDownload,
  onBatchDelete,
  isReadOnly = false
}) => {
  return (
    <div className="library-toolbar" style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '0.75rem', 
      backgroundColor: 'var(--surface-1)', 
      borderRadius: '8px', 
      border: '1px solid var(--border-color)', 
      flexWrap: 'wrap', 
      gap: '1rem' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
        <button
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', fontWeight: 600, color: selectedCount > 0 ? 'var(--primary-color)' : 'var(--text-color)' }}
          onClick={selectedCount === totalItems && totalItems > 0 ? onClearSelection : onSelectAll}
        >
          {selectedCount === totalItems && totalItems > 0 ? (
            <><CheckSquare size={18} style={{ marginRight: '0.4rem' }} /> Desmarcar Todos</>
          ) : selectedCount > 0 ? (
            <><CheckSquare size={18} style={{ marginRight: '0.4rem', opacity: 0.7 }} /> Selecionar Restante ({totalItems - selectedCount})</>
          ) : (
            <><Square size={18} style={{ marginRight: '0.4rem' }} /> Selecionar Tudo</>
          )}
        </button>

        {selectedCount > 0 ? (
          <div className="toolbar-batch-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={onBatchDownload}>
              <Download size={16} style={{ marginRight: '0.3rem' }} /> Baixar
            </button>
            {!isReadOnly && (
              <button className="btn-cancel text-danger" style={{ padding: '0.5rem 1rem' }} onClick={onBatchDelete}>
                <Trash2 size={16} style={{ marginRight: '0.3rem' }} /> Excluir
              </button>
            )}
          </div>
        ) : (
          <div className="form-group" style={{ marginBottom: 0, position: 'relative', minWidth: '320px', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar arquivos e pastas..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              style={{ paddingLeft: '2.8rem', width: '100%' }}
            />
          </div>
        )}
      </div>

      <div className="toolbar-filters" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
        <select 
          className="form-input" 
          value={filterType} 
          onChange={e => onFilterChange(e.target.value as FilterType)} 
          style={{ width: 'auto', minWidth: '180px' }}
        >
          <option value="all">Todos os tipos</option>
          <option value="folders">Somente Pastas</option>
          <option value="files">Somente Arquivos</option>
        </select>

        <select 
          className="form-input" 
          value={sortBy} 
          onChange={e => onSortChange(e.target.value as SortBy)} 
          style={{ width: 'auto', minWidth: '180px' }}
        >
          <option value="name">Nome (A-Z)</option>
          <option value="date">Modificado (Mais recentes)</option>
          <option value="size">Tamanho (Maior para menor)</option>
        </select>

        <div style={{ display: 'flex', backgroundColor: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', height: '100%' }}>
          <button
            onClick={() => onViewModeChange('grid')}
            style={{ 
              background: viewMode === 'grid' ? 'var(--primary-color)' : 'transparent', 
              color: viewMode === 'grid' ? '#fff' : 'var(--text-color)', 
              border: 'none', padding: '0 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '42px' 
            }}
          >
            <LayoutGrid size={20} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            style={{ 
              background: viewMode === 'list' ? 'var(--primary-color)' : 'transparent', 
              color: viewMode === 'list' ? '#fff' : 'var(--text-color)', 
              border: 'none', padding: '0 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '42px' 
            }}
          >
            <ListIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
