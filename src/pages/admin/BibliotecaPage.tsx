import {
  ArrowLeft,
  CheckSquare,
  ChevronRight,
  CornerUpRight,
  Download,
  Edit2,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  Link,
  List as ListIcon,
  Loader,
  MoreVertical,
  Search,
  Square,
  Trash2,
  Upload
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { bibliotecaService, type BibliotecaArquivo, type BibliotecaPasta } from '../../services/bibliotecaService';
import { MoveItemModal } from './components/MoveItemModal';
import { SkeletonLibrary } from './components/SkeletonLibrary';

// Utility for formatting file size se estiver faltando
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

export function BibliotecaPage() {

  // State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [pastas, setPastas] = useState<BibliotecaPasta[]>([]);
  const [arquivos, setArquivos] = useState<BibliotecaArquivo[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BibliotecaPasta[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<BibliotecaPasta | null>(null);

  const [fileRenameModalOpen, setFileRenameModalOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<BibliotecaArquivo | null>(null);
  const [fileName, setFileName] = useState('');

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean, percent: number }>({ active: false, percent: 0 });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'pasta' | 'arquivo' | 'batch';
    id?: string;
    arquivo?: BibliotecaArquivo;
    count?: number;
    message: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New States for UI improvements
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'all' | 'folders' | 'files'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Move Modal State
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [itemToMove, setItemToMove] = useState<{ id: string, name: string, type: 'pasta' | 'arquivo' } | null>(null);

  // Stats
  const folderStats = {
    foldersCount: pastas.length,
    filesCount: arquivos.length,
    totalSize: arquivos.reduce((acc, curr) => acc + curr.tamanho_bytes, 0)
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pastasData, arquivosData] = await Promise.all([
        bibliotecaService.listarPastas(currentFolderId),
        bibliotecaService.listarArquivos(currentFolderId)
      ]);
      setPastas(pastasData);
      setArquivos(arquivosData);

      if (currentFolderId) {
        const paths = await bibliotecaService.getPastaBreadcrumbs(currentFolderId);
        setBreadcrumbs(paths);
      } else {
        setBreadcrumbs([]);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar biblioteca: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setSelectedItems(new Set());
  }, [currentFolderId]);

  // Folder Actions
  const handleCreateOrRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

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
      loadData();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const handleDeleteFolderClick = (id: string) => {
    setDeleteTarget({ type: 'pasta', id, message: 'Tem certeza que deseja excluir esta pasta e todo seu conteúdo?' });
  };

  // File Actions
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    const validFiles = Array.from(files).filter(f => {
      if (f.size > MAX_SIZE) {
        toast.error(`Arquivo "${f.name}" excede 50MB e será ignorado.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploadProgress({ active: true, percent: 0 });

    // Upload files sequentially for simplicity
    for (let i = 0; i < validFiles.length; i++) {
      try {
        await bibliotecaService.uploadArquivo(validFiles[i], currentFolderId, (percent) => {
          setUploadProgress({ active: true, percent });
        });
      } catch (err: any) {
        toast.error(`Erro ao subir ${validFiles[i].name}: ${err.message}`);
      }
    }

    setUploadProgress({ active: false, percent: 0 });
    toast.success('Upload concluído!');
    loadData();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRenameFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToRename || !fileName.trim()) return;

    try {
      await bibliotecaService.renomearArquivo(fileToRename.id, fileName);
      toast.success('Arquivo renomeado.');
      setFileRenameModalOpen(false);
      setFileToRename(null);
      setFileName('');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao renomear: ' + err.message);
    }
  };

  const handleDeleteFileClick = (arquivo: BibliotecaArquivo) => {
    setDeleteTarget({ type: 'arquivo', arquivo, message: `Tem certeza que deseja excluir o arquivo "${arquivo.nome_exibicao}"?` });
  };

  const handleDownload = async (arquivo: BibliotecaArquivo) => {
    try {
      const url = await bibliotecaService.gerarSignedUrl(arquivo.storage_path);
      window.open(url, '_blank');
    } catch (err: any) {
      toast.error('Erro ao gerar link de download: ' + err.message);
    }
  };

  // Drag and Drop
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Filtering & Sorting
  let filteredPastas = pastas.filter(p => p.nome.toLowerCase().includes(searchQuery.toLowerCase()));
  let filteredArquivos = arquivos.filter(a => a.nome_exibicao.toLowerCase().includes(searchQuery.toLowerCase()));

  if (filterType === 'files') filteredPastas = [];
  if (filterType === 'folders') filteredArquivos = [];

  if (sortBy === 'name') {
    filteredPastas.sort((a, b) => a.nome.localeCompare(b.nome));
    filteredArquivos.sort((a, b) => a.nome_exibicao.localeCompare(b.nome_exibicao));
  } else if (sortBy === 'date') {
    filteredPastas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    filteredArquivos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else if (sortBy === 'size') {
    filteredArquivos.sort((a, b) => b.tamanho_bytes - a.tamanho_bytes);
  }

  // Selection
  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const toggleSelectAll = () => {
    const totalItems = filteredPastas.length + filteredArquivos.length;
    if (selectedItems.size === totalItems && totalItems > 0) {
      setSelectedItems(new Set());
    } else {
      const newSet = new Set<string>();
      filteredPastas.forEach(p => newSet.add(p.id));
      filteredArquivos.forEach(a => newSet.add(a.id));
      setSelectedItems(newSet);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedItems.size === 0) return;
    const itemsToDownload = arquivos.filter(a => selectedItems.has(a.id));
    if (itemsToDownload.length === 0) {
      toast.error('Nenhum arquivo selecionado para baixar (pastas não suportadas).');
      return;
    }

    toast.success('Iniciando downloads...');
    for (const file of itemsToDownload) {
      handleDownload(file);
      // Small delay to prevent browser blocking multiple popups aggressively
      await new Promise(res => setTimeout(res, 500));
    }
    setSelectedItems(new Set());
  };

  const handleBatchDeleteClick = () => {
    if (selectedItems.size === 0) return;
    setDeleteTarget({ type: 'batch', count: selectedItems.size, message: `Excluir ${selectedItems.size} item(s) selecionado(s)?` });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteTarget.type === 'pasta' && deleteTarget.id) {
        await bibliotecaService.excluirPasta(deleteTarget.id);
        toast.success('Pasta excluída.');
      }
      else if (deleteTarget.type === 'arquivo' && deleteTarget.arquivo) {
        await bibliotecaService.excluirArquivo(deleteTarget.arquivo);
        toast.success('Arquivo excluído.');
      }
      else if (deleteTarget.type === 'batch') {
        let deleted = 0;
        for (const id of selectedItems) {
          const isFolder = pastas.some(p => p.id === id);
          const isFile = arquivos.some(a => a.id === id);
          try {
            if (isFolder) await bibliotecaService.excluirPasta(id);
            if (isFile) {
              const f = arquivos.find(a => a.id === id)!;
              await bibliotecaService.excluirArquivo(f);
            }
            deleted++;
          } catch (err: any) {
            toast.error(`Erro ao excluir: ${err.message}`);
          }
        }
        if (deleted > 0) {
          toast.success(`${deleted} item(s) excluído(s).`);
          setSelectedItems(new Set());
        }
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="app-shell" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
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
            transform: 'scale(1.05)', transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--surface-1)', borderRadius: '50%', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
              <Upload size={48} color="var(--primary-color)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--text-color)', margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>Solte os arquivos aqui</h2>
              <p style={{ color: 'var(--muted-text)', margin: 0, fontSize: '0.95rem' }}>O upload iniciará automaticamente</p>
            </div>
          </div>
        </div>
      )}

      <main className="main-library-content container page-fade-in" style={{ maxWidth: '100%' }}>
        <h1 className="page-title" style={{ margin: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FolderOpen size={28} /> Biblioteca de Arquivos
        </h1>
        {/* Header & Actions */}
        <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--surface-1)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', color: 'var(--text-color)' }}>
              {currentFolderId && (
                <button
                  onClick={() => {
                    const parentId = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null;
                    setCurrentFolderId(parentId);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--muted-text)', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}
                  title="Voltar um nível"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <button
                onClick={() => setCurrentFolderId(null)}
                style={{ background: 'none', border: 'none', color: currentFolderId ? 'var(--primary-color)' : 'var(--text-color)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <Home size={18} style={{ marginRight: '0.2rem' }} /> Início
              </button>

              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  <ChevronRight size={14} color="var(--muted-text)" />
                  <button
                    onClick={() => setCurrentFolderId(crumb.id)}
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
              {folderStats.foldersCount} pastas, {folderStats.filesCount} arquivos • {formatFileSize(folderStats.totalSize)} utilizados nesta pasta
            </div>
          </div>

          <div className="header-actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn-secondary" onClick={() => {
              setRenamingFolder(null);
              setFolderName('');
              setFolderModalOpen(true);
            }}>
              <FolderPlus size={16} style={{ marginRight: '0.4rem' }} /> Nova Pasta
            </button>

            <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress.active}>
              {uploadProgress.active ? (
                <><Loader size={16} className="animate-spin" style={{ marginRight: '0.4rem' }} /> {uploadProgress.percent.toFixed(0)}%</>
              ) : (
                <><Upload size={16} style={{ marginRight: '0.4rem' }} /> Enviar Arquivo</>
              )}
            </button>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={e => handleFileUpload(e.target.files)}
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="library-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--surface-1)', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <button
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', fontWeight: 600, color: selectedItems.size > 0 ? 'var(--primary-color)' : 'var(--text-color)' }}
              onClick={selectedItems.size > 0 ? () => setSelectedItems(new Set()) : toggleSelectAll}
            >
              {selectedItems.size > 0 ? (
                <><CheckSquare size={18} style={{ marginRight: '0.4rem' }} /> {selectedItems.size} selecionado(s)</>
              ) : (
                <><Square size={18} style={{ marginRight: '0.4rem' }} /> Selecionar Tudo</>
              )}
            </button>

            {selectedItems.size > 0 ? (
              <div className="toolbar-batch-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={handleBatchDownload}>
                  <Download size={16} style={{ marginRight: '0.3rem' }} /> Baixar
                </button>
                <button className="btn-cancel text-danger" style={{ padding: '0.5rem 1rem' }} onClick={handleBatchDeleteClick}>
                  <Trash2 size={16} style={{ marginRight: '0.3rem' }} /> Excluir
                </button>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0, position: 'relative', minWidth: '320px', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar arquivos e pastas..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.8rem', width: '100%' }}
                />
              </div>
            )}
          </div>

          <div className="toolbar-filters" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value as any)} style={{ width: 'auto', minWidth: '180px' }}>
              <option value="all">Todos os tipos</option>
              <option value="folders">Somente Pastas</option>
              <option value="files">Somente Arquivos</option>
            </select>

            <select className="form-input" value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ width: 'auto', minWidth: '180px' }}>
              <option value="name">Nome (A-Z)</option>
              <option value="date">Modificado (Mais recentes)</option>
              <option value="size">Tamanho (Maior para menor)</option>
            </select>

            <div style={{ display: 'flex', backgroundColor: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', height: '100%' }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{ background: viewMode === 'grid' ? 'var(--primary-color)' : 'transparent', color: viewMode === 'grid' ? '#fff' : 'var(--text-color)', border: 'none', padding: '0 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '42px' }}
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{ background: viewMode === 'list' ? 'var(--primary-color)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-color)', border: 'none', padding: '0 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '42px' }}
              >
                <ListIcon size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ minHeight: '60vh', padding: viewMode === 'list' ? 0 : '1.5rem', marginTop: '1.5rem', backgroundColor: 'var(--surface-1)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {loading ? (
            <div style={{ padding: viewMode === 'list' ? '1.5rem' : 0 }}>
              <SkeletonLibrary viewMode={viewMode} />
            </div>
          ) : (
            <>
              {filteredPastas.length === 0 && filteredArquivos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '6rem 2rem', opacity: 0.8 }}>
                  <div style={{ width: '120px', height: '120px', margin: '0 auto 1.5rem', backgroundColor: 'var(--surface-1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FolderOpen size={64} color="var(--primary-color)" style={{ opacity: 0.5 }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Esta pasta está vazia</h3>
                  <p style={{ color: 'var(--muted-text)', maxWidth: '400px', margin: '0 auto 2rem' }}>
                    Nenhum documento ou pasta foi encontrado aqui. Comece criando uma nova pasta ou arrastando arquivos para cá.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button className="btn-secondary" onClick={() => { setRenamingFolder(null); setFolderName(''); setFolderModalOpen(true); }}>
                      <FolderPlus size={16} style={{ marginRight: '0.4rem' }} /> Criar Pasta
                    </button>
                    <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                      <Upload size={16} style={{ marginRight: '0.4rem' }} /> Enviar Arquivos
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {viewMode === 'grid' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>

                      {/* Folders (Grid) */}
                      {filteredPastas.map(pasta => (
                        <div
                          key={pasta.id}
                          className="library-card"
                          onDoubleClick={() => setCurrentFolderId(pasta.id)}
                          style={{
                            padding: '1.25rem',
                            border: `1px solid ${selectedItems.has(pasta.id) ? 'var(--primary-color)' : 'var(--border-color)'}`,
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            backgroundColor: selectedItems.has(pasta.id) ? 'rgba(37, 99, 235, 0.05)' : 'var(--surface-1)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <Folder size={32} color="var(--primary-color)" style={{ flexShrink: 0 }} />
                              <div>
                                <span style={{ fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={pasta.nome}>
                                  {pasta.nome}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>
                                  {new Date(pasta.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.2rem' }}>
                              <div
                                onClick={(e) => { e.stopPropagation(); toggleSelection(pasta.id, e); }}
                                style={{ cursor: 'pointer', color: selectedItems.has(pasta.id) ? 'var(--primary-color)' : 'var(--muted-text)', opacity: selectedItems.has(pasta.id) ? 1 : 0.4, transition: 'all 0.2s', alignSelf: 'center', marginRight: '0.3rem' }}
                              >
                                {selectedItems.has(pasta.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === pasta.id ? null : pasta.id); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', opacity: 0.6 }}
                              >
                                <MoreVertical size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Dropdown Menu (Folder) */}
                          {activeDropdown === pasta.id && (
                            <div style={{
                              position: 'absolute', top: '3rem', right: '10px',
                              backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-color)',
                              borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              zIndex: 10, minWidth: '160px', padding: '0.5rem 0'
                            }}>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setCurrentFolderId(pasta.id); }}>
                                <FolderOpen size={14} /> Abrir
                              </button>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setRenamingFolder(pasta); setFolderName(pasta.nome); setFolderModalOpen(true); }}>
                                <Edit2 size={14} /> Renomear
                              </button>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setItemToMove({ id: pasta.id, name: pasta.nome, type: 'pasta' }); setMoveModalOpen(true); }}>
                                <CornerUpRight size={14} /> Mover para...
                              </button>
                              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                              <button className="dropdown-item text-danger" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDeleteFolderClick(pasta.id); }}>
                                <Trash2 size={14} /> Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Files (Grid) */}
                      {filteredArquivos.map(arquivo => (
                        <div
                          key={arquivo.id}
                          className="library-card"
                          onDoubleClick={() => handleDownload(arquivo)}
                          style={{
                            padding: '1.25rem',
                            border: `1px solid ${selectedItems.has(arquivo.id) ? 'var(--primary-color)' : 'var(--border-color)'}`,
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            backgroundColor: selectedItems.has(arquivo.id) ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-color)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ padding: '0.75rem', backgroundColor: 'var(--surface-1)', borderRadius: '12px' }}>
                              {getFileIcon(arquivo.tipo_mime)}
                            </div>

                            <div style={{ display: 'flex', gap: '0.2rem' }}>
                              <div
                                onClick={(e) => { e.stopPropagation(); toggleSelection(arquivo.id, e); }}
                                style={{ cursor: 'pointer', color: selectedItems.has(arquivo.id) ? 'var(--primary-color)' : 'var(--muted-text)', opacity: selectedItems.has(arquivo.id) ? 1 : 0.4, transition: 'all 0.2s', alignSelf: 'center', marginRight: '0.3rem' }}
                              >
                                {selectedItems.has(arquivo.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === arquivo.id ? null : arquivo.id); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', opacity: 0.6 }}
                              >
                                <MoreVertical size={16} />
                              </button>
                            </div>
                          </div>

                          <div style={{ marginTop: '0.5rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={arquivo.nome_exibicao}>
                              {arquivo.nome_exibicao}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted-text)', marginTop: '0.4rem' }}>
                              <span>{formatFileSize(arquivo.tamanho_bytes)}</span>
                              <span>{new Date(arquivo.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {/* Dropdown Menu (File) */}
                          {activeDropdown === arquivo.id && (
                            <div style={{
                              position: 'absolute', top: '3rem', right: '10px',
                              backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-color)',
                              borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              zIndex: 10, minWidth: '160px', padding: '0.5rem 0'
                            }}>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDownload(arquivo); }}>
                                <Download size={14} /> Baixar Arquivo
                              </button>
                              <button className="dropdown-item" onClick={async (e) => {
                                e.stopPropagation(); setActiveDropdown(null);
                                try {
                                  const url = await bibliotecaService.gerarSignedUrl(arquivo.storage_path);
                                  await navigator.clipboard.writeText(url);
                                  toast.success('Link de acesso copiado! (Válido por 1h)');
                                } catch (err: any) { toast.error('Erro: ' + err.message); }
                              }}>
                                <Link size={14} /> Compartilhar Link
                              </button>
                              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setFileToRename(arquivo); setFileName(arquivo.nome_exibicao); setFileRenameModalOpen(true); }}>
                                <Edit2 size={14} /> Renomear
                              </button>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setItemToMove({ id: arquivo.id, name: arquivo.nome_exibicao, type: 'arquivo' }); setMoveModalOpen(true); }}>
                                <CornerUpRight size={14} /> Mover para...
                              </button>
                              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                              <button className="dropdown-item text-danger" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDeleteFileClick(arquivo); }}>
                                <Trash2 size={14} /> Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* List View */
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '1rem', width: '40px' }}>
                              <div
                                onClick={toggleSelectAll}
                                style={{ cursor: 'pointer', color: selectedItems.size > 0 ? 'var(--primary-color)' : 'var(--muted-text)', opacity: selectedItems.size > 0 ? 1 : 0.4, transition: 'all 0.2s' }}
                              >
                                {selectedItems.size > 0 && selectedItems.size === filteredPastas.length + filteredArquivos.length ? <CheckSquare size={20} /> : <Square size={20} />}
                              </div>
                            </th>
                            <th style={{ padding: '1rem', color: 'var(--muted-text)', fontWeight: 500 }}>Nome</th>
                            <th style={{ padding: '1rem', color: 'var(--muted-text)', fontWeight: 500 }}>Tamanho</th>
                            <th style={{ padding: '1rem', color: 'var(--muted-text)', fontWeight: 500 }}>Data de Modificação</th>
                            <th style={{ padding: '1rem', color: 'var(--muted-text)', fontWeight: 500, width: '60px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPastas.map(pasta => (
                            <tr key={pasta.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: selectedItems.has(pasta.id) ? 'rgba(37, 99, 235, 0.05)' : 'transparent', transition: 'background-color 0.2s' }}>
                              <td style={{ padding: '1rem' }}>
                                <div
                                  onClick={(e) => { e.stopPropagation(); toggleSelection(pasta.id, e); }}
                                  style={{ cursor: 'pointer', color: selectedItems.has(pasta.id) ? 'var(--primary-color)' : 'var(--muted-text)', opacity: selectedItems.has(pasta.id) ? 1 : 0.4, transition: 'all 0.2s' }}
                                >
                                  {selectedItems.has(pasta.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                </div>
                              </td>
                              <td style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onDoubleClick={() => setCurrentFolderId(pasta.id)}>
                                  <Folder size={20} color="var(--primary-color)" />
                                  <span style={{ fontWeight: 500 }}>{pasta.nome}</span>
                                </div>
                              </td>
                              <td style={{ padding: '1rem', color: 'var(--muted-text)' }}>--</td>
                              <td style={{ padding: '1rem', color: 'var(--muted-text)' }}>{new Date(pasta.created_at).toLocaleDateString()}</td>
                              <td style={{ padding: '1rem', position: 'relative' }}>
                                <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === pasta.id ? null : pasta.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>
                                  <MoreVertical size={16} />
                                </button>
                                {activeDropdown === pasta.id && (
                                  <div style={{
                                    position: 'absolute', top: '100%', right: '10px',
                                    backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-color)',
                                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    zIndex: 10, minWidth: '160px', padding: '0.5rem 0'
                                  }}>
                                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setCurrentFolderId(pasta.id); }}>
                                      <FolderOpen size={14} /> Abrir
                                    </button>
                                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setRenamingFolder(pasta); setFolderName(pasta.nome); setFolderModalOpen(true); }}>
                                      <Edit2 size={14} /> Renomear
                                    </button>
                                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setItemToMove({ id: pasta.id, name: pasta.nome, type: 'pasta' }); setMoveModalOpen(true); }}>
                                      <CornerUpRight size={14} /> Mover para...
                                    </button>
                                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                                    <button className="dropdown-item text-danger" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDeleteFolderClick(pasta.id); }}>
                                      <Trash2 size={14} /> Excluir
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}

                          {filteredArquivos.map(arquivo => (
                            <tr key={arquivo.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: selectedItems.has(arquivo.id) ? 'rgba(37, 99, 235, 0.05)' : 'transparent', transition: 'background-color 0.2s' }}>
                              <td style={{ padding: '1rem' }}>
                                <div
                                  onClick={(e) => { e.stopPropagation(); toggleSelection(arquivo.id, e); }}
                                  style={{ cursor: 'pointer', color: selectedItems.has(arquivo.id) ? 'var(--primary-color)' : 'var(--muted-text)', opacity: selectedItems.has(arquivo.id) ? 1 : 0.4, transition: 'all 0.2s' }}
                                >
                                  {selectedItems.has(arquivo.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                </div>
                              </td>
                              <td style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onDoubleClick={() => handleDownload(arquivo)}>
                                  {getFileIcon(arquivo.tipo_mime)}
                                  <span style={{ fontWeight: 500 }}>{arquivo.nome_exibicao}</span>
                                </div>
                              </td>
                              <td style={{ padding: '1rem', color: 'var(--muted-text)' }}>{formatFileSize(arquivo.tamanho_bytes)}</td>
                              <td style={{ padding: '1rem', color: 'var(--muted-text)' }}>{new Date(arquivo.created_at).toLocaleDateString()}</td>
                              <td style={{ padding: '1rem', position: 'relative' }}>
                                <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === arquivo.id ? null : arquivo.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>
                                  <MoreVertical size={16} />
                                </button>
                                {activeDropdown === arquivo.id && (
                                  <div style={{
                                    position: 'absolute', top: '100%', right: '10px',
                                    backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-color)',
                                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    zIndex: 10, minWidth: '160px', padding: '0.5rem 0'
                                  }}>
                                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDownload(arquivo); }}>
                                      <Download size={14} /> Baixar
                                    </button>
                                    <button className="dropdown-item" onClick={async (e) => {
                                      e.stopPropagation(); setActiveDropdown(null);
                                      try {
                                        const url = await bibliotecaService.gerarSignedUrl(arquivo.storage_path);
                                        await navigator.clipboard.writeText(url);
                                        toast.success('Link de acesso copiado! (Válido por 1h)');
                                      } catch (err: any) { toast.error('Erro: ' + err.message); }
                                    }}>
                                      <Link size={14} /> Compartilhar Link
                                    </button>
                                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setFileToRename(arquivo); setFileName(arquivo.nome_exibicao); setFileRenameModalOpen(true); }}>
                                      <Edit2 size={14} /> Renomear
                                    </button>
                                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setItemToMove({ id: arquivo.id, name: arquivo.nome_exibicao, type: 'arquivo' }); setMoveModalOpen(true); }}>
                                      <CornerUpRight size={14} /> Mover para...
                                    </button>
                                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                                    <button className="dropdown-item text-danger" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDeleteFileClick(arquivo); }}>
                                      <Trash2 size={14} /> Excluir
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal Nova/Renomear Pasta */}
      <Modal
        isOpen={folderModalOpen}
        onClose={() => { setFolderModalOpen(false); setFolderName(''); setRenamingFolder(null); }}
        title={renamingFolder ? "Renomear Pasta" : "Nova Pasta"}
        maxWidth="400px"
      >
        <form onSubmit={handleCreateOrRenameFolder}>
          <div className="form-group">
            <label className="form-label">Nome da Pasta</label>
            <input
              type="text"
              className="form-input"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-cancel" onClick={() => { setFolderModalOpen(false); setFolderName(''); setRenamingFolder(null); }}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      {/* Modal Renomear Arquivo */}
      <Modal
        isOpen={fileRenameModalOpen}
        onClose={() => { setFileRenameModalOpen(false); setFileName(''); setFileToRename(null); }}
        title="Renomear Arquivo"
        maxWidth="400px"
      >
        <form onSubmit={handleRenameFile}>
          <div className="form-group">
            <label className="form-label">Nome do Arquivo</label>
            <input
              type="text"
              className="form-input"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-cancel" onClick={() => { setFileRenameModalOpen(false); setFileName(''); setFileToRename(null); }}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      {/* Move Item Modal */}
      {itemToMove && (
        <MoveItemModal
          isOpen={moveModalOpen}
          onClose={() => {
            setMoveModalOpen(false);
            setItemToMove(null);
          }}
          itemName={itemToMove.name}
          itemType={itemToMove.type}
          currentFolderId={currentFolderId}
          itemIdToMove={itemToMove.id}
          onMove={async (targetFolderId) => {
            try {
              if (itemToMove.type === 'pasta') {
                await bibliotecaService.moverPasta(itemToMove.id, targetFolderId);
              } else {
                await bibliotecaService.moverArquivo(itemToMove.id, targetFolderId);
              }
              toast.success(`${itemToMove.type === 'pasta' ? 'Pasta movida' : 'Arquivo movido'} com sucesso.`);
              loadData();
              setSelectedItems(new Set());
            } catch (err: any) {
              toast.error('Erro ao mover: ' + err.message);
            }
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Confirmar Exclusão"
        message={deleteTarget?.message || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
        isDestructive={true}
      />

      <style>{`
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 1rem;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--text-color);
        }
        .dropdown-item:hover {
          background-color: var(--bg-color);
        }
        .dropdown-item.text-danger {
          color: var(--danger-color);
        }
        .library-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          transform: translateY(-2px);
        }

        @media (max-width: 768px) {
          .header-actions {
            width: 100%;
          }
          .header-actions button {
            flex: 1;
            justify-content: center;
          }
          .library-toolbar {
            flex-direction: column;
            align-items: stretch !important;
          }
          .toolbar-selection-actions {
            flex-direction: column;
            align-items: flex-start !important;
            width: 100%;
          }
          .toolbar-batch-buttons {
            flex-direction: column;
            width: 100%;
          }
          .toolbar-batch-buttons button {
            width: 100%;
            justify-content: center;
          }
          .toolbar-default-actions {
            flex-direction: column;
            align-items: stretch !important;
            width: 100%;
          }
          .toolbar-default-actions > button,
          .toolbar-default-actions .form-group {
            width: 100%;
          }
          .toolbar-default-actions .form-group input {
            width: 100% !important;
          }
          .toolbar-filters {
            margin-left: 0 !important;
            width: 100%;
            flex-wrap: wrap;
          }
          .toolbar-filters select {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
