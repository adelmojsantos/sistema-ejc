import React from 'react';
import { FolderOpen, Upload, Plus, MousePointer2 } from 'lucide-react';

interface LibraryEmptyStateProps {
  onUploadClick: () => void;
  onCreateFolderClick: () => void;
}

export const LibraryEmptyState: React.FC<LibraryEmptyStateProps> = ({
  onUploadClick,
  onCreateFolderClick
}) => {
  return (
    <div style={{
      textAlign: 'center',
      padding: '3rem 2rem',
      backgroundColor: 'var(--surface-1)',
      borderRadius: '24px',
      border: '2px dashed var(--border-color)',
      transition: 'all 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '120px',
        height: '120px',
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '2rem',
        position: 'relative'
      }}>
        <FolderOpen size={56} color="var(--primary-color)" style={{ opacity: 0.8 }} />
        <div style={{
          position: 'absolute',
          bottom: '5px',
          right: '5px',
          backgroundColor: 'var(--primary-color)',
          borderRadius: '50%',
          padding: '8px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <Upload size={20} color="#fff" />
        </div>
      </div>

      <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-color)' }}>
        Nenhum arquivo ou pasta encontrado.
      </h3>

      <p style={{
        color: 'var(--muted-text)',
        maxWidth: '460px',
        fontSize: '1.1rem',
        lineHeight: '1.6',
        marginBottom: '2.5rem'
      }}>
        <strong>Arraste e solte seus arquivos para esta janela</strong>.
      </p>

      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className="btn-secondary"
          onClick={onCreateFolderClick}
          style={{
            padding: '0.8rem 2rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontWeight: 600,
            transition: 'transform 0.2s'
          }}
        >
          <Plus size={20} /> Nova Pasta
        </button>

        <button
          className="btn-primary"
          onClick={onUploadClick}
          style={{
            padding: '0.8rem 2rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
            transition: 'transform 0.2s'
          }}
        >
          <Upload size={20} /> Enviar Arquivos
        </button>
      </div>

      <div style={{
        marginTop: '3rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: 'var(--muted-text)',
        fontSize: '0.9rem',
        opacity: 0.6
      }}>
        <MousePointer2 size={16} />
        <span>Suporta arrastar e soltar múltiplos arquivos</span>
      </div>
    </div>
  );
};
