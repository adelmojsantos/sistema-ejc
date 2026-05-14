import {
  FolderOpen,
  Upload,
  Loader,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { bibliotecaService, type BibliotecaArquivo, type BibliotecaPasta } from '../../services/bibliotecaService';
import { MoveItemModal } from './components/MoveItemModal';
import { SkeletonLibrary } from './components/SkeletonLibrary';
import { ShareItemModal } from './components/ShareItemModal';
import { useBiblioteca } from '../../hooks/useBiblioteca';
import { LibraryBreadcrumbs } from '../../components/admin/biblioteca/LibraryBreadcrumbs';
import { LibraryToolbar } from '../../components/admin/biblioteca/LibraryToolbar';
import { LibraryItem } from '../../components/admin/biblioteca/LibraryItem';
import { LibraryEmptyState } from '../../components/admin/biblioteca/LibraryEmptyState';

export function BibliotecaPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Nosso motor de orquestração
  const {
    pastas,
    arquivos,
    breadcrumbs,
    currentFolderId,
    loading,
    searchQuery,
    viewMode,
    filterType,
    sortBy,
    selectedItems,
    uploadProgress,
    isDeleting,
    actions
  } = useBiblioteca();

  // Estados locais para Modais
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<BibliotecaPasta | null>(null);

  const [fileRenameModalOpen, setFileRenameModalOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<BibliotecaArquivo | null>(null);
  const [fileName, setFileName] = useState('');

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemToMove, setItemToMove] = useState<{ id: string, name: string, type: 'pasta' | 'arquivo' } | null>(null);
  const [itemToShare, setItemToShare] = useState<{ id: string, name: string, type: 'pasta' | 'arquivo' } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'pasta' | 'arquivo' | 'batch';
    id?: string;
    arquivo?: BibliotecaArquivo;
    count?: number;
    message: string;
  } | null>(null);

  // Stats para breadcrumbs
  const folderStats = {
    foldersCount: pastas.length,
    filesCount: arquivos.length,
    totalSizeFormatted: arquivos.reduce((acc, curr) => acc + curr.tamanho_bytes, 0).toLocaleString('pt-BR') + ' bytes' // Simplificado para este exemplo
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handlers
  const handleCreateOrRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (renamingFolder) {
        await bibliotecaService.renomearPasta(renamingFolder.id, folderName);
        toast.success('Pasta renomeada.');
      } else {
        await bibliotecaService.criarPasta(folderName, currentFolderId);
        toast.success('Pasta criada.');
      }
      setFolderModalOpen(false);
      setFolderName('');
      setRenamingFolder(null);
      actions.refresh();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToRename || !fileName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await bibliotecaService.renomearArquivo(fileToRename.id, fileName);
      toast.success('Arquivo renomeado.');
      setFileRenameModalOpen(false);
      setFileToRename(null);
      setFileName('');
      actions.refresh();
    } catch (err: any) {
      toast.error('Erro ao renomear: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (arquivo: BibliotecaArquivo) => {
    try {
      const url = await bibliotecaService.gerarSignedUrl(arquivo.storage_path);
      window.open(url, '_blank');
    } catch (err: any) {
      toast.error('Erro ao gerar link de download: ' + err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'batch') {
      await actions.handleBatchDelete();
      setDeleteTarget(null);
      return;
    }

    try {
      if (deleteTarget.type === 'pasta' && deleteTarget.id) {
        await bibliotecaService.excluirPasta(deleteTarget.id);
        toast.success('Pasta excluída.');
      } else if (deleteTarget.type === 'arquivo' && deleteTarget.arquivo) {
        await bibliotecaService.excluirArquivo(deleteTarget.arquivo);
        toast.success('Arquivo excluído.');
      }
      actions.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  // Drag and Drop
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      actions.handleFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="app-shell" onDragEnter={onDragEnter} onDragOver={(e) => e.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
      {/* Overlay de Upload */}
      {isDragging && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
        }}>
          <div style={{
            border: '2px dashed var(--primary-color)', backgroundColor: 'var(--bg-color)',
            padding: '3rem 4rem', borderRadius: '16px', boxShadow: 'var(--shadow-float)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
          }}>
            <Upload size={48} color="var(--primary-color)" />
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--text-color)', margin: '0 0 0.5rem 0' }}>Solte os arquivos aqui</h2>
            </div>
          </div>
        </div>
      )}

      {/* Painel de Progresso de Upload Flutuante */}
      {uploadProgress.active && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '320px',
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--primary-color)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-float)',
          padding: '1.25rem',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Loader size={16} className="animate-spin" color="var(--primary-color)" /> Enviando Arquivos...
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)' }}>
              {uploadProgress.percent.toFixed(0)}%
            </span>
          </div>
          
          <div style={{ fontSize: '0.8rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Atual: {uploadProgress.currentFile}
          </div>

          <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${uploadProgress.percent}%`, 
              height: '100%', 
              backgroundColor: 'var(--primary-color)', 
              transition: 'width 0.3s ease' 
            }} />
          </div>
        </div>
      )}

      <main className="container page-fade-in" style={{ maxWidth: '100%', padding: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FolderOpen size={32} /> Biblioteca de Arquivos
        </h1>

        {/* Header Actions & Breadcrumbs */}
        <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--surface-1)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <LibraryBreadcrumbs
            breadcrumbs={breadcrumbs}
            currentFolderId={currentFolderId}
            onNavigate={actions.setCurrentFolderId}
            stats={folderStats}
          />

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-secondary" onClick={() => { setRenamingFolder(null); setFolderName(''); setFolderModalOpen(true); }}>
              Nova Pasta
            </button>
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress.active}>
              {uploadProgress.active ? (
                <><Loader size={16} className="animate-spin" /> {uploadProgress.percent.toFixed(0)}%</>
              ) : 'Enviar Arquivo'}
            </button>
            <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={e => actions.handleFileUpload(e.target.files)} />
          </div>
        </div>

        {/* Toolbar */}
        <LibraryToolbar
          selectedCount={selectedItems.size}
          totalItems={pastas.length + arquivos.length}
          searchQuery={searchQuery}
          filterType={filterType}
          sortBy={sortBy}
          viewMode={viewMode}
          onSearchChange={actions.setSearchQuery}
          onFilterChange={actions.setFilterType}
          onSortChange={actions.setSortBy}
          onViewModeChange={actions.setViewMode}
          onSelectAll={() => {
            const allIds = new Set([...pastas.map(p => p.id), ...arquivos.map(a => a.id)]);
            actions.setSelectedItems(allIds);
          }}
          onClearSelection={() => actions.setSelectedItems(new Set())}
          onBatchDownload={() => {
            const filesToDownload = arquivos.filter(a => selectedItems.has(a.id));
            filesToDownload.forEach(f => handleDownload(f));
          }}
          onBatchDelete={() => setDeleteTarget({ type: 'batch', count: selectedItems.size, message: `Excluir ${selectedItems.size} item(s) selecionado(s)?` })}
        />

        {/* Main Content Area */}
        <div style={{ 
          minHeight: pastas.length === 0 && arquivos.length === 0 ? 'auto' : '50vh', 
          marginTop: '1.5rem', 
          backgroundColor: 'var(--surface-1)', 
          borderRadius: '12px', 
          border: '1px solid var(--border-color)', 
          padding: viewMode === 'list' ? 0 : '1.5rem',
          overflow: 'hidden'
        }}>
          {loading ? (
            <SkeletonLibrary viewMode={viewMode} />
          ) : (
            <>
              {pastas.length === 0 && arquivos.length === 0 ? (
                <LibraryEmptyState 
                  onUploadClick={() => fileInputRef.current?.click()}
                  onCreateFolderClick={() => { setRenamingFolder(null); setFolderName(''); setFolderModalOpen(true); }}
                />
              ) : viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
                  {pastas.map(p => (
                    <LibraryItem
                      key={p.id} item={p} type="pasta" viewMode="grid"
                      isSelected={selectedItems.has(p.id)} isActiveDropdown={activeDropdown === p.id}
                      onToggleSelection={actions.toggleSelection} onToggleDropdown={setActiveDropdown}
                      onNavigate={actions.setCurrentFolderId} onDownload={() => {}}
                      onRename={(item) => { setRenamingFolder(item); setFolderName(item.nome); setFolderModalOpen(true); }}
                      onMove={(item) => { setItemToMove(item); setMoveModalOpen(true); }}
                      onShare={(item) => { setItemToShare(item); setShareModalOpen(true); }}
                      onDelete={(id) => setDeleteTarget({ type: 'pasta', id, message: 'Excluir esta pasta?' })}
                    />
                  ))}
                  {arquivos.map(a => (
                    <LibraryItem
                      key={a.id} item={a} type="arquivo" viewMode="grid"
                      isSelected={selectedItems.has(a.id)} isActiveDropdown={activeDropdown === a.id}
                      onToggleSelection={actions.toggleSelection} onToggleDropdown={setActiveDropdown}
                      onNavigate={() => {}} onDownload={handleDownload}
                      onPreview={handleDownload}
                      onRename={(item) => { setFileToRename(item); setFileName(item.nome_exibicao); setFileRenameModalOpen(true); }}
                      onMove={(item) => { setItemToMove(item); setMoveModalOpen(true); }}
                      onShare={(item) => { setItemToShare(item); setShareModalOpen(true); }}
                      onDelete={(arquivo) => setDeleteTarget({ type: 'arquivo', arquivo, message: `Excluir "${arquivo.nome_exibicao}"?` })}
                    />
                  ))}
                </div>
              ) : (
                /* List View */
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '1rem', width: '40px' }}></th>
                      <th style={{ padding: '1rem' }}>Nome</th>
                      <th style={{ padding: '1rem' }}>Tamanho</th>
                      <th style={{ padding: '1rem' }}>Data</th>
                      <th style={{ padding: '1rem', width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastas.map(p => (
                      <LibraryItem
                        key={p.id} item={p} type="pasta" viewMode="list"
                        isSelected={selectedItems.has(p.id)} isActiveDropdown={activeDropdown === p.id}
                        onToggleSelection={actions.toggleSelection} onToggleDropdown={setActiveDropdown}
                        onNavigate={actions.setCurrentFolderId} onDownload={() => {}}
                        onRename={(item) => { setRenamingFolder(item); setFolderName(item.nome); setFolderModalOpen(true); }}
                        onMove={(item) => { setItemToMove(item); setMoveModalOpen(true); }}
                        onShare={(item) => { setItemToShare(item); setShareModalOpen(true); }}
                        onDelete={(id) => setDeleteTarget({ type: 'pasta', id, message: 'Excluir esta pasta?' })}
                      />
                    ))}
                    {arquivos.map(a => (
                      <LibraryItem
                        key={a.id} item={a} type="arquivo" viewMode="list"
                        isSelected={selectedItems.has(a.id)} isActiveDropdown={activeDropdown === a.id}
                        onToggleSelection={actions.toggleSelection} onToggleDropdown={setActiveDropdown}
                        onNavigate={() => {}} onDownload={handleDownload}
                        onPreview={handleDownload}
                        onRename={(item) => { setFileToRename(item); setFileName(item.nome_exibicao); setFileRenameModalOpen(true); }}
                        onMove={(item) => { setItemToMove(item); setMoveModalOpen(true); }}
                        onShare={(item) => { setItemToShare(item); setShareModalOpen(true); }}
                        onDelete={(arquivo) => setDeleteTarget({ type: 'arquivo', arquivo, message: `Excluir "${arquivo.nome_exibicao}"?` })}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modais */}
      <Modal isOpen={folderModalOpen} onClose={() => setFolderModalOpen(false)} title={renamingFolder ? 'Renomear Pasta' : 'Nova Pasta'}>
        <form onSubmit={handleCreateOrRenameFolder}>
          <div className="form-group">
            <label className="form-label">Nome da Pasta</label>
            <input type="text" className="form-input" value={folderName} onChange={e => setFolderName(e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setFolderModalOpen(false)} disabled={isSubmitting}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader size={16} className="animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={fileRenameModalOpen} onClose={() => setFileRenameModalOpen(false)} title="Renomear Arquivo">
        <form onSubmit={handleRenameFile}>
          <div className="form-group">
            <label className="form-label">Nome do Arquivo</label>
            <input type="text" className="form-input" value={fileName} onChange={e => setFileName(e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setFileRenameModalOpen(false)} disabled={isSubmitting}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader size={16} className="animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {moveModalOpen && itemToMove && (
        <MoveItemModal
          isOpen={moveModalOpen}
          onClose={() => setMoveModalOpen(false)}
          itemIdToMove={itemToMove.id}
          itemName={itemToMove.name}
          itemType={itemToMove.type}
          currentFolderId={currentFolderId}
          onMove={async (targetFolderId) => {
            if (itemToMove.type === 'pasta') {
              await bibliotecaService.moverPasta(itemToMove.id, targetFolderId);
            } else {
              await bibliotecaService.moverArquivo(itemToMove.id, targetFolderId);
            }
            actions.refresh();
          }}
        />
      )}

      {shareModalOpen && itemToShare && (
        <ShareItemModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          itemId={itemToShare.id}
          itemName={itemToShare.name}
          itemType={itemToShare.type}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Confirmar Exclusão"
        message={deleteTarget?.message || ''}
        confirmText="Excluir"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}
