import {
    FolderOpen
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBiblioteca } from '../../hooks/useBiblioteca';
import { LibraryBreadcrumbs } from '../../components/admin/biblioteca/LibraryBreadcrumbs';
import { LibraryToolbar } from '../../components/admin/biblioteca/LibraryToolbar';
import { LibraryItem } from '../../components/admin/biblioteca/LibraryItem';
import { SkeletonLibrary } from '../admin/components/SkeletonLibrary';
import { bibliotecaService, type BibliotecaArquivo } from '../../services/bibliotecaService';
import { PageHeader } from '../../components/ui/PageHeader';
import { toast } from 'react-hot-toast';
import { useEffect, useState } from 'react';

export default function SharedLibraryPage() {
    const { profile, userParticipacao } = useAuth();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const moduleName = searchParams.get('module') || 'Início';

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
        actions
    } = useBiblioteca({
        mode: 'shared',
        profile,
        userParticipacao
    });

    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    useEffect(() => {
        const handleClickOutside = () => setActiveDropdown(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleDownload = async (arquivo: BibliotecaArquivo) => {
        try {
            const url = await bibliotecaService.gerarSignedUrl(arquivo.storage_path);
            window.open(url, '_blank');
        } catch (err: any) {
            toast.error('Erro ao abrir arquivo: ' + err.message);
        }
    };

    const folderStats = {
        foldersCount: pastas.length,
        filesCount: arquivos.length,
        totalSizeFormatted: arquivos.reduce((acc, curr) => acc + curr.tamanho_bytes, 0).toLocaleString('pt-BR') + ' bytes'
    };

    return (
        <div style={{ padding: '0 1rem' }}>
            <PageHeader
                title="Biblioteca de Arquivos"
                subtitle={`INÍCIO / ${moduleName.toUpperCase()}`}
            // backPath automático para -1 se não definido
            />

            <div style={{ marginTop: '2rem' }}>
                {/* ÁREA DE CONTEÚDO DA BIBLIOTECA */}
                <div style={{
                    backgroundColor: 'var(--surface-1)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    padding: '1.5rem',
                    boxShadow: 'var(--shadow-sm)',
                    marginBottom: '3rem'
                }}>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <LibraryBreadcrumbs
                            breadcrumbs={breadcrumbs}
                            currentFolderId={currentFolderId}
                            onNavigate={actions.setCurrentFolderId}
                            stats={folderStats}
                        />
                    </div>

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
                        onBatchDelete={() => { }}
                        isReadOnly={true}
                    />

                    <div style={{
                        minHeight: '50vh',
                        marginTop: '1.5rem',
                        backgroundColor: 'var(--bg-color)',
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
                                    <div style={{ textAlign: 'center', padding: '5rem 2rem', opacity: 0.5 }}>
                                        <FolderOpen size={48} style={{ margin: '0 auto 1rem' }} />
                                        <h3>Nenhum documento encontrado</h3>
                                        <p>Esta pasta está vazia ou não há arquivos compartilhados.</p>
                                    </div>
                                ) : viewMode === 'grid' ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
                                        {pastas.map(p => (
                                            <LibraryItem
                                                key={p.id} item={p} type="pasta" viewMode="grid"
                                                isSelected={selectedItems.has(p.id)} isActiveDropdown={activeDropdown === p.id}
                                                onToggleSelection={actions.toggleSelection} onToggleDropdown={setActiveDropdown}
                                                onNavigate={actions.setCurrentFolderId} onDownload={() => { }}
                                                onRename={() => { }} onMove={() => { }} onShare={() => { }} onDelete={() => { }}
                                                isReadOnly={true}
                                            />
                                        ))}
                                        {arquivos.map(a => (
                                            <LibraryItem
                                                key={a.id} item={a} type="arquivo" viewMode="grid"
                                                isSelected={selectedItems.has(a.id)} isActiveDropdown={activeDropdown === a.id}
                                                onToggleSelection={actions.toggleSelection} onToggleDropdown={setActiveDropdown}
                                                onNavigate={() => { }} onDownload={handleDownload}
                                                onPreview={handleDownload}
                                                onRename={() => { }} onMove={() => { }} onShare={() => { }} onDelete={() => { }}
                                                isReadOnly={true}
                                            />
                                        ))}
                                    </div>
                                ) : (
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
                                                    onNavigate={actions.setCurrentFolderId} onDownload={() => { }}
                                                    onRename={() => { }} onMove={() => { }} onShare={() => { }} onDelete={() => { }}
                                                    isReadOnly={true}
                                                />
                                            ))}
                                            {arquivos.map(a => (
                                                <LibraryItem
                                                    key={a.id} item={a} type="arquivo" viewMode="list"
                                                    isSelected={selectedItems.has(a.id)} isActiveDropdown={activeDropdown === a.id}
                                                    onToggleSelection={actions.toggleSelection} onToggleDropdown={setActiveDropdown}
                                                    onNavigate={() => { }} onDownload={handleDownload}
                                                    onPreview={handleDownload}
                                                    onRename={() => { }} onMove={() => { }} onShare={() => { }} onDelete={() => { }}
                                                    isReadOnly={true}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
