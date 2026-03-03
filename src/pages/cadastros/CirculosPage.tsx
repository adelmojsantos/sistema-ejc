import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, UsersRound, Plus, X, Check, Loader } from 'lucide-react';
import { CirculoRow } from '../../components/circulo/CirculoRow';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { circuloService } from '../../services/circuloService';
import { normalizeString } from '../../utils/stringUtils';
import type { Circulo, CirculoFormData } from '../../types/circulo';

export function CirculosPage() {
    const navigate = useNavigate();
    const [circulos, setCirculos] = useState<Circulo[]>([]);
    const [filtered, setFiltered] = useState<Circulo[]>([]);
    const [search, setSearch] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newNome, setNewNome] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Circulo | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const load = useCallback(async () => {
        setIsFetching(true);
        setFetchError(null);
        try {
            const data = await circuloService.listar();
            setCirculos(data);
            setFiltered(data);
        } catch (err: any) {
            setFetchError(err.message || 'Erro ao carregar círculos. Tente novamente.');
        } finally {
            setIsFetching(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const q = normalizeString(search);
        setFiltered(!q ? circulos : circulos.filter((p) => normalizeString(p.nome || '').includes(q)));
    }, [search, circulos]);

    const handleBack = () => {
        navigate('/cadastros');
    };

    const handleCreate = async () => {
        if (!newNome.trim()) return;
        setIsLoading(true);
        try {
            const nova = await circuloService.criar({ nome: newNome });
            setCirculos((prev) => [...prev, nova].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')));
            setNewNome('');
            setIsAdding(false);
            toast.success('Círculo criado com sucesso!');
        } catch {
            toast.error('Erro ao criar círculo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdate = async (id: number, data: CirculoFormData) => {
        try {
            const atualizada = await circuloService.atualizar(id, data);
            setCirculos((prev) => prev.map((p) => (p.id === atualizada.id ? atualizada : p)));
            toast.success('Círculo atualizado com sucesso!');
        } catch {
            toast.error('Erro ao atualizar círculo.');
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await circuloService.excluir(deleteTarget.id);
            setCirculos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDeleteTarget(null);
            toast.success('Círculo excluído com sucesso!');
        } catch (err: any) {
            if (err.code === '23503') {
                toast.error('Não é possível excluir pois existem registros vinculados.');
            } else {
                toast.error('Erro ao excluir círculo.');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="container" style={{ paddingBottom: '2rem' }}>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={handleBack} className="icon-btn" title="Voltar"><ChevronLeft size={18} /></button>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Cadastros</p>
                        <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
                            <UsersRound size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                            Círculos
                        </h1>
                    </div>
                </div>
                {!isAdding && (
                    <button onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} /> Novo Círculo
                    </button>
                )}
            </div>

            <div className="search-bar">
                <Search size={18} style={{ opacity: 0.5 }} />
                <input
                    className="search-input"
                    type="search"
                    placeholder="Buscar círculo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', color: 'var(--text-color)', opacity: 0.5 }}
                        aria-label="Limpar busca"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="pessoa-avatar small" style={{ backgroundColor: '#f59e0b15', color: '#f59e0b' }}>
                            <UsersRound size={18} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <input
                                autoFocus
                                className="search-input"
                                placeholder="Nome do novo círculo..."
                                style={{ margin: 0, padding: '0.6rem 0.8rem', borderRadius: '8px', width: '100%', border: '1px solid var(--border-color)' }}
                                value={newNome}
                                onChange={(e) => setNewNome(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreate();
                                    if (e.key === 'Escape') setIsAdding(false);
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                                className="icon-btn"
                                onClick={handleCreate}
                                disabled={isLoading || !newNome.trim()}
                                style={{ color: '#10b981' }}
                                title="Confirmar"
                            >
                                {isLoading ? <Loader size={16} className="animate-spin" /> : <Check size={20} />}
                            </button>
                            <button
                                className="icon-btn"
                                onClick={() => { setIsAdding(false); setNewNome(''); }}
                                disabled={isLoading}
                                style={{ color: '#ef4444' }}
                                title="Cancelar"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isFetching && (
                <div className="empty-state">Carregando...</div>
            )}

            {fetchError && !isFetching && (
                <div className="empty-state">
                    <p style={{ color: '#ef4444' }}>{fetchError}</p>
                    <button onClick={load}>Tentar novamente</button>
                </div>
            )}

            {!isFetching && !fetchError && filtered.length === 0 && !isAdding ? (
                <div className="empty-state">
                    <UsersRound size={48} style={{ opacity: 0.3 }} />
                    <p>Nenhum círculo cadastrado.</p>
                    <button onClick={() => setIsAdding(true)}>
                        <Plus size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                        Adicionar primeiro círculo
                    </button>
                </div>
            ) : !isFetching && !fetchError && filtered.length > 0 && (
                <div className="pessoa-grid">
                    {filtered.map((e) => (
                        <CirculoRow
                            key={e.id}
                            circulo={e}
                            onUpdate={handleUpdate}
                            onDelete={setDeleteTarget}
                        />
                    ))}
                </div>
            )}

            <ConfirmDialog isOpen={!!deleteTarget} title="Excluir Círculo" message={`Deseja excluir "${deleteTarget?.nome}"?`} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} isLoading={isDeleting} isDestructive={true} />
        </div>
    );
}
