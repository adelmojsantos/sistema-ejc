import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { bibliotecaService, type BibliotecaArquivo, type BibliotecaPasta } from '../services/bibliotecaService';

export type ViewMode = 'grid' | 'list';
export type FilterType = 'all' | 'folders' | 'files';
export type SortBy = 'name' | 'date' | 'size';

interface UseBibliotecaProps {
  initialFolderId?: string | null;
  mode?: 'admin' | 'shared';
  profile?: any; // Necessário para o modo compartilhado
  userParticipacao?: any;
}

export function useBiblioteca({ initialFolderId = null, mode = 'admin', profile, userParticipacao }: UseBibliotecaProps = {}) {
  // Estados de Dados
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId);
  const [allSharedPastas, setAllSharedPastas] = useState<BibliotecaPasta[]>([]);
  const [allSharedArquivos, setAllSharedArquivos] = useState<BibliotecaArquivo[]>([]);
  const [pastas, setPastas] = useState<BibliotecaPasta[]>([]);
  const [arquivos, setArquivos] = useState<BibliotecaArquivo[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BibliotecaPasta[]>([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Estados de Processo
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean, percent: number, currentFile: string }>({ 
    active: false, percent: 0, currentFile: '' 
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Carregamento de Dados
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'admin') {
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
      } else {
        // MODO COMPARTILHADO
        // Carregamos TUDO que o usuário tem acesso (a árvore permitida)
        const targetGrupoIds = profile?.grupoIds || [];
        const targetEquipeId = userParticipacao?.equipe_id;
        const isAdmin = profile?.permissions.includes('modulo_admin');

        const data = await bibliotecaService.listarItensCompartilhados({ 
          grupoIds: targetGrupoIds, 
          equipeId: targetEquipeId,
          isAdmin
        });

        setAllSharedPastas(data.pastas);
        setAllSharedArquivos(data.arquivos);

        // A filtragem do que exibir (pasta atual) é feita pelo useEffect baseado no currentFolderId
      }
    } catch (error: any) {
      toast.error('Erro ao carregar biblioteca: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, mode, profile, userParticipacao]);

  // Efeito para filtrar itens exibidos no modo compartilhado
  useEffect(() => {
    if (mode === 'shared') {
      if (currentFolderId) {
        setPastas(allSharedPastas.filter(p => p.parent_id === currentFolderId));
        setArquivos(allSharedArquivos.filter(a => a.pasta_id === currentFolderId));
        
        // Reconstrói breadcrumbs localmente
        const path: BibliotecaPasta[] = [];
        let curr = allSharedPastas.find(p => p.id === currentFolderId);
        while (curr) {
          path.unshift(curr);
          const nextId = curr.parent_id;
          curr = nextId ? allSharedPastas.find(p => p.id === nextId) : undefined;
        }
        setBreadcrumbs(path);
      } else {
        // Raiz do compartilhamento
        const allPastaIds = new Set(allSharedPastas.map(p => p.id));
        setPastas(allSharedPastas.filter(p => !p.parent_id || !allPastaIds.has(p.parent_id)));
        setArquivos(allSharedArquivos.filter(a => !a.pasta_id || !allPastaIds.has(a.pasta_id)));
        setBreadcrumbs([]);
      }
    }
  }, [currentFolderId, allSharedPastas, allSharedArquivos, mode]);

  useEffect(() => {
    loadData();
    setSelectedItems(new Set());
  }, [loadData]);

  // Filtros e Ordenação (Memoizados)
  const filteredData = useMemo(() => {
    let p = pastas.filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase()));
    let a = arquivos.filter(item => item.nome_exibicao.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterType === 'files') p = [];
    if (filterType === 'folders') a = [];

    const sortFn = (x: any, y: any, field: string) => {
      if (sortBy === 'name') return x[field].localeCompare(y[field]);
      if (sortBy === 'date') return new Date(y.created_at).getTime() - new Date(x.created_at).getTime();
      if (sortBy === 'size' && field === 'nome_exibicao') return (y.tamanho_bytes || 0) - (x.tamanho_bytes || 0);
      return 0;
    };

    return {
      pastas: p.sort((x, y) => sortFn(x, y, 'nome')),
      arquivos: a.sort((x, y) => sortFn(x, y, 'nome_exibicao'))
    };
  }, [pastas, arquivos, searchQuery, filterType, sortBy]);

  // Ações de Arquivo
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB

    const validFiles = Array.from(files).filter(f => {
      if (f.size > MAX_SIZE) {
        toast.error(`Arquivo "${f.name}" excede 50MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    toast.loading(`Iniciando upload de ${validFiles.length} arquivo(s)...`, { id: 'upload-progress', duration: 3000 });
    setUploadProgress(prev => ({ ...prev, active: true, percent: 0 }));

    // Implementação de Paralelismo Controlado (Pool de 2 uploads simultâneos)
    const uploadFile = async (file: File) => {
      try {
        setUploadProgress(prev => ({ ...prev, currentFile: file.name }));
        await bibliotecaService.uploadArquivo(file, currentFolderId);
      } catch (err: any) {
        toast.error(`Erro ao subir ${file.name}: ${err.message}`);
      }
    };

    // Executa em blocos para não saturar
    for (let i = 0; i < validFiles.length; i += 2) {
      const chunk = validFiles.slice(i, i + 2);
      await Promise.all(chunk.map(uploadFile));
      const progress = ((i + chunk.length) / validFiles.length) * 100;
      setUploadProgress(prev => ({ ...prev, percent: progress }));
    }

    setUploadProgress({ active: false, percent: 0, currentFile: '' });
    toast.success('Upload concluído!');
    loadData();
  };

  const handleBatchDelete = async () => {
    if (selectedItems.size === 0) return;
    setIsDeleting(true);
    let deletedCount = 0;

    try {
      for (const id of selectedItems) {
        const isFolder = pastas.some(p => p.id === id);
        const file = arquivos.find(a => a.id === id);

        try {
          if (isFolder) await bibliotecaService.excluirPasta(id);
          if (file) await bibliotecaService.excluirArquivo(file);
          deletedCount++;
        } catch (err: any) {
          toast.error(`Erro ao excluir item: ${err.message}`);
        }
      }
      if (deletedCount > 0) {
        toast.success(`${deletedCount} item(s) removido(s).`);
        setSelectedItems(new Set());
        loadData();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  return {
    // Dados
    pastas: filteredData.pastas,
    arquivos: filteredData.arquivos,
    breadcrumbs,
    
    // UI State
    currentFolderId,
    loading,
    searchQuery,
    viewMode,
    filterType,
    sortBy,
    selectedItems,
    uploadProgress,
    isDeleting,
    
    // Actions
    actions: {
      setCurrentFolderId,
      setSearchQuery,
      setViewMode,
      setFilterType,
      setSortBy,
      setSelectedItems,
      handleFileUpload,
      handleBatchDelete,
      toggleSelection,
      refresh: loadData
    }
  };
}
