import React from 'react';
import { 
  Folder, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  File as FileIcon, 
  MoreVertical, 
  CheckSquare, 
  Square,
  FolderOpen,
  Edit2,
  CornerUpRight,
  Trash2,
  Download,
  Link,
  Share2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { bibliotecaService, type BibliotecaArquivo, type BibliotecaPasta } from '../../../services/bibliotecaService';

interface LibraryItemProps {
  item: BibliotecaPasta | BibliotecaArquivo;
  type: 'pasta' | 'arquivo';
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  isActiveDropdown: boolean;
  onToggleSelection: (id: string, e?: React.MouseEvent) => void;
  onToggleDropdown: (id: string | null) => void;
  onNavigate: (id: string) => void;
  onDownload: (arquivo: BibliotecaArquivo) => void;
  onRename: (item: any) => void;
  onMove: (item: any) => void;
  onShare: (item: any) => void;
  onDelete: (item: any) => void;
  isReadOnly?: boolean;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return <FileText size={24} color="#ef4444" />;
  if (mimeType.includes('image')) return <ImageIcon size={24} color="#8b5cf6" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return <FileSpreadsheet size={24} color="#10b981" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText size={24} color="#3b82f6" />;
  return <FileIcon size={24} color="#64748b" />;
};

export const LibraryItem: React.FC<LibraryItemProps> = ({
  item,
  type,
  viewMode,
  isSelected,
  isActiveDropdown,
  onToggleSelection,
  onToggleDropdown,
  onNavigate,
  onDownload,
  onRename,
  onMove,
  onShare,
  onDelete,
  isReadOnly = false
}) => {
  const isPasta = type === 'pasta';
  const pasta = item as BibliotecaPasta;
  const arquivo = item as BibliotecaArquivo;

  const handleDoubleClick = () => {
    if (isPasta) onNavigate(pasta.id);
    else onDownload(arquivo);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleDropdown(null);
    if (isPasta) return;
    try {
      const url = await bibliotecaService.gerarSignedUrl(arquivo.storage_path);
      await navigator.clipboard.writeText(url);
      toast.success('Link de acesso copiado! (Válido por 1h)');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  if (viewMode === 'grid') {
    return (
      <div
        className="library-card"
        onDoubleClick={handleDoubleClick}
        style={{
          padding: '1.25rem',
          border: `1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
          position: 'relative',
          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'var(--surface-1)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {isPasta ? (
              <Folder size={32} color="var(--primary-color)" style={{ flexShrink: 0 }} />
            ) : (
              <div style={{ padding: '0.4rem', backgroundColor: 'var(--surface-1)', borderRadius: '8px' }}>
                {getFileIcon(arquivo.tipo_mime)}
              </div>
            )}
            <div>
              <span 
                style={{ fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} 
                title={isPasta ? pasta.nome : arquivo.nome_exibicao}
              >
                {isPasta ? pasta.nome : arquivo.nome_exibicao}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.2rem' }}>
            <div
              onClick={(e) => { e.stopPropagation(); onToggleSelection(item.id, e); }}
              style={{ cursor: 'pointer', color: isSelected ? 'var(--primary-color)' : 'var(--muted-text)', opacity: isSelected ? 1 : 0.4, transition: 'all 0.2s', alignSelf: 'center', marginRight: '0.3rem' }}
            >
              {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleDropdown(isActiveDropdown ? null : item.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', opacity: 0.6, display: isReadOnly && isPasta ? 'none' : 'block' }}
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        {!isPasta && (
          <div style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>
            {formatFileSize(arquivo.tamanho_bytes)}
          </div>
        )}

        {isActiveDropdown && (
          <div style={{
            position: 'absolute', top: '3rem', right: '10px',
            backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-color)',
            borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 10, minWidth: '160px', padding: '0.5rem 0'
          }}>
            {isPasta ? (
              <>
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onNavigate(pasta.id); }}>
                  <FolderOpen size={14} /> Abrir
                </button>
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onRename(pasta); }}>
                  <Edit2 size={14} /> Renomear
                </button>
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onMove({ id: pasta.id, name: pasta.nome, type: 'pasta' }); }}>
                  <CornerUpRight size={14} /> Mover para...
                </button>
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onShare({ id: pasta.id, name: pasta.nome, type: 'pasta' }); }}>
                  <Share2 size={14} /> Compartilhar
                </button>
                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                <button className="dropdown-item text-danger" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onDelete(pasta.id); }}>
                  <Trash2 size={14} /> Excluir
                </button>
              </>
            ) : (
              <>
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onDownload(arquivo); }}>
                  <Download size={14} /> Baixar
                </button>
                <button className="dropdown-item" onClick={handleCopyLink}>
                  <Link size={14} /> Copiar Link
                </button>
                {!isReadOnly && (
                  <>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onRename(arquivo); }}>
                      <Edit2 size={14} /> Renomear
                    </button>
                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onMove({ id: arquivo.id, name: arquivo.nome_exibicao, type: 'arquivo' }); }}>
                      <CornerUpRight size={14} /> Mover para...
                    </button>
                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onShare({ id: arquivo.id, name: arquivo.nome_exibicao, type: 'arquivo' }); }}>
                      <Share2 size={14} /> Compartilhar
                    </button>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                    <button className="dropdown-item text-danger" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onDelete(arquivo); }}>
                      <Trash2 size={14} /> Excluir
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // List View
  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'transparent', transition: 'background-color 0.2s' }}>
      <td style={{ padding: '1rem' }}>
        <div
          onClick={(e) => { e.stopPropagation(); onToggleSelection(item.id, e); }}
          style={{ cursor: 'pointer', color: isSelected ? 'var(--primary-color)' : 'var(--muted-text)', opacity: isSelected ? 1 : 0.4, transition: 'all 0.2s' }}
        >
          {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
        </div>
      </td>
      <td style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onDoubleClick={handleDoubleClick}>
          {isPasta ? (
            <Folder size={20} color="var(--primary-color)" />
          ) : (
            getFileIcon(arquivo.tipo_mime)
          )}
          <span style={{ fontWeight: 500 }}>{isPasta ? pasta.nome : arquivo.nome_exibicao}</span>
        </div>
      </td>
      <td style={{ padding: '1rem', color: 'var(--muted-text)' }}>
        {isPasta ? '--' : formatFileSize(arquivo.tamanho_bytes)}
      </td>
      <td style={{ padding: '1rem', color: 'var(--muted-text)' }}>
        {new Date(item.created_at).toLocaleDateString()}
      </td>
      <td style={{ padding: '1rem', position: 'relative' }}>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleDropdown(isActiveDropdown ? null : item.id); }} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}
        >
          <MoreVertical size={16} />
        </button>
        {isActiveDropdown && (
          <div style={{
            position: 'absolute', top: '100%', right: '10px',
            backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-color)',
            borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 10, minWidth: '160px', padding: '0.5rem 0'
          }}>
            {/* Same Menu as Grid, can be further refactored if needed */}
            {isPasta ? (
              <>
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onNavigate(pasta.id); }}>
                  <FolderOpen size={14} /> Abrir
                </button>
                {!isReadOnly && (
                  <>
                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onRename(pasta); }}>
                      <Edit2 size={14} /> Renomear
                    </button>
                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onShare({ id: pasta.id, name: pasta.nome, type: 'pasta' }); }}>
                      <Share2 size={14} /> Compartilhar
                    </button>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                    <button className="dropdown-item text-danger" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onDelete(pasta.id); }}>
                      <Trash2 size={14} /> Excluir
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onDownload(arquivo); }}>
                  <Download size={14} /> Baixar
                </button>
                {!isReadOnly && (
                  <>
                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onShare({ id: arquivo.id, name: arquivo.nome_exibicao, type: 'arquivo' }); }}>
                      <Share2 size={14} /> Compartilhar
                    </button>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                    <button className="dropdown-item text-danger" onClick={(e) => { e.stopPropagation(); onToggleDropdown(null); onDelete(arquivo); }}>
                      <Trash2 size={14} /> Excluir
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
};
