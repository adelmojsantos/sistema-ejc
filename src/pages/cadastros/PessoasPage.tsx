import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search, X, Users, User } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { PessoaCard } from '../../components/pessoa/PessoaCard';
import { PessoaForm } from '../../components/pessoa/PessoaForm';
import { HistoricoModal } from '../../components/pessoa/HistoricoModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { pessoaService } from '../../services/pessoaService';
import { useDebounce } from '../../hooks/useDebounce.ts';
import { useEncontros } from '../../contexts/EncontroContext';
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
    const [historyTarget, setHistoryTarget] = useState<Pessoa | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const scrollPositionRef = useRef(0);

    // Pagination States
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const debouncedSearch = useDebounce(search, 500);

    // Filter States
    const { encontros } = useEncontros();
    const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');

    const load = useCallback(async (currentSearch: string, currentPage: number, currentEncontroId: string) => {
        setIsFetching(true);
        setFetchError(null);
        try {
            const result = await pessoaService.buscarComPaginacao(currentSearch, currentPage, pageSize, currentEncontroId);
            setPessoas(result.data);
            setFiltered(result.data);
            setTotalCount(result.count);
        } catch {
            setFetchError('Erro ao carregar cadastros. Tente novamente.');
            toast.error('Erro ao carregar pessoas.');
        } finally {
            setIsFetching(false);
        }
    }, [pageSize]);

    useEffect(() => {
        load(debouncedSearch, page, selectedEncontroId);
    }, [load, debouncedSearch, page, selectedEncontroId]);

    // Local filtering removed as it's now server-side
    // useEffect(() => { ... }, [search, pessoas]);

    const openCreate = () => {
        scrollPositionRef.current = window.scrollY;
        setSelected(null);
        setFormError(null);
        setMode('create');
        window.scrollTo(0, 0);
    };
    const openEdit = (p: Pessoa) => {
        scrollPositionRef.current = window.scrollY;
        setSelected(p);
        setFormError(null);
        setMode('edit');
        window.scrollTo(0, 0);
    };
    const backToList = () => {
        setMode('list');
        setSelected(null);
        // Scroll restoration happens in a useEffect
    };

    useEffect(() => {
        if (mode === 'list' && scrollPositionRef.current > 0) {
            // Give a small timeout for the DOM to render
            const timer = setTimeout(() => {
                window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
                scrollPositionRef.current = 0;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [mode]);

    const handleBack = () => {
        if (mode !== 'list') {
            backToList();
        } else {
            navigate('/cadastros');
        }
    };

    const handleSubmit = async (data: PessoaFormData, _shouldConfirm: boolean) => {
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
                setFiltered((prev) => prev.map((p) => (p.id === atualizada.id ? atualizada : p)));
                toast.success('Cadastro atualizado com sucesso!');
            }
            backToList();
            if (mode === 'create') {
                setPage(1); // Reset to first page on create
                load(debouncedSearch, 1, selectedEncontroId);
            }
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
            toast.success('Cadastro excluído com sucesso!');
            await load(debouncedSearch, page, selectedEncontroId);
        } catch (err: unknown) {
            const errorObj = err as { code?: string };
            if (errorObj.code === '23503') {
                toast.error('Não é possível excluir pois existem registros vinculados.');
            } else {
                toast.error('Erro ao excluir cadastro.');
            }
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    };

    return (
        <div className="container" style={{ paddingBottom: '2rem' }}>
            <PageHeader
                title="Pessoas"
                subtitle="Gestão de Cadastros"
                onBack={handleBack}
                actions={mode === 'list' && (
                    <button onClick={openCreate} className="btn-primary flex items-center gap-2">
                        <UserPlus size={18} />
                        <span>Nova Pessoa</span>
                    </button>
                )}
            />

            {/* Form mode */}
            {(mode === 'create' || mode === 'edit') && (
                <div className="card animate-fade-in" style={{ marginTop: '1.5rem' }}>
                    <div className="page-form-header" style={{ borderBottom: 'none', marginBottom: '2rem' }}>
                        <div className="page-form-icon">
                            {mode === 'create' ? <UserPlus size={18} /> : <User size={18} />}
                        </div>
                        <h2 className="page-form-title" style={{ fontSize: '1.4rem' }}>
                            {mode === 'create' ? 'Novo Cadastro de Pessoa' : `Editando: ${selected?.nome_completo}`}
                        </h2>
                    </div>

                    {formError && (
                        <div className="alert alert--error" style={{ marginBottom: '1.5rem' }}>
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
                    <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                            <div style={{ flex: 1, minWidth: '300px' }}>
                                <div className="form-input-wrapper">
                                    <div className="form-input-icon">
                                        <Search size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        className="form-input form-input--with-icon"
                                        placeholder="Buscar por nome, e-mail, telefone ou comunidade…"
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            setPage(1);
                                        }}
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch('')}
                                            style={{
                                                position: 'absolute',
                                                right: '0.6rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'var(--muted-text)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0.2rem',
                                            }}
                                            title="Limpar busca"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Encontro:</span>
                                    <select
                                        className="form-input"
                                        style={{ padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.85rem', width: 'auto', minWidth: '160px', marginTop: 0, height: '38px' }}
                                        value={selectedEncontroId}
                                        onChange={(e) => {
                                            setSelectedEncontroId(e.target.value);
                                            setPage(1);
                                        }}
                                    >
                                        <option value="">Todos os Encontros</option>
                                        {encontros.map(e => (
                                            <option key={e.id} value={e.id}>{e.nome}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Exibir:</span>
                                    <select
                                        className="form-input"
                                        style={{ padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.85rem', width: 'auto', marginTop: 0, height: '38px' }}
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(Number(e.target.value));
                                            setPage(1);
                                        }}
                                    >
                                        <option value={10}>10 por página</option>
                                        <option value={20}>20 por página</option>
                                        <option value={50}>50 por página</option>
                                        <option value={100}>100 por página</option>
                                    </select>
                                </div>
                            </div>
                        </div>
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
                            <button onClick={() => load(search, page, selectedEncontroId)}>Tentar novamente</button>
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
                                Mostrando <strong>{pessoas.length}</strong> de <strong>{totalCount}</strong> {totalCount === 1 ? 'pessoa encontrada' : 'pessoas encontradas'}
                            </p>
                            <div className="pessoa-grid">
                                {filtered.map((p) => (
                                    <PessoaCard
                                        key={p.id}
                                        pessoa={p}
                                        onEdit={openEdit}
                                        onDelete={setDeleteTarget}
                                        onHistory={setHistoryTarget}
                                    />
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalCount > pageSize && (
                                <div style={{
                                    marginTop: '2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '1rem'
                                }}>
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="btn-secondary"
                                        style={{ minWidth: '100px' }}
                                    >
                                        Anterior
                                    </button>
                                    <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                        Página <strong>{page}</strong> de {Math.ceil(totalCount / pageSize)}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={page >= Math.ceil(totalCount / pageSize)}
                                        className="btn-secondary"
                                        style={{ minWidth: '100px' }}
                                    >
                                        Próxima
                                    </button>
                                </div>
                            )}
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

            {historyTarget && (
                <HistoricoModal 
                    pessoa={historyTarget} 
                    isOpen={!!historyTarget} 
                    onClose={() => setHistoryTarget(null)} 
                />
            )}
        </div>
    );
}
