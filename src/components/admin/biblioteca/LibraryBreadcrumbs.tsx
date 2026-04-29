import React from 'react';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import type { BibliotecaPasta } from '../../../services/bibliotecaService';

interface LibraryBreadcrumbsProps {
  breadcrumbs: BibliotecaPasta[];
  currentFolderId: string | null;
  onNavigate: (id: string | null) => void;
  stats: {
    foldersCount: number;
    filesCount: number;
    totalSizeFormatted: string;
  };
}

export const LibraryBreadcrumbs: React.FC<LibraryBreadcrumbsProps> = ({
  breadcrumbs,
  currentFolderId,
  onNavigate,
  stats
}) => {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', color: 'var(--text-color)' }}>
        {currentFolderId && (
          <button
            onClick={() => {
              const parentId = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null;
              onNavigate(parentId);
            }}
            style={{ background: 'none', border: 'none', color: 'var(--muted-text)', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}
            title="Voltar um nível"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <button
          onClick={() => onNavigate(null)}
          style={{ background: 'none', border: 'none', color: currentFolderId ? 'var(--primary-color)' : 'var(--text-color)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          <Home size={18} style={{ marginRight: '0.2rem' }} /> Início
        </button>

        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight size={14} color="var(--muted-text)" />
            <button
              onClick={() => onNavigate(crumb.id)}
              style={{
                background: 'none', border: 'none',
                color: idx === breadcrumbs.length - 1 ? 'var(--text-color)' : 'var(--primary-color)',
                fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                cursor: 'pointer', padding: 0
              }}
            >
              {crumb.nome}
            </button>
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted-text)', marginTop: '0.4rem' }}>
        {stats.foldersCount} pastas, {stats.filesCount} arquivos • {stats.totalSizeFormatted} utilizados nesta pasta
      </div>
    </div>
  );
};
