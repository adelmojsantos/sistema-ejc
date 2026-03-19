import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Calendar as CalIcon, Plus } from 'lucide-react';
import { EncontroRow } from '../../components/encontro/EncontroRow';
import { EncontroForm } from '../../components/encontro/EncontroForm';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { encontroService } from '../../services/encontroService';
import { normalizeString } from '../../utils/stringUtils';
import type { Encontro, EncontroFormData } from '../../types/encontro';

type Mode = 'list' | 'create' | 'edit';

export function EncontrosPage() {
    const navigate = useNavigate();
    const [encontros, setEncontros] = useState<Encontro[]>([]);
    const [filtered, setFiltered] = useState<Encontro[]>([]);
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState<Mode>('list');
    const [selected, setSelected] = useState<Encontro | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Encontro | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const load = useCallback(async () => {
        setIsFetching(true);
        try {
            const data = await encontroService.listar();
            setEncontros(data);
            setFiltered(data);
        } catch (err: unknown) {
            const errorObj = err as { message?: string };
            const msg = errorObj.message || 'Erro ao carregar encontros.';
            setFetchError(msg);
            toast.error(msg);
        } finally {
            setIsFetching(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const q = normalizeString(search);
        setFiltered(
            !q ? encontros : encontros.filter(
                (p) =>
                    normalizeString(p.nome).includes(q) ||
                    normalizeString(p.tema || '').includes(q) ||
                    normalizeString(p.local || '').includes(q)
            )
        );
    }, [search, encontros]);

    const openCreate = () => { setSelected(null); setFormError(null); setMode('create'); };
    const openEdit = (p: Encontro) => { setSelected(p); setFormError(null); setMode('edit'); };
    const backToList = () => { setMode('list'); setSelected(null); };

    const handleBack = () => {
        if (mode !== 'list') {
            backToList();
        } else {
            navigate('/cadastros');
        }
    };

    const handleSubmit = async (data: EncontroFormData) => {
        setIsLoading(true);
        setFormError(null);
        try {
            if (mode === 'create') {
                const nova = await encontroService.criar(data);
                setEncontros((prev) => [nova, ...prev]);
                toast.success('Encontro criado com sucesso!');
            } else if (mode === 'edit' && selected) {
                const atualizada = await encontroService.atualizar(selected.id, data);
                setEncontros((prev) => prev.map((p) => (p.id === atualizada.id ? atualizada : p)));
                toast.success('Encontro atualizado com sucesso!');
            }
            backToList();
        } catch {
            setFormError('Erro ao salvar encontro.');
            toast.error('Erro ao salvar encontro.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await encontroService.excluir(deleteTarget.id);
            setEncontros((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDeleteTarget(null);
            toast.success('Encontro excluído com sucesso!');
        } catch (err: unknown) {
            const errorObj = err as { code?: string };
            if (errorObj.code === '23503') {
                toast.error('Não é possível excluir pois existem registros vinculados.');
            } else {
                toast.error('Erro ao excluir encontro.');
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
                            <CalIcon size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                            Encontros
                        </h1>
                    </div>
                </div>
                {mode === 'list' && (
                    <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} /> Novo Encontro
                    </button>
                )}
            </div>

            {(mode === 'create' || mode === 'edit') && (
                <div className="card" style={{ marginTop: '1rem' }}>
                    <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.2rem' }}>
                        {mode === 'create' ? 'Novo Encontro' : `Editando: ${selected?.nome}`}
                    </h2>
                    {formError && <div className="error-message" style={{ marginBottom: '1rem' }}>{formError}</div>}
                    <EncontroForm
                        initialData={selected ?? undefined}
                        onSubmit={handleSubmit}
                        onCancel={backToList}
                        isLoading={isLoading}
                    />
                </div>
            )}

            {mode === 'list' && (
                <>
                    <div className="search-bar">
                        <Search size={18} style={{ opacity: 0.5 }} />
                        <input
                            className="search-input"
                            type="search"
                            placeholder="Buscar por nome, tema ou local..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {isFetching && (
                        <div className="empty-state">Carregando...</div>
                    )}

                    {fetchError && !isFetching && (
                        <div className="empty-state">
                            <p style={{ color: '#ef4444' }}>{fetchError}</p>
                            <button onClick={load}>Tentar novamente</button>
                        </div>
                    )}

                    {!isFetching && !fetchError && filtered.length === 0 ? (
                        <div className="empty-state">
                            <CalIcon size={48} style={{ opacity: 0.3 }} />
                            <p>Nenhum encontro encontrado.</p>
                        </div>
                    ) : !isFetching && !fetchError && filtered.length > 0 && (
                        <div className="pessoa-grid">
                            {filtered.map((e) => (
                                <EncontroRow
                                    key={e.id}
                                    encontro={e}
                                    onEdit={openEdit}
                                    onDelete={setDeleteTarget}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Excluir Encontro"
                message={`Deseja excluir "${deleteTarget?.nome}"?`}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
                isLoading={isDeleting}
                isDestructive={true}
            />
        </div>
    );
}
