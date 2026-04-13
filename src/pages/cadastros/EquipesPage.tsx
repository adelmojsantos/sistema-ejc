import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Plus, X, Loader, Check } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { EquipeRow } from '../../components/equipe/EquipeRow';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { equipeService } from '../../services/equipeService';
import { normalizeString } from '../../utils/stringUtils';
import type { Equipe, EquipeFormData } from '../../types/equipe';

export function EquipesPage() {
    const navigate = useNavigate();
    const [equipes, setEquipes] = useState<Equipe[]>([]);
    const [filtered, setFiltered] = useState<Equipe[]>([]);
    const [search, setSearch] = useState('');
    const [novoNome, setNovoNome] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Equipe | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const load = useCallback(async () => {
        setIsFetching(true);
        try {
            const data = await equipeService.listar();
            setEquipes(data);
            setFiltered(data);
        } catch {
            // Error handling
        } finally {
            setIsFetching(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const q = normalizeString(search);
        setFiltered(!q ? equipes : equipes.filter((p) => normalizeString(p.nome || '').includes(q)));
    }, [search, equipes]);

    const handleBack = () => {
        navigate('/cadastros');
    };

    const handleCreate = async () => {
        if (!novoNome.trim()) return;
        setIsLoading(true);
        setError(null);
        try {
            const nova = await equipeService.criar({ nome: novoNome.trim() });
            setEquipes((prev) => [...prev, nova].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')));
            setNovoNome('');
            setIsAdding(false);
            toast.success('Equipe criada com sucesso!');
        } catch {
            setError('Erro ao criar equipe.');
            toast.error('Erro ao criar equipe.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdate = async (id: string, data: EquipeFormData) => {
        setError(null);
        try {
            const atualizada = await equipeService.atualizar(id, data);
            setEquipes((prev) => prev.map((p) => (p.id === atualizada.id ? atualizada : p)));
            toast.success('Equipe atualizada com sucesso!');
        } catch {
            setError('Erro ao atualizar equipe.');
            toast.error('Erro ao atualizar equipe.');
            throw new Error('Atualização falhou');
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await equipeService.excluir(deleteTarget.id);
            setEquipes((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDeleteTarget(null);
            toast.success('Equipe excluída com sucesso!');
        } catch (err: unknown) {
            const errorObj = err as { code?: string };
            if (errorObj.code === '23503') {
                toast.error('Não é possível excluir pois existem registros vinculados.');
            } else {
                toast.error('Erro ao excluir equipe.');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="container" style={{ paddingBottom: '2rem' }}>
            <PageHeader 
                title="Equipes"
                subtitle="Gestão de Cadastros"
                onBack={handleBack}
                actions={
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        disabled={isAdding}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Plus size={18} />
                        Nova Equipe
                    </button>
                }
            />

            <div className="search-bar" style={{ marginBottom: '1.5rem' }}>
                <Search size={18} style={{ opacity: 0.5 }} />
                <input
                    className="search-input"
                    placeholder="Buscar equipe..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {isAdding && (
                <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', border: '1px dashed var(--primary-color)', background: 'rgba(99, 102, 241, 0.05)' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div className="pessoa-avatar small" style={{ background: 'var(--primary-color)', color: 'white' }}>
                            <Plus size={18} />
                        </div>
                        <input
                            autoFocus
                            className="search-input"
                            style={{
                                flex: 1,
                                background: 'var(--card-bg)',
                                border: '2px solid var(--primary-color)',
                                boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)',
                                outline: 'none',
                                borderRadius: '8px',
                                padding: '0.6rem 0.8rem'
                            }}
                            placeholder="Nome da nova equipe..."
                            value={novoNome}
                            onChange={(e) => setNovoNome(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            disabled={isLoading}
                        />
                        <button
                            className="icon-btn"
                            onClick={handleCreate}
                            disabled={isLoading || !novoNome.trim()}
                            style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            {isLoading ? <Loader size={16} className="animate-spin" /> : <Check size={16} color="#10b981" />}
                        </button>
                        <button
                            className="icon-btn"
                            onClick={() => { setNovoNome(''); setIsAdding(false); }}
                            disabled={isLoading}
                            title="Cancelar"
                            style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <X size={18} color="#ef4444" />
                        </button>
                    </div>
                    {error && <p className="error-message" style={{ marginTop: '0.5rem', marginBottom: 0 }}>{error}</p>}
                </div>
            )}

            {isFetching ? (
                <div className="empty-state">Carregando equipes...</div>
            ) : (
                <div className="pessoa-grid">
                    {filtered.length > 0 ? (
                        filtered.map((e) => (
                            <EquipeRow
                                key={e.id}
                                equipe={e}
                                onUpdate={handleUpdate}
                                onDelete={setDeleteTarget}
                            />
                        ))
                    ) : (
                        <div className="empty-state">Nenhuma equipe encontrada.</div>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Excluir Equipe"
                message={`Deseja excluir "${deleteTarget?.nome}"?`}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
                isLoading={isDeleting}
                isDestructive={true}
            />
        </div>
    );
}
