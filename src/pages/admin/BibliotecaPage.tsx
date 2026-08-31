import {
  FolderOpen,
  Upload,
  Loader,
  ExternalLink,
  Cloud,
  FilePlus2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  CloudUpload,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  bibliotecaService,
  type BibliotecaArquivo,
  type BibliotecaPasta,
  type GoogleDriveIntegrationStatus,
} from '../../services/bibliotecaService';
import { MoveItemModal } from './components/MoveItemModal';
import { SkeletonLibrary } from './components/SkeletonLibrary';
import { ShareItemModal } from './components/ShareItemModal';
import { useBiblioteca } from '../../hooks/useBiblioteca';
import { LibraryBreadcrumbs } from '../../components/admin/biblioteca/LibraryBreadcrumbs';
import { LibraryToolbar } from '../../components/admin/biblioteca/LibraryToolbar';
import { LibraryItem } from '../../components/admin/biblioteca/LibraryItem';
import { LibraryEmptyState } from '../../components/admin/biblioteca/LibraryEmptyState';
import type { GoogleDriveFileType } from '../../utils/googleDriveLink';

export function BibliotecaPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const googleUploadInputRef = useRef<HTMLInputElement>(null);
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

  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [editingGoogleFile, setEditingGoogleFile] = useState<BibliotecaArquivo | null>(null);
  const [googleName, setGoogleName] = useState('');
  const [googleUrl, setGoogleUrl] = useState('');
  const [googleType, setGoogleType] = useState<GoogleDriveFileType>('file');
  const [googleCreateModalOpen, setGoogleCreateModalOpen] = useState(false);
  const [newGoogleName, setNewGoogleName] = useState('');
  const [newGoogleType, setNewGoogleType] = useState<'document' | 'spreadsheet'>('document');
  const [googleStatus, setGoogleStatus] = useState<GoogleDriveIntegrationStatus | null>(null);
  const [googleStatusError, setGoogleStatusError] = useState<string | null>(null);
  const [isGoogleActionLoading, setIsGoogleActionLoading] = useState(false);
  const [isGoogleUploading, setIsGoogleUploading] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemToMove, setItemToMove] = useState<{ id: string, name: string, type: 'pasta' | 'arquivo' } | null>(null);
  const [itemToShare, setItemToShare] = useState<{
    id: string;
    name: string;
    type: 'pasta' | 'arquivo';
    isGoogleDrive?: boolean;
    isGoogleManaged?: boolean;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'pasta' | 'arquivo' | 'batch';
    id?: string;
    arquivo?: BibliotecaArquivo;
    count?: number;
    message: string;
  } | null>(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const deleteInFlightRef = useRef(false);
  const [googleImportTarget, setGoogleImportTarget] = useState<BibliotecaArquivo | null>(null);
  const [isGoogleImporting, setIsGoogleImporting] = useState(false);
  const googleImportInFlightRef = useRef(false);

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

  const loadGoogleStatus = useCallback(async () => {
    try {
      const status = await bibliotecaService.obterStatusGoogleDrive();
      setGoogleStatus(status);
      setGoogleStatusError(null);
    } catch (error: unknown) {
      setGoogleStatus(null);
      setGoogleStatusError(error instanceof Error ? error.message : 'Não foi possível consultar a integração.');
    }
  }, []);

  useEffect(() => {
    void loadGoogleStatus();

    const url = new URL(window.location.href);
    const googleResult = url.searchParams.get('google');
    if (googleResult === 'connected') toast.success('Conta Google conectada com sucesso.');
    if (googleResult === 'denied') toast.error('A conexão com o Google foi cancelada.');
    if (googleResult === 'account_mismatch') {
      toast.error('Use a mesma conta central já vinculada aos arquivos gerenciados.');
    }
    if (googleResult) {
      url.searchParams.delete('google');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [loadGoogleStatus]);

  const handleConnectGoogle = async () => {
    setIsGoogleActionLoading(true);
    try {
      const authorizationUrl = await bibliotecaService.iniciarConexaoGoogleDrive();
      window.location.assign(authorizationUrl);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao iniciar conexão com o Google.');
      setIsGoogleActionLoading(false);
    }
  };

  const handleSyncGoogle = async () => {
    setIsGoogleActionLoading(true);
    try {
      const result = await bibliotecaService.sincronizarGoogleDrive(25);
      const failures = result.results.reduce((total, item) => total + item.errors.length, 0);
      if (failures > 0) {
        toast.error(`${failures} permissão(ões) continuam pendentes.`);
      } else {
        toast.success('Permissões do Google sincronizadas.');
      }
      await loadGoogleStatus();
      actions.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao sincronizar permissões.');
    } finally {
      setIsGoogleActionLoading(false);
    }
  };

  const handleCreateGoogleFile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newGoogleName.trim() || isGoogleActionLoading) return;
    setIsGoogleActionLoading(true);
    try {
      const result = await bibliotecaService.criarArquivoGoogle({
        name: newGoogleName,
        fileType: newGoogleType,
        pastaId: currentFolderId,
      });
      setGoogleCreateModalOpen(false);
      setNewGoogleName('');
      actions.refresh();
      await loadGoogleStatus();
      if (result.syncErrors.length > 0) {
        toast.success('Arquivo criado; algumas permissões ficaram pendentes.');
      } else {
        toast.success(newGoogleType === 'spreadsheet'
          ? 'Planilha criada no Google Drive.'
          : 'Documento criado no Google Drive.');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar arquivo no Google.');
    } finally {
      setIsGoogleActionLoading(false);
    }
  };

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
    } catch (error: unknown) {
      toast.error('Erro: ' + (error instanceof Error ? error.message : 'falha desconhecida.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToRename || !fileName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (fileToRename.google_managed) {
        await bibliotecaService.renomearArquivoGoogle(fileToRename.id, fileName);
      } else {
        await bibliotecaService.renomearArquivo(fileToRename.id, fileName);
      }
      toast.success('Arquivo renomeado.');
      setFileRenameModalOpen(false);
      setFileToRename(null);
      setFileName('');
      actions.refresh();
    } catch (error: unknown) {
      toast.error('Erro ao renomear: ' + (error instanceof Error ? error.message : 'falha desconhecida.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openGoogleModal = (arquivo?: BibliotecaArquivo) => {
    setEditingGoogleFile(arquivo ?? null);
    setGoogleName(arquivo?.nome_exibicao ?? '');
    setGoogleUrl(arquivo?.url_externa ?? '');
    setGoogleType(arquivo?.google_tipo ?? 'file');
    setGoogleModalOpen(true);
  };

  const handleGoogleReferenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleName.trim() || !googleUrl.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingGoogleFile) {
        await bibliotecaService.atualizarReferenciaGoogle({
          id: editingGoogleFile.id,
          nome: googleName,
          url: googleUrl,
          tipo: googleType,
        });
        toast.success('Referência do Google atualizada.');
      } else {
        await bibliotecaService.cadastrarReferenciaGoogle({
          nome: googleName,
          url: googleUrl,
          pastaId: currentFolderId,
          tipo: googleType,
        });
        toast.success('Documento do Google adicionado.');
      }

      setGoogleModalOpen(false);
      setEditingGoogleFile(null);
      actions.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar a referência do Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileRenameAction = (arquivo: BibliotecaArquivo) => {
    if (arquivo.origem === 'google_drive' && !arquivo.google_managed) {
      openGoogleModal(arquivo);
      return;
    }

    setFileToRename(arquivo);
    setFileName(arquivo.nome_exibicao);
    setFileRenameModalOpen(true);
  };

  const handleDownload = async (arquivo: BibliotecaArquivo) => {
    try {
      await bibliotecaService.baixarArquivo(arquivo);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida.';
      toast.error(arquivo.origem === 'google_drive' ? message : `Erro ao gerar link de download: ${message}`);
    }
  };

  const handlePreview = async (arquivo: BibliotecaArquivo) => {
    try {
      await bibliotecaService.abrirArquivo(arquivo);
    } catch (error: unknown) {
      toast.error('Erro ao abrir arquivo: ' + (error instanceof Error ? error.message : 'falha desconhecida.'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setIsDeleteSubmitting(true);

    try {
      if (deleteTarget.type === 'batch') {
        await actions.handleBatchDelete();
      } else if (deleteTarget.type === 'pasta' && deleteTarget.id) {
        await bibliotecaService.excluirPasta(deleteTarget.id);
        toast.success('Pasta excluída.');
      } else if (deleteTarget.type === 'arquivo' && deleteTarget.arquivo) {
        if (deleteTarget.arquivo.google_managed) {
          await bibliotecaService.moverArquivoGoogleParaLixeira(deleteTarget.arquivo.id);
          toast.success('Arquivo movido para a lixeira do Google Drive.');
        } else {
          await bibliotecaService.excluirArquivo(deleteTarget.arquivo);
          toast.success(deleteTarget.arquivo.origem === 'google_drive' ? 'Referência removida.' : 'Arquivo excluído.');
        }
      }
      actions.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir o item.');
    } finally {
      deleteInFlightRef.current = false;
      setIsDeleteSubmitting(false);
      setDeleteTarget(null);
    }
  };

  const handleMoveToGoogle = async () => {
    if (!googleImportTarget || googleImportInFlightRef.current) return;
    googleImportInFlightRef.current = true;
    setIsGoogleImporting(true);
    try {
      const result = await bibliotecaService.moverArquivoEditavelParaGoogle(googleImportTarget.id);
      if (result.syncErrors.length > 0) {
        toast.error('O arquivo foi convertido, mas há uma pendência na sincronização de acesso.');
      } else {
        toast.success('Arquivo convertido e movido para o Google Drive.');
      }
      actions.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível mover o arquivo para o Google.');
    } finally {
      googleImportInFlightRef.current = false;
      setIsGoogleImporting(false);
      setGoogleImportTarget(null);
    }
  };

  const handleUploadToGoogle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0 || isGoogleUploading) return;

    setIsGoogleUploading(true);
    let successCount = 0;
    try {
      for (const file of files) {
        try {
          const result = await bibliotecaService.uploadArquivoEditavelGoogle(file, currentFolderId);
          successCount++;
          if (result.syncErrors.length > 0) {
            toast.error(`"${file.name}" foi convertido, mas possui pendência de acesso.`);
          }
        } catch (error: unknown) {
          toast.error(`Erro ao enviar "${file.name}": ${error instanceof Error ? error.message : 'falha desconhecida.'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`${successCount} arquivo(s) enviado(s) ao Google Drive.`);
        actions.refresh();
        await loadGoogleStatus();
      }
    } finally {
      setIsGoogleUploading(false);
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

        <section
          aria-label="Integração com Google Drive"
          style={{
            marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '12px',
            border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: googleStatus?.connected ? '#10b981' : 'var(--muted-text)',
              backgroundColor: googleStatus?.connected ? 'rgba(16,185,129,0.12)' : 'var(--surface-2)'
            }}>
              <Cloud size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                Google Drive
                {googleStatus?.connected && <CheckCircle2 size={16} color="#10b981" />}
                {googleStatusError && <AlertTriangle size={16} color="#f59e0b" />}
              </strong>
              <div style={{ fontSize: '0.82rem', opacity: 0.65, overflowWrap: 'anywhere' }}>
                {googleStatus?.connected
                  ? `${googleStatus.accountEmail} · ${googleStatus.pendingCount} pendência(s) · ${googleStatus.errorCount} erro(s)`
                  : googleStatusError ?? 'Conecte a conta central para criar arquivos e automatizar permissões.'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            {googleStatus?.connected ? (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSyncGoogle}
                  disabled={isGoogleActionLoading}
                >
                  {isGoogleActionLoading ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Sincronizar
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => googleUploadInputRef.current?.click()}
                  disabled={isGoogleActionLoading || isGoogleUploading}
                >
                  {isGoogleUploading ? <Loader size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                  {isGoogleUploading ? 'Enviando...' : 'Enviar ao Google'}
                </button>
                <input
                  ref={googleUploadInputRef}
                  type="file"
                  accept=".doc,.docx,.txt,.csv,.xlsx"
                  multiple
                  hidden
                  onChange={handleUploadToGoogle}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setGoogleCreateModalOpen(true)}
                  disabled={isGoogleActionLoading}
                >
                  <FilePlus2 size={16} /> Criar no Google
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleConnectGoogle}
                disabled={isGoogleActionLoading}
              >
                {isGoogleActionLoading ? <Loader size={16} className="animate-spin" /> : <Cloud size={16} />}
                Conectar conta Google
              </button>
            )}
          </div>
        </section>

        {/* Header Actions & Breadcrumbs */}
        <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: 'var(--surface-1)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <LibraryBreadcrumbs
            breadcrumbs={breadcrumbs}
            currentFolderId={currentFolderId}
            onNavigate={actions.setCurrentFolderId}
            stats={folderStats}
          />

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => { setRenamingFolder(null); setFolderName(''); setFolderModalOpen(true); }}>
              Nova Pasta
            </button>
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress.active}>
              {uploadProgress.active ? (
                <><Loader size={16} className="animate-spin" /> {uploadProgress.percent.toFixed(0)}%</>
              ) : 'Enviar Arquivo'}
            </button>
            <button className="btn-secondary" onClick={() => openGoogleModal()} disabled={uploadProgress.active}>
              <ExternalLink size={16} /> Vincular link existente
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
          position: 'relative'
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
                      onPreview={handlePreview}
                      onRename={handleFileRenameAction}
                      onMove={(item) => { setItemToMove(item); setMoveModalOpen(true); }}
                      onShare={(item) => { setItemToShare({ ...item, isGoogleDrive: a.origem === 'google_drive', isGoogleManaged: a.google_managed }); setShareModalOpen(true); }}
                      onMoveToGoogle={setGoogleImportTarget}
                      onDelete={(arquivo) => setDeleteTarget({ type: 'arquivo', arquivo, message: arquivo.google_managed ? `Mover "${arquivo.nome_exibicao}" para a lixeira do Google Drive? As permissões criadas pelo sistema serão removidas.` : arquivo.origem === 'google_drive' ? `Remover a referência "${arquivo.nome_exibicao}"? O arquivo permanecerá no Google Drive.` : `Excluir "${arquivo.nome_exibicao}"?` })}
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
                        onPreview={handlePreview}
                        onRename={handleFileRenameAction}
                        onMove={(item) => { setItemToMove(item); setMoveModalOpen(true); }}
                        onShare={(item) => { setItemToShare({ ...item, isGoogleDrive: a.origem === 'google_drive', isGoogleManaged: a.google_managed }); setShareModalOpen(true); }}
                        onMoveToGoogle={setGoogleImportTarget}
                        onDelete={(arquivo) => setDeleteTarget({ type: 'arquivo', arquivo, message: arquivo.google_managed ? `Mover "${arquivo.nome_exibicao}" para a lixeira do Google Drive? As permissões criadas pelo sistema serão removidas.` : arquivo.origem === 'google_drive' ? `Remover a referência "${arquivo.nome_exibicao}"? O arquivo permanecerá no Google Drive.` : `Excluir "${arquivo.nome_exibicao}"?` })}
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

      <Modal
        isOpen={googleCreateModalOpen}
        onClose={() => setGoogleCreateModalOpen(false)}
        title="Criar arquivo no Google Drive"
      >
        <form onSubmit={handleCreateGoogleFile}>
          <div className="form-group">
            <label className="form-label" htmlFor="new-google-file-name">Nome</label>
            <input
              id="new-google-file-name"
              className="form-input"
              value={newGoogleName}
              onChange={(event) => setNewGoogleName(event.target.value)}
              maxLength={200}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-google-file-type">Tipo</label>
            <select
              id="new-google-file-type"
              className="form-input"
              value={newGoogleType}
              onChange={(event) => setNewGoogleType(event.target.value as 'document' | 'spreadsheet')}
            >
              <option value="document">Documento Google</option>
              <option value="spreadsheet">Planilha Google</option>
            </select>
          </div>
          <div style={{ padding: '0.9rem', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.08)', fontSize: '0.85rem', lineHeight: 1.5 }}>
            O arquivo será criado na conta Google central e registrado na pasta atual da Biblioteca.
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setGoogleCreateModalOpen(false)}
              disabled={isGoogleActionLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isGoogleActionLoading || !newGoogleName.trim()}
            >
              {isGoogleActionLoading ? <Loader size={16} className="animate-spin" /> : <FilePlus2 size={16} />}
              Criar arquivo
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={googleModalOpen}
        onClose={() => setGoogleModalOpen(false)}
        title={editingGoogleFile ? 'Editar referência do Google' : 'Adicionar do Google Drive'}
      >
        <form onSubmit={handleGoogleReferenceSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="google-reference-name">Nome exibido</label>
            <input
              id="google-reference-name"
              type="text"
              className="form-input"
              value={googleName}
              onChange={e => setGoogleName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="google-reference-url">Link do Google</label>
            <input
              id="google-reference-url"
              type="url"
              className="form-input"
              value={googleUrl}
              onChange={e => setGoogleUrl(e.target.value)}
              placeholder="https://docs.google.com/..."
              required
            />
            <small className="text-muted">Aceita links oficiais do Google Docs, Sheets e Drive.</small>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="google-reference-type">Tipo do conteúdo</label>
            <select
              id="google-reference-type"
              className="form-input"
              value={googleType}
              onChange={e => setGoogleType(e.target.value as GoogleDriveFileType)}
            >
              <option value="document">Documento</option>
              <option value="spreadsheet">Planilha</option>
              <option value="file">Arquivo do Drive</option>
            </select>
            <small className="text-muted">Links do Docs e Sheets são identificados automaticamente.</small>
          </div>
          <div style={{ padding: '0.9rem', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.08)', fontSize: '0.85rem', lineHeight: 1.5 }}>
            Links vinculados manualmente ainda exigem compartilhamento manual no Drive. A seleção segura de arquivos existentes será adicionada pelo Google Picker.
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setGoogleModalOpen(false)} disabled={isSubmitting}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || !googleName.trim() || !googleUrl.trim()}>
              {isSubmitting ? <Loader size={16} className="animate-spin" /> : 'Salvar referência'}
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
          isGoogleDrive={itemToShare.isGoogleDrive}
          isGoogleManaged={itemToShare.isGoogleManaged}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Confirmar Exclusão"
        message={deleteTarget?.message || ''}
        confirmText="Excluir"
        loadingText="Excluindo..."
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleteInFlightRef.current) setDeleteTarget(null);
        }}
        isLoading={isDeleting || isDeleteSubmitting}
      />
      <ConfirmDialog
        isOpen={!!googleImportTarget}
        title="Mover para o Google Drive"
        message={`Converter "${googleImportTarget?.nome_exibicao ?? ''}" para um arquivo editável do Google? O original só será removido do armazenamento após a conversão e a sincronização concluírem.`}
        confirmText="Mover para o Google"
        loadingText="Convertendo..."
        onConfirm={handleMoveToGoogle}
        onCancel={() => {
          if (!googleImportInFlightRef.current) setGoogleImportTarget(null);
        }}
        isLoading={isGoogleImporting}
      />
    </div>
  );
}
