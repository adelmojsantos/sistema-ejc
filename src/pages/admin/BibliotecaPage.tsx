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
  Settings,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  bibliotecaService,
  type BibliotecaArquivo,
  type BibliotecaPasta,
  type GoogleDriveFolderDifference,
  type GoogleDriveIntegrationStatus,
  type GoogleDriveMissingItem,
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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import googleDriveLogo from '../../assets/google-drive.svg';

export function BibliotecaPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const isSystemAdmin = hasPermission('modulo_admin');
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
  const [isFolderRefreshing, setIsFolderRefreshing] = useState(false);
  const [googleSettingsOpen, setGoogleSettingsOpen] = useState(false);
  const [googleDifferencesOpen, setGoogleDifferencesOpen] = useState(false);
  const [googleDifferences, setGoogleDifferences] = useState<GoogleDriveFolderDifference[]>([]);
  const [googleMissingItems, setGoogleMissingItems] = useState<GoogleDriveMissingItem[]>([]);
  const [selectedGoogleDifferences, setSelectedGoogleDifferences] = useState<Set<string>>(new Set());
  const [selectedGoogleMissingItems, setSelectedGoogleMissingItems] = useState<Set<string>>(new Set());
  const [isScanningGoogleFolder, setIsScanningGoogleFolder] = useState(false);
  const [isShowingIgnoredGoogleItems, setIsShowingIgnoredGoogleItems] = useState(false);
  const [googleIgnoreConfirmOpen, setGoogleIgnoreConfirmOpen] = useState(false);
  const [pendingIgnoredGoogleIds, setPendingIgnoredGoogleIds] = useState<string[]>([]);
  const [googleMissingRemovalOpen, setGoogleMissingRemovalOpen] = useState(false);

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
    recursive?: boolean;
    message: string;
  } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
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
  const selectedFileCount = arquivos.filter((arquivo) => selectedItems.has(arquivo.id)).length;
  const selectedFolderCount = pastas.filter((pasta) => selectedItems.has(pasta.id)).length;
  const hasSelectedGoogleItem = arquivos.some((arquivo) => selectedItems.has(arquivo.id) && arquivo.origem === 'google_drive')
    || pastas.some((pasta) => selectedItems.has(pasta.id) && pasta.google_managed);
  const selectedGoogleUrls = [
    ...pastas.filter((pasta) => selectedItems.has(pasta.id) && pasta.google_managed).map((pasta) => pasta.url_externa),
    ...arquivos.filter((arquivo) => selectedItems.has(arquivo.id) && arquivo.origem === 'google_drive').map((arquivo) => arquivo.url_externa),
  ].filter((url): url is string => Boolean(url));
  const currentFolder = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
  const isCurrentFolderGoogle = Boolean(currentFolder?.google_managed);
  const selectedMissingGoogleItems = googleMissingItems.filter((item) => selectedGoogleMissingItems.has(item.libraryId));
  const selectedMissingGoogleDescendants = selectedMissingGoogleItems.reduce(
    (total, item) => total + item.descendantFolders + item.descendantFiles,
    0,
  );

  const handleRefreshCurrentFolder = async () => {
    setIsFolderRefreshing(true);
    try {
      const pendingIds = arquivos
        .filter((arquivo) => arquivo.google_managed
          && (arquivo.google_sync_status === 'pending' || arquivo.google_sync_status === 'error'))
        .slice(0, 25)
        .map((arquivo) => arquivo.id);

      if (pendingIds.length > 0) {
        const result = await bibliotecaService.sincronizarItemGoogle({ arquivoIds: pendingIds });
        const failures = result.results.reduce((total, item) => total + item.errors.length, 0);
        if (failures > 0) {
          toast.error(`${failures} permissão(ões) continuam pendentes.`);
        }
      }

      await Promise.all([actions.refresh(), loadGoogleStatus()]);
      toast.success(pendingIds.length > 0
        ? `Pasta atualizada; ${pendingIds.length} arquivo(s) processado(s).`
        : 'Pasta atualizada.');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a pasta.');
      await actions.refresh();
    } finally {
      setIsFolderRefreshing(false);
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
        if (isCurrentFolderGoogle && currentFolderId) {
          await bibliotecaService.criarPastaGoogle(folderName, currentFolderId);
        } else {
          await bibliotecaService.criarPasta(folderName, currentFolderId);
        }
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
    if ((editingGoogleFile && !googleName.trim()) || !googleUrl.trim() || isSubmitting) return;

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
          nome: googleName || undefined,
          url: googleUrl,
          pastaId: currentFolderId,
        });
        toast.success('Arquivo do Google adicionado e sincronizado.');
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

  const handleScanGoogleFolder = async (showIgnored = false) => {
    if (!currentFolderId || isScanningGoogleFolder) return;
    setIsScanningGoogleFolder(true);
    try {
      const result = await bibliotecaService.buscarDiferencasPastaGoogle(currentFolderId, showIgnored);
      setGoogleDifferences(result.items);
      setGoogleMissingItems(result.missingItems);
      setSelectedGoogleDifferences(new Set(result.items.filter((item) => !item.ignored).map((item) => item.id)));
      setSelectedGoogleMissingItems(new Set());
      setIsShowingIgnoredGoogleItems(showIgnored);
      setGoogleDifferencesOpen(true);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível sincronizar com Google Drive.');
    } finally {
      setIsScanningGoogleFolder(false);
    }
  };

  const submitGoogleDifferences = async (ignoredIds: string[]) => {
    if (!currentFolderId || isSubmitting) return;
    if (selectedGoogleDifferences.size === 0 && ignoredIds.length === 0) {
      setGoogleDifferencesOpen(false);
      setGoogleIgnoreConfirmOpen(false);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await bibliotecaService.importarItensPastaGoogle(
        currentFolderId,
        [...selectedGoogleDifferences],
        ignoredIds,
      );
      setGoogleDifferencesOpen(false);
      setGoogleIgnoreConfirmOpen(false);
      setGoogleDifferences([]);
      setSelectedGoogleDifferences(new Set());
      setPendingIgnoredGoogleIds([]);
      await Promise.all([actions.refresh(), loadGoogleStatus()]);
      if (result.syncFailures > 0) {
        toast.error(`${result.addedFiles} arquivo(s) adicionado(s), mas ${result.syncFailures} ainda possuem erro de sincronização.`);
      } else if (result.pending > 0) {
        toast.success(`${result.addedFolders} pasta(s) e ${result.addedFiles} arquivo(s) adicionados; ${result.pending} continuam na fila.`);
      } else {
        toast.success(`${result.addedFolders} pasta(s) e ${result.addedFiles} arquivo(s) adicionados e sincronizados.`);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível adicionar os itens selecionados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportGoogleDifferences = () => {
    const ignoredIds = googleDifferences
      .filter((item) => !item.ignored && !selectedGoogleDifferences.has(item.id))
      .map((item) => item.id);
    if (ignoredIds.length > 0) {
      setPendingIgnoredGoogleIds(ignoredIds);
      setGoogleDifferencesOpen(false);
      setGoogleIgnoreConfirmOpen(true);
      return;
    }
    void submitGoogleDifferences([]);
  };

  const handleRemoveGoogleMissingItems = async () => {
    if (selectedGoogleMissingItems.size === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const selected = googleMissingItems.filter((item) => selectedGoogleMissingItems.has(item.libraryId));
      const result = await bibliotecaService.removerItensAusentesDaBiblioteca({
        folderIds: selected.filter((item) => item.itemType === 'folder').map((item) => item.libraryId),
        fileIds: selected.filter((item) => item.itemType === 'file').map((item) => item.libraryId),
        confirmation: 'REMOVER',
      });
      setGoogleMissingRemovalOpen(false);
      setGoogleDifferencesOpen(false);
      setGoogleMissingItems([]);
      setSelectedGoogleMissingItems(new Set());
      await Promise.all([actions.refresh(), loadGoogleStatus()]);
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} item(ns) não puderam ser removidos da Biblioteca.`);
      } else {
        toast.success(`${result.deletedFolders} pasta(s) e ${result.deletedFiles} arquivo(s) removidos somente da Biblioteca.`);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover os itens da Biblioteca.');
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
        if (deleteTarget.recursive) {
          const result = await bibliotecaService.excluirItensRecursivamente({
            folderIds: pastas.filter((pasta) => selectedItems.has(pasta.id)).map((pasta) => pasta.id),
            fileIds: arquivos.filter((arquivo) => selectedItems.has(arquivo.id)).map((arquivo) => arquivo.id),
            confirmation: 'EXCLUIR',
          });
          const removed = result.deletedFiles + result.deletedFolders;
          if (removed > 0) toast.success(`${removed} item(s) removido(s).`);
          if (result.errors.length > 0) {
            toast.error(`${result.errors.length} item(s) não puderam ser excluídos.`);
          }
          actions.setSelectedItems(new Set());
        } else {
          await actions.handleBatchDelete();
        }
      } else if (deleteTarget.type === 'pasta' && deleteTarget.id) {
        const result = await bibliotecaService.excluirItensRecursivamente({
          folderIds: [deleteTarget.id],
          fileIds: [],
          confirmation: 'EXCLUIR',
        });
        const removed = result.deletedFiles + result.deletedFolders;
        if (result.errors.length > 0) {
          toast.error(`${result.errors.length} item(s) não puderam ser excluídos.`);
        } else {
          toast.success(`${removed} item(s) removido(s).`);
        }
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
      setDeleteConfirmation('');
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
      if (isCurrentFolderGoogle) {
        toast.error('Pastas do Google Drive não aceitam arquivos do armazenamento do Sistema EJC. Use Enviar ao Google.');
        return;
      }
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

      <main className="container page-fade-in library-page" style={{ maxWidth: '100%', padding: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FolderOpen size={32} /> Biblioteca de Arquivos
        </h1>

        <section
          className="library-google-integration"
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
              <img src={googleDriveLogo} alt="" width={26} height={26} />
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
          <div className="library-google-actions" style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            {googleStatus?.connected ? (
              <>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={handleSyncGoogle}
                  disabled={isGoogleActionLoading}
                >
                  {isGoogleActionLoading ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Sincronizar
                </button>
                <button
                  type="button"
                  className="btn-secondary-sm"
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
                  className="btn-primary-sm"
                  onClick={() => setGoogleCreateModalOpen(true)}
                  disabled={isGoogleActionLoading}
                >
                  <FilePlus2 size={16} /> Criar no Google
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary-sm"
                onClick={handleConnectGoogle}
                disabled={isGoogleActionLoading}
              >
                {isGoogleActionLoading ? <Loader size={16} className="animate-spin" /> : <Cloud size={16} />}
                Conectar conta Google
              </button>
            )}
            {isSystemAdmin && (
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setGoogleSettingsOpen(true)}
                aria-label="Abrir configurações avançadas do Google Drive"
                title="Configurações avançadas"
              >
                <Settings size={17} />
                <span className="library-google-settings-label">Configurações</span>
              </button>
            )}
          </div>
        </section>

        {/* Header Actions & Breadcrumbs */}
        <div className="page-header library-folder-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: 'var(--surface-1)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <LibraryBreadcrumbs
            breadcrumbs={breadcrumbs}
            currentFolderId={currentFolderId}
            onNavigate={actions.setCurrentFolderId}
            stats={folderStats}
          />

          <div className="library-folder-header__actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => { setRenamingFolder(null); setFolderName(''); setFolderModalOpen(true); }}>
              Nova Pasta
            </button>
            {!isCurrentFolderGoogle && <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress.active}>
              {uploadProgress.active ? (
                <><Loader size={16} className="animate-spin" /> {uploadProgress.percent.toFixed(0)}%</>
              ) : 'Enviar Arquivo'}
            </button>}
            <button className="btn-secondary" onClick={() => openGoogleModal()} disabled={uploadProgress.active}>
              <ExternalLink size={16} /> Vincular link existente
            </button>
            {isCurrentFolderGoogle && (
              <button className="btn-secondary" onClick={() => void handleScanGoogleFolder()} disabled={isScanningGoogleFolder}>
                {isScanningGoogleFolder ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {isScanningGoogleFolder ? 'Buscando...' : 'Atualizar do Drive'}
              </button>
            )}
            <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={e => actions.handleFileUpload(e.target.files)} />
          </div>
        </div>

        {/* Toolbar */}
        <LibraryToolbar
          selectedCount={selectedItems.size}
          selectedFileCount={selectedFileCount}
          selectedFolderCount={selectedFolderCount}
          canBatchDownload={!hasSelectedGoogleItem}
          selectedGoogleCount={selectedGoogleUrls.length}
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
          onBatchDelete={() => {
            setDeleteConfirmation('');
            setDeleteTarget({
              type: 'batch',
              count: selectedItems.size,
              recursive: selectedFolderCount > 0,
              message: selectedFolderCount > 0
                ? `Excluir recursivamente ${selectedItems.size} item(s) selecionado(s)? Todos os arquivos e subpastas contidos nas pastas selecionadas também serão removidos.`
                : `Excluir ${selectedItems.size} arquivo(s) selecionado(s)?`,
            });
          }}
          onOpenGoogle={() => {
            selectedGoogleUrls.forEach((url) => window.open(url, '_blank', 'noopener,noreferrer'));
          }}
          onRefresh={() => void handleRefreshCurrentFolder()}
          isRefreshing={isFolderRefreshing}
        />

        {/* Main Content Area */}
        <div className="library-items-panel" style={{
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
                      onDelete={(id) => {
                        setDeleteConfirmation('');
                        setDeleteTarget({ type: 'pasta', id, recursive: true, message: 'Excluir esta pasta e todo o seu conteúdo?' });
                      }}
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
                        onDelete={(id) => {
                          setDeleteConfirmation('');
                          setDeleteTarget({ type: 'pasta', id, recursive: true, message: 'Excluir esta pasta e todo o seu conteúdo?' });
                        }}
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
        isOpen={googleSettingsOpen}
        onClose={() => setGoogleSettingsOpen(false)}
        title="Configurações do Google Drive"
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <strong>Ferramentas avançadas</strong>
            <p className="text-muted" style={{ margin: '0.35rem 0 0', lineHeight: 1.5 }}>
              Operações excepcionais de manutenção e migração do acervo.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '0.9rem 1rem' }}
            onClick={() => navigate('/biblioteca/importar-drive')}
          >
            <CloudUpload size={18} />
            Importar de outro Drive
          </button>
          <small className="text-muted">
            Conecta temporariamente outra conta sem substituir a conta institucional.
          </small>
          <button
            type="button"
            className="btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '0.9rem 1rem' }}
            onClick={handleConnectGoogle}
            disabled={isGoogleActionLoading}
          >
            {isGoogleActionLoading ? <Loader size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Reautorizar conta oficial
          </button>
          <small className="text-muted">
            Necessário uma vez para permitir a busca seletiva de arquivos adicionados diretamente no Drive.
          </small>
        </div>
      </Modal>

      <Modal
        isOpen={googleModalOpen}
        onClose={() => setGoogleModalOpen(false)}
        title={editingGoogleFile ? 'Editar referência do Google' : 'Adicionar do Google Drive'}
      >
        <form onSubmit={handleGoogleReferenceSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="google-reference-name">
              Nome exibido {editingGoogleFile ? '' : '(opcional)'}
            </label>
            <input
              id="google-reference-name"
              type="text"
              className="form-input"
              value={googleName}
              onChange={e => setGoogleName(e.target.value)}
              autoFocus
              required={Boolean(editingGoogleFile)}
            />
            {!editingGoogleFile && <small className="text-muted">Se ficar vazio, será usado o nome informado pelo Google Drive.</small>}
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
          {editingGoogleFile && <div className="form-group">
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
          </div>}
          <div style={{ padding: '0.9rem', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.08)', fontSize: '0.85rem', lineHeight: 1.5 }}>
            O sistema consultará o arquivo no Drive, identificará seu tipo e sincronizará as permissões configuradas na Biblioteca.
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setGoogleModalOpen(false)} disabled={isSubmitting}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || !googleUrl.trim() || Boolean(editingGoogleFile && !googleName.trim())}>
              {isSubmitting ? <Loader size={16} className="animate-spin" /> : editingGoogleFile ? 'Salvar referência' : 'Adicionar e sincronizar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={googleDifferencesOpen}
        onClose={() => !isSubmitting && setGoogleDifferencesOpen(false)}
        title="Comparar com o Google Drive"
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          {googleDifferences.length === 0 ? (
            <p className="text-muted" style={{ margin: 0 }}>A pasta já está atualizada. Nenhum item novo foi encontrado.</p>
          ) : (
            <>
              <p className="text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Todos os itens novos estão selecionados. Desmarque aqueles que devem permanecer somente no Google Drive.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={selectedGoogleDifferences.size === googleDifferences.length}
                  onChange={(event) => setSelectedGoogleDifferences(event.target.checked
                    ? new Set(googleDifferences.map((item) => item.id))
                    : new Set())}
                />
                Selecionar todos ({googleDifferences.length})
              </label>
              <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '50vh', overflowY: 'auto' }}>
                {googleDifferences.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem',
                      border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGoogleDifferences.has(item.id)}
                      onChange={() => setSelectedGoogleDifferences((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })}
                    />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{item.name}</strong>
                      <small className="text-muted">
                        {item.itemType === 'folder' ? 'Pasta' : 'Arquivo'}{item.ignored ? ' · ignorado anteriormente' : ''}
                      </small>
                      <small className="text-muted" style={{ display: 'block', overflowWrap: 'anywhere' }}>
                        Em: {item.path}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
          {googleMissingItems.length > 0 && (
            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div>
                <strong>Não encontrados nesta pasta ({googleMissingItems.length})</strong>
                <p className="text-muted" style={{ margin: '0.3rem 0 0', lineHeight: 1.5 }}>
                  Nada será removido automaticamente. Selecione somente os registros que deseja retirar da Biblioteca.
                </p>
              </div>
              <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '35vh', overflowY: 'auto' }}>
                {googleMissingItems.map((item) => {
                  const statusLabel = item.status === 'trashed'
                    ? 'Na lixeira do Drive'
                    : item.status === 'moved'
                      ? 'Movido para outra pasta no Drive'
                      : 'Excluído definitivamente ou sem acesso';
                  const descendants = item.descendantFolders + item.descendantFiles;
                  return (
                    <div
                      key={item.libraryId}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem',
                        border: '1px solid var(--border-color)', borderRadius: '8px',
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${item.name} para remoção da Biblioteca`}
                        checked={selectedGoogleMissingItems.has(item.libraryId)}
                        onChange={() => setSelectedGoogleMissingItems((current) => {
                          const next = new Set(current);
                          if (next.has(item.libraryId)) next.delete(item.libraryId);
                          else next.add(item.libraryId);
                          return next;
                        })}
                      />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{item.name}</strong>
                        <small style={{ color: item.status === 'trashed' ? '#f59e0b' : 'var(--muted-text)' }}>
                          {statusLabel}{descendants > 0 ? ` · contém ${descendants} item(ns) cadastrados` : ''}
                        </small>
                      </span>
                      {item.url && (
                        <a className="btn-secondary" href={item.url} target="_blank" rel="noreferrer" style={{ padding: '0.45rem 0.65rem' }}>
                          <ExternalLink size={15} /> Abrir
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={selectedGoogleMissingItems.size === 0 || isSubmitting}
                  onClick={() => {
                    setGoogleDifferencesOpen(false);
                    setGoogleMissingRemovalOpen(true);
                  }}
                >
                  Remover selecionados da Biblioteca
                </button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {!isShowingIgnoredGoogleItems && (
              <button type="button" className="btn-secondary" onClick={() => void handleScanGoogleFolder(true)} disabled={isSubmitting || isScanningGoogleFolder}>
                Mostrar ignorados
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={() => setGoogleDifferencesOpen(false)} disabled={isSubmitting}>Fechar</button>
            {googleDifferences.length > 0 && (
              <button type="button" className="btn-primary" onClick={handleImportGoogleDifferences} disabled={isSubmitting}>
                {isSubmitting ? <Loader size={16} className="animate-spin" /> : 'Continuar'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={googleIgnoreConfirmOpen}
        onClose={() => {
          if (isSubmitting) return;
          setGoogleIgnoreConfirmOpen(false);
          setGoogleDifferencesOpen(true);
        }}
        title="Ignorar itens definitivamente?"
      >
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Você desmarcou {pendingIgnoredGoogleIds.length} item(ns). Deseja ocultá-los das próximas buscas e mantê-los somente no Google Drive?
          </p>
          <p className="text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
            Eles poderão ser recuperados posteriormente pela opção “Mostrar ignorados”.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={isSubmitting}
              onClick={() => {
                setGoogleIgnoreConfirmOpen(false);
                setGoogleDifferencesOpen(true);
              }}
            >
              Voltar
            </button>
            <button type="button" className="btn-secondary" disabled={isSubmitting} onClick={() => void submitGoogleDifferences([])}>
              Só nesta busca
            </button>
            <button type="button" className="btn-primary" disabled={isSubmitting} onClick={() => void submitGoogleDifferences(pendingIgnoredGoogleIds)}>
              {isSubmitting ? <Loader size={16} className="animate-spin" /> : 'Ignorar definitivamente'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={googleMissingRemovalOpen}
        onClose={() => {
          if (isSubmitting) return;
          setGoogleMissingRemovalOpen(false);
          setGoogleDifferencesOpen(true);
        }}
        title="Remover somente da Biblioteca?"
      >
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Serão removidos {selectedMissingGoogleItems.length} item(ns) selecionados
            {selectedMissingGoogleDescendants > 0 ? ` e ${selectedMissingGoogleDescendants} item(ns) internos` : ''} do catálogo da Biblioteca.
          </p>
          <p style={{ margin: 0, lineHeight: 1.5, color: '#f59e0b', fontWeight: 600 }}>
            Esta ação não excluirá, moverá nem alterará nenhum arquivo no Google Drive.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={isSubmitting}
              onClick={() => {
                setGoogleMissingRemovalOpen(false);
                setGoogleDifferencesOpen(true);
              }}
            >
              Cancelar
            </button>
            <button type="button" className="btn-primary" disabled={isSubmitting} onClick={() => void handleRemoveGoogleMissingItems()}>
              {isSubmitting ? <Loader size={16} className="animate-spin" /> : 'Remover da Biblioteca'}
            </button>
          </div>
        </div>
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
        message={deleteTarget?.recursive ? (
          <div>
            <p style={{ marginTop: 0 }}>{deleteTarget.message}</p>
            <p style={{ color: '#ef4444', fontWeight: 700 }}>
              Esta operação é definitiva no Sistema EJC.
            </p>
            <label className="form-label" htmlFor="biblioteca-delete-confirmation">
              Para confirmar, digite <strong>EXCLUIR</strong>
            </label>
            <input
              id="biblioteca-delete-confirmation"
              className="form-input"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoComplete="off"
              autoFocus
              style={{ marginTop: '0.45rem' }}
            />
          </div>
        ) : deleteTarget?.message || ''}
        confirmText="Excluir"
        loadingText="Excluindo..."
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleteInFlightRef.current) {
            setDeleteTarget(null);
            setDeleteConfirmation('');
          }
        }}
        isLoading={isDeleting || isDeleteSubmitting}
        isConfirmDisabled={Boolean(
          deleteTarget?.recursive && deleteConfirmation.trim().toUpperCase() !== 'EXCLUIR'
        )}
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
