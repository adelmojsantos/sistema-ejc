import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserPlus, Search, X, Users } from 'lucide-react';
import { PessoaCard } from '../../components/pessoa/PessoaCard';
import { PessoaForm } from '../../components/pessoa/PessoaForm';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { pessoaService } from '../../services/pessoaService';
import { normalizeString } from '../../utils/stringUtils';
import type { Pessoa, PessoaFormData } from '../../types/pessoa';

type Mode = 'list' | 'create' | 'edit';

export function PessoasPage() {
    const navigate = useNavigate();
    const [pessoas, setPessoas] = useState<Pessoa[]>([]);
    const [filtered, setFiltered] = useState<Pessoa[]>([]);
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState<Mode>('list');
    const [selected, setSelected] = useState<Pessoa | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Pessoa | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const load = useCallback(async () => {
        setIsFetching(true);
        setFetchError(null);
        try {
            const data = await pessoaService.listar();
            setPessoas(data);
            setFiltered(data);
        } catch {
            setFetchError('Erro ao carregar cadastros. Tente novamente.');
            toast.error('Erro ao carregar pessoas.');
        } finally {
            setIsFetching(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const q = normalizeString(search);
        setFiltered(
            !q ? pessoas : pessoas.filter(
                (p) =>
                    normalizeString(p.nome_completo).includes(q) ||
                    normalizeString(p.email || '').includes(q) ||
                    normalizeString(p.comunidade || '').includes(q) ||
                    (p.cpf && p.cpf.includes(q))
            )
        );
    }, [search, pessoas]);

    const openCreate = () => { setSelected(null); setFormError(null); setMode('create'); };
    const openEdit = (p: Pessoa) => { setSelected(p); setFormError(null); setMode('edit'); };
    const backToList = () => { setMode('list'); setSelected(null); };

    const handleBack = () => {
        if (mode !== 'list') {
            backToList();
        } else {
            navigate('/cadastros');
        }
    };

    const handleSubmit = async (data: PessoaFormData) => {
        setIsLoading(true);
        setFormError(null);
        try {
            if (mode === 'create') {
                const nova = await pessoaService.criar(data);
                setPessoas((prev) => [...prev, nova].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)));
                toast.success('Pessoa cadastrada com sucesso!');
            } else if (mode === 'edit' && selected) {
                const atualizada = await pessoaService.atualizar(selected.id, data);
                setPessoas((prev) => prev.map((p) => (p.id === atualizada.id ? atualizada : p)));
                toast.success('Cadastro atualizado com sucesso!');
            }
            backToList();
        } catch {
            setFormError('Erro ao salvar. Verifique os dados e tente novamente.');
            toast.error('Erro ao salvar cadastro.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await pessoaService.excluir(deleteTarget.id);
            setPessoas((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDeleteTarget(null);
            toast.success('Cadastro excluído com sucesso!');
        } catch (err: unknown) {
            const errorObj = err as { code?: string };
            if (errorObj.code === '23503') {
                toast.error('Não é possível excluir pois existem registros vinculados.');
            } else {
                toast.error('Erro ao excluir cadastro.');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="container" style={{ paddingBottom: '2rem' }}>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={handleBack}
                        className="icon-btn"
                        aria-label="Voltar"
                        title="Voltar"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>
                            Cadastros
                        </p>
                        <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
                            <Users size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                            Pessoas
                        </h1>
                    </div>
                </div>

                {mode === 'list' && (
                    <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <UserPlus size={18} /> Nova Pessoa
                    </button>
                )}
            </div>

            {/* Form mode */}
            {(mode === 'create' || mode === 'edit') && (
                <div className="card" style={{ marginTop: '1rem' }}>
                    <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.2rem' }}>
                        {mode === 'create' ? 'Nova Pessoa' : `Editando: ${selected?.nome_completo}`}
                    </h2>
                    {formError && (
                        <div className="error-message" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                            {formError}
                        </div>
                    )}
                    <PessoaForm
                        initialData={selected ?? undefined}
                        onSubmit={handleSubmit}
                        onCancel={backToList}
                        isLoading={isLoading}
                    />
                </div>
            )}

            {/* List mode */}
            {mode === 'list' && (
                <>
                    <div className="search-bar">
                        <Search size={18} style={{ color: 'var(--text-color)', opacity: 0.5, flexShrink: 0 }} />
                        <input
                            className="search-input"
                            type="search"
                            placeholder="Buscar por nome, e-mail, CPF ou comunidade…"
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

                    {isFetching && (
                        <div className="empty-state">
                            <div className="animate-spin" style={{ width: 40, height: 40, border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%' }} />
                            <p>Carregando…</p>
                        </div>
                    )}

                    {fetchError && !isFetching && (
                        <div className="empty-state">
                            <p style={{ color: '#ef4444' }}>{fetchError}</p>
                            <button onClick={load}>Tentar novamente</button>
                        </div>
                    )}

                    {!isFetching && !fetchError && filtered.length === 0 && (
                        <div className="empty-state">
                            <Users size={48} style={{ opacity: 0.3 }} />
                            <p>{search ? 'Nenhum resultado encontrado.' : 'Nenhuma pessoa cadastrada ainda.'}</p>
                            {!search && (
                                <button onClick={openCreate}>
                                    <UserPlus size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                    Cadastrar primeira pessoa
                                </button>
                            )}
                        </div>
                    )}

                    {!isFetching && !fetchError && filtered.length > 0 && (
                        <>
                            <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: '0 0 0.75rem' }}>
                                {filtered.length} {filtered.length === 1 ? 'pessoa encontrada' : 'pessoas encontradas'}
                            </p>
                            <div className="pessoa-grid">
                                {filtered.map((p) => (
                                    <PessoaCard
                                        key={p.id}
                                        pessoa={p}
                                        onEdit={openEdit}
                                        onDelete={setDeleteTarget}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Excluir Cadastro"
                message={`Tem certeza que deseja excluir o cadastro de "${deleteTarget?.nome_completo}"? Esta ação não pode ser desfeita.`}
                confirmText="Excluir"
                cancelText="Cancelar"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
                isLoading={isDeleting}
                isDestructive={true}
            />
        </div>
    );
}
