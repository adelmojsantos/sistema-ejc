import { Calendar, CheckCircle, CheckCircle2, CheckSquare, ChevronRight, Clock, Mail, MapPin, Phone, Search, Square, Users, X, RotateCcw, Edit, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { listaEsperaService } from '../../services/listaEsperaService';
import { pessoaService } from '../../services/pessoaService';
import { useEncontros } from '../../contexts/EncontroContext';
import type { ListaEsperaEntry, ListaEsperaFormData } from '../../types/listaEspera';
import type { Pessoa } from '../../types/pessoa';
import { formatTelefone, maskCpf } from '../../utils/cpfUtils';
import { calculateAge } from '../../utils/dateUtils';

export function GerenciarListaEsperaPage() {
    const { encontroAtivo } = useEncontros();
    const [entries, setEntries] = useState<ListaEsperaEntry[]>([]);
    const [efetivados, setEfetivados] = useState<ListaEsperaEntry[]>([]);
    const [reprovados, setReprovados] = useState<ListaEsperaEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'pendente' | 'reprovado'>('pendente');

    // Batch Selection Data
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog / Modal Data
    const [showBatchConfirm, setShowBatchConfirm] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<ListaEsperaEntry | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Edit Mode Data
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<ListaEsperaFormData>>({});

    // Duplicate Check Modal Data
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateEntry, setDuplicateEntry] = useState<ListaEsperaEntry | null>(null);
    const [duplicateCandidates, setDuplicateCandidates] = useState<Pessoa[]>([]);

    useEffect(() => {
        loadData();
    }, [encontroAtivo]);

    const loadData = async () => {
        if (!encontroAtivo) return;
        setIsLoading(true);
        try {
            // Queries paralelas: elimina espera sequencial
            const [pendentes, efetivadosData, reprovadosData] = await Promise.all([
                listaEsperaService.listPendentesNoEncontro(encontroAtivo.id),
                listaEsperaService.listEfetivadosNoEncontro(encontroAtivo.id),
                listaEsperaService.listReprovadosNoEncontro(encontroAtivo.id),
            ]);
            setEntries([...pendentes]);
            setEfetivados([...efetivadosData]);
            setReprovados([...reprovadosData]);
        } catch (error) {
            console.error('Erro ao carregar lista de espera:', error);
            toast.error('Erro ao carregar dados');
        } finally {
            setIsLoading(false);
        }
    };

    const currentList = viewMode === 'pendente' ? entries : reprovados;

    const filteredEntries = currentList.filter(e => {
        const term = searchTerm.toLowerCase().trim();
        const normalize = (s: string | null) => (s || '').replace(/\D/g, '');
        const termDigits = normalize(term);

        if (!term) return true;

        const matchNome = e.nome_completo.toLowerCase().includes(term);
        const matchCpf = e.cpf && (e.cpf.includes(term) || (termDigits && normalize(e.cpf).includes(termDigits)));
        const matchEmail = e.email?.toLowerCase().includes(term);
        const matchTelefone = e.telefone && (termDigits && normalize(e.telefone).includes(termDigits));
        const matchBairro = e.bairro?.toLowerCase().includes(term);

        return matchNome || matchCpf || matchEmail || matchTelefone || matchBairro;
    });

    const handleSelectAll = () => {
        if (selectedIds.size === currentList.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(currentList.map(e => e.id)));
        }
    };

    const handleToggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    // --- Ações de Inscrição ---

    const handleReprovar = async (id: string) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await listaEsperaService.recusarListaEspera(id);
            toast.success('Inscrição reprovada com sucesso.');
            await loadData();
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (err: unknown) {
            const error = err as Error;
            toast.error('Erro ao reprovar: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRestaurar = async (id: string) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await listaEsperaService.restaurarListaEspera(id);
            toast.success('Inscrição restaurada para pendente.');
            await loadData();
        } catch (err: unknown) {
            const error = err as Error;
            toast.error('Erro ao restaurar: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateEntry = async () => {
        if (!selectedEntry || isProcessing) return;
        setIsProcessing(true);
        try {
            await listaEsperaService.atualizar(selectedEntry.id, editForm);
            toast.success('Dados atualizados com sucesso!');
            setIsEditing(false);
            await loadData();
            // Atualiza o card selecionado com os novos dados
            const updated = { ...selectedEntry, ...editForm };
            setSelectedEntry(updated as ListaEsperaEntry);
        } catch (err: unknown) {
            const error = err as Error;
            toast.error('Erro ao atualizar: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEfetivarSingle = async (entry: ListaEsperaEntry, ignoreDuplicates = false) => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            if (!ignoreDuplicates) {
                const duplicates = await pessoaService.buscarPorSemelhanca(entry.nome_completo, entry.cpf);
                if (duplicates && duplicates.length > 0) {
                    setDuplicateEntry(entry);
                    setDuplicateCandidates(duplicates);
                    setShowDuplicateModal(true);
                    setIsProcessing(false);
                    return;
                }
            }

            const formData = { ...entry } as unknown as Record<string, unknown>;
            delete formData.id;
            delete formData.created_at;
            delete formData.criado_em;
            delete formData.status;

            await listaEsperaService.efetivarListaEspera(entry.id, formData as any);
            toast.success(`Inscrição de ${entry.nome_completo} efetivada com sucesso!`);

            setShowDuplicateModal(false);
            setDuplicateEntry(null);
            setDuplicateCandidates([]);

            await loadData();

            const newSet = new Set(selectedIds);
            newSet.delete(entry.id);
            setSelectedIds(newSet);
        } catch (err: unknown) {
            const error = err as Error;
            toast.error(`Erro: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleVincularExistente = async (pessoa: Pessoa) => {
        if (!duplicateEntry || isProcessing) return;
        setIsProcessing(true);
        try {
            const formData = { ...duplicateEntry } as unknown as Record<string, unknown>;
            delete formData.id;
            delete formData.created_at;
            delete formData.criado_em;
            delete formData.status;

            await listaEsperaService.vincularPessoaExistente(duplicateEntry.id, pessoa.id, formData as any);
            toast.success(`${duplicateEntry.nome_completo} vinculado e efetivado com sucesso!`);

            setShowDuplicateModal(false);
            setDuplicateEntry(null);
            setDuplicateCandidates([]);

            await loadData();
        } catch (err: unknown) {
            const error = err as Error;
            toast.error(`Erro: ${error.message}`);
            // Force close modal on error as requested
            setShowDuplicateModal(false);
            setDuplicateEntry(null);
            setDuplicateCandidates([]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRecusarOnline = async () => {
        if (!duplicateEntry || isProcessing) return;
        setIsProcessing(true);
        try {
            await listaEsperaService.recusarListaEspera(duplicateEntry.id);
            toast.success(`Inscrição online recusada e removida.`);

            setShowDuplicateModal(false);
            setDuplicateEntry(null);
            setDuplicateCandidates([]);

            await loadData();
        } catch (err: unknown) {
            const error = err as Error;
            toast.error(`Erro ao remover: ${error.message}`);
            // Force close modal on error as requested
            setShowDuplicateModal(false);
            setDuplicateEntry(null);
            setDuplicateCandidates([]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEfetivarLote = async () => {
        setShowBatchConfirm(false);

        if (selectedIds.size === 0) return;
        setIsProcessing(true);

        const idLoadingToast = toast.loading(`Efetivando ${selectedIds.size} inscrições...`);

        try {
            const selectedEntries = entries.filter(e => selectedIds.has(e.id));
            const result = await listaEsperaService.efetivarEmLote(selectedEntries);

            if (result.fails > 0 || result.suspicions > 0) {
                toast.error(`${result.success} efetuados com sucesso. ${result.fails} falharam. ${result.suspicions} suspeitas de duplicidade ignoradas.`, { id: idLoadingToast, duration: 8000 });
            } else {
                toast.success(`Todos os ${result.success} foram efetivados com sucesso!`, { id: idLoadingToast });
            }

            setSelectedIds(new Set());
            await loadData();
        } catch (error) {
            console.error('Erro ao aprovar em lote:', error);
            toast.error('Erro inesperado na aprovação em lote', { id: idLoadingToast });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
            <PageHeader
                title="Gerenciar Inscrições Online"
                subtitle="Secretaria / Registros de Pré-Inscrição"
                backPath="/secretaria"
            />

            {!encontroAtivo ? (
                <div className="card text-center py-4">
                    <p style={{ color: 'var(--danger-text)', fontWeight: 600 }}>Nenhum encontro ativo configurado.</p>
                    <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>Ative um encontro no módulo de Cadastros para gerenciar as inscrições online.</p>
                </div>
            ) : (
                <div className="premium-container">
                    {/* Stats Row */}
                    {/* Stats Row */}
                    <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                        {/* 1. Limite Total */}
                        <div className="premium-stat-card">
                            <div className="stat-icon-wrapper" style={{ color: 'var(--primary-color)', background: 'rgba(var(--primary-rgb), 0.1)' }}>
                                <CheckSquare size={24} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{encontroAtivo.limite_vagas_online}</div>
                                <div className="stat-label">Vagas (Limite)</div>
                            </div>
                        </div>

                        {/* 2. Total Inscritos (Ativos) */}
                        <div className="premium-stat-card">
                            <div className="stat-icon-wrapper" style={{ color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)' }}>
                                <Users size={24} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{entries.length + efetivados.length}</div>
                                <div className="stat-label">Inscritos (Ativos)</div>
                            </div>
                        </div>

                        {/* 3. Pendentes */}
                        <div
                            className={`premium-stat-card clickable ${viewMode === 'pendente' ? 'active-stat' : ''}`}
                            onClick={() => { setViewMode('pendente'); setSelectedIds(new Set()); }}
                            style={{
                                cursor: 'pointer',
                                border: viewMode === 'pendente' ? '2px solid var(--primary-color)' : '2px solid transparent',
                                position: 'relative'
                            }}
                        >
                            <div className="stat-icon-wrapper">
                                <Clock size={24} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{entries.length}</div>
                                <div className="stat-label">Pendentes</div>
                            </div>
                            <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontSize: '0.7rem', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <span>Ver Lista</span> <ChevronRight size={12} />
                            </div>
                        </div>

                        {/* 4. Efetivados */}
                        <div className="premium-stat-card">
                            <div className="stat-icon-wrapper" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                                <CheckCircle2 size={24} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{efetivados.length}</div>
                                <div className="stat-label">Efetivados</div>
                            </div>
                        </div>

                        {/* 5. Reprovados */}
                        <div
                            className={`premium-stat-card clickable ${viewMode === 'reprovado' ? 'active-stat' : ''}`}
                            onClick={() => { setViewMode('reprovado'); setSelectedIds(new Set()); }}
                            style={{
                                cursor: 'pointer',
                                border: viewMode === 'reprovado' ? '2px solid var(--danger-text)' : '2px solid transparent',
                                position: 'relative'
                            }}
                        >
                            <div className="stat-icon-wrapper" style={{ color: 'var(--danger-text)', background: 'rgba(239, 68, 68, 0.1)' }}>
                                <X size={24} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{reprovados.length}</div>
                                <div className="stat-label">Reprovados</div>
                            </div>
                            <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--danger-text)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <span>Ver Histórico</span> <ChevronRight size={12} />
                            </div>
                        </div>

                        {/* 6. Restantes */}
                        <div className="premium-stat-card">
                            <div className="stat-icon-wrapper" style={{ color: 'var(--accent-color)', background: 'rgba(245, 158, 11, 0.1)' }}>
                                <Calendar size={24} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">
                                    {encontroAtivo.limite_vagas_online - (entries.length + efetivados.length) > 0
                                        ? encontroAtivo.limite_vagas_online - (entries.length + efetivados.length)
                                        : 0}
                                </div>
                                <div className="stat-label">Restantes</div>
                            </div>
                        </div>
                    </div>

                    {/* Search and Batch Actions Card */}
                    <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <div className="form-input-wrapper">
                                <div className="form-input-icon">
                                    <Search size={16} />
                                </div>
                                <input
                                    type="text"
                                    className="form-input form-input--with-icon"
                                    placeholder={viewMode === 'pendente' ? "Buscar pendentes..." : "Buscar reprovados..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
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

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {selectedIds.size > 0 && viewMode === 'pendente' && (
                                <button
                                    className="btn-success"
                                    onClick={() => setShowBatchConfirm(true)}
                                    disabled={isProcessing}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <CheckCircle2 size={18} /> <span>Aprovar Selecionados ({selectedIds.size})</span>
                                </button>
                            )}
                            <div
                                onClick={handleSelectAll}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none', padding: '0.5rem', borderRadius: '8px', transition: 'background 0.2s' }}
                                className="hover-highlight"
                            >
                                {selectedIds.size === currentList.length && currentList.length > 0 ? (
                                    <CheckSquare size={22} style={{ color: 'var(--primary-color)' }} />
                                ) : (
                                    <Square size={22} style={{ opacity: 0.4 }} />
                                )}
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Selecionar Todos</span>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-5">Carregando dados...</div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="card text-center py-5">
                            <Users size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                            <p style={{ opacity: 0.5 }}>Nenhuma inscrição encontrada para o termo buscado.</p>
                        </div>
                    ) : (
                        <div className="lista-espera-grid">
                            {filteredEntries.map((entry) => {
                                const isSelected = selectedIds.has(entry.id);
                                return (
                                    <div
                                        key={entry.id}
                                        className={`premium-card lista-espera-card animate-fade-in clickable ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleToggleSelect(entry.id)}
                                        style={{
                                            borderLeft: `4px solid ${entry.fez_ejc_outra_paroquia ? '#f59e0b' : 'var(--primary-color)'}`
                                        }}
                                    >
                                        <div className="lista-espera-line-layout">
                                            {/* Item 1: Checkbox */}
                                            <div className="lista-espera-card__checkbox" style={{ color: isSelected ? 'var(--primary-color)' : 'inherit' }}>
                                                {isSelected ? (
                                                    <CheckSquare size={22} />
                                                ) : (
                                                    <Square size={22} style={{ opacity: 0.3 }} />
                                                )}
                                            </div>

                                            {/* Item 2: Header (Nome e Badge) */}
                                            <div className="lista-espera-card__header">
                                                <h3 className="lista-espera-card__name">{entry.nome_completo}</h3>
                                                {entry.fez_ejc_outra_paroquia && (
                                                    <span className="waiting-list-tag waiting-list-tag--amber" title={entry.qual_paroquia_ejc || ''}>
                                                        Outra Paróquia{entry.qual_paroquia_ejc ? `: ${entry.qual_paroquia_ejc}` : ''}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Item 3: Linha de Data (Posicionado Absoluto pelo CSS) */}
                                            <div className="lista-espera-card__date-line">
                                                <Clock size={10} />
                                                <span>{new Date(entry.created_at).toLocaleDateString('pt-BR')}</span>
                                            </div>

                                            {/* Item 4: Linhas de Dados */}
                                            <div className="lista-espera-card__data-row">
                                                {/* Linha 1: Telefone e Idade */}
                                                <div className="lista-espera-info-row">
                                                    <div className="info-item">
                                                        <Phone size={14} />
                                                        <span>{formatTelefone(entry.telefone)}</span>
                                                    </div>
                                                    <div className="info-item">
                                                        <Calendar size={14} />
                                                        <span>
                                                            {entry.data_nascimento
                                                                ? `${new Date(entry.data_nascimento.includes('T') ? entry.data_nascimento : `${entry.data_nascimento}T12:00:00`).toLocaleDateString('pt-BR')} (${calculateAge(entry.data_nascimento)} anos)`
                                                                : '—'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Linha 2: E-mail */}
                                                <div className="lista-espera-info-row">
                                                    <div className="info-item">
                                                        <Mail size={14} />
                                                        <span title={entry.email || undefined}>{entry.email || '—'}</span>
                                                    </div>
                                                </div>

                                                {/* Linha 3: Endereço (Link Maps) */}
                                                <div className="lista-espera-info-row">
                                                    <div className="info-item">
                                                        <MapPin size={14} />
                                                        <a
                                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                                                `${entry.endereco}, ${entry.numero}, ${entry.bairro}, ${entry.cidade} - ${entry.estado}`
                                                            )}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="maps-link"
                                                            onClick={(e) => e.stopPropagation()}
                                                            title="Ver no Google Maps"
                                                        >
                                                            {entry.endereco}, {entry.numero} - {entry.bairro}
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Item 5: Divisor (Apenas Mobile) */}
                                            <div className="lista-espera-card__divider" />

                                            {/* Item 6: Ações */}
                                            <div className="lista-espera-card__actions">
                                                {viewMode === 'pendente' ? (
                                                    <>
                                                        <button
                                                            className="btn-success"
                                                            onClick={(e) => { e.stopPropagation(); handleEfetivarSingle(entry); }}
                                                            disabled={isProcessing}
                                                        >
                                                            <CheckCircle size={16} /> Efetivar
                                                        </button>
                                                        <button
                                                            className="btn-danger"
                                                            onClick={(e) => { e.stopPropagation(); handleReprovar(entry.id); }}
                                                            disabled={isProcessing}
                                                            title="Reprovar Inscrição"
                                                        >
                                                            <X size={16} /> Reprovar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className="btn-primary"
                                                        onClick={(e) => { e.stopPropagation(); handleRestaurar(entry.id); }}
                                                        disabled={isProcessing}
                                                        style={{ gap: '0.5rem' }}
                                                    >
                                                        <RotateCcw size={16} /> Restaurar para Pendente
                                                    </button>
                                                )}

                                                <button
                                                    className="btn-text"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedEntry(entry);
                                                        setIsEditing(false);
                                                        setEditForm(entry);
                                                    }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)' }}
                                                >
                                                    <span>{viewMode === 'pendente' ? 'Ver Ficha / Editar' : 'Ver Ficha'}</span>
                                                    <ChevronRight size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={showBatchConfirm}
                title="Efetivar Inscrições em Lote"
                message={<>Tem certeza que deseja marcar <strong>{selectedIds.size} inscrições</strong> como efetivadas?<br /><br />Esta ação moverá os selecionados da Lista de Espera diretamente para a base de Participantes deste encontro.<br /><br /><strong style={{ color: 'var(--danger-text)' }}>Atenção:</strong> Cadastros com suspeita de duplicidade serão ignorados pelo processo em lote.</>}
                confirmText="Sim, Efetivar Todos"
                cancelText="Cancelar"
                onConfirm={handleEfetivarLote}
                onCancel={() => setShowBatchConfirm(false)}
            />

            {showDuplicateModal && duplicateEntry && (
                <Modal isOpen={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} title="Possível Cadastro Duplicado">
                    <div style={{ padding: '1.5rem', width: '90vw', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Ação Interrompida
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
                                Encontramos pessoas já cadastradas no sistema com dados muito semelhantes aos desta inscrição online.
                                Avalie se trata-se da mesma pessoa retornando ao encontro, para apenas a vincularmos, ou se é um novo encontreiro.
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', opacity: 0.6, textTransform: 'uppercase' }}>Dados da Nova Inscrição Online</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div><small style={{ opacity: 0.6 }}>Nome</small><div><strong>{duplicateEntry.nome_completo}</strong></div></div>
                                <div><small style={{ opacity: 0.6 }}>CPF</small><div>{duplicateEntry.cpf || '—'}</div></div>
                                <div><small style={{ opacity: 0.6 }}>Telefone</small><div>{duplicateEntry.telefone || '—'}</div></div>
                                <div><small style={{ opacity: 0.6 }}>E-mail</small><div>{duplicateEntry.email || '—'}</div></div>
                            </div>
                        </div>

                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', opacity: 0.6, textTransform: 'uppercase' }}>Cadastros Similares Existentes</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                            {duplicateCandidates.map(c => (
                                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                                        <strong style={{ fontSize: '1rem' }}>{c.nome_completo}</strong>
                                        <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>CPF: {c.cpf || 'N/I'} • Tel: {c.telefone || 'N/I'} • E-mail: {c.email || 'N/I'}</span>
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {((c as any).participacoes && (c as any).participacoes.length > 0) && (
                                            <div style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
                                                <strong style={{ opacity: 0.6 }}>Histórico: </strong>
                                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                {(c as any).participacoes.map((part: any, i: number) => {
                                                    const encontroDesc = part.encontros?.nome || 'Encontro ?';
                                                    const papelDesc = part.participante ? 'Encontrista' : (part.equipes?.nome || 'Trabalhando');
                                                    return (
                                                        <span key={i} style={{ display: 'inline-block', backgroundColor: 'rgba(0,0,0,0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px', marginRight: '0.4rem', marginBottom: '0.2rem' }}>
                                                            {encontroDesc} - {papelDesc}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        className="btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
                                        onClick={() => handleVincularExistente(c)}
                                        disabled={isProcessing}
                                    >
                                        <CheckCircle size={16} /> Vincular a este
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <button
                                onClick={handleRecusarOnline}
                                className="btn-secondary"
                                style={{ color: 'var(--danger-text)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                disabled={isProcessing}
                            >
                                <X size={16} /> Recusar Inscrição Online
                            </button>

                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <button className="btn-secondary" onClick={() => setShowDuplicateModal(false)} disabled={isProcessing}>Cancelar</button>
                                <button
                                    className="btn-primary"
                                    style={{ backgroundColor: 'var(--text-color)', color: 'var(--bg-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    onClick={() => duplicateEntry && handleEfetivarSingle(duplicateEntry, true)}
                                    disabled={isProcessing}
                                >
                                    Ignorar e Criar Novo Cadastro
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal de Detalhes Completo */}
            <Modal
                isOpen={!!selectedEntry}
                onClose={() => { setSelectedEntry(null); setIsEditing(false); }}
                title={isEditing ? "Editando Ficha do Jovem" : "Ficha do Jovem"}
                maxWidth="800px"
            >
                {selectedEntry && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            {/* Dados Pessoais */}
                            <div className="card-inner" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '0.9rem', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Dados Pessoais</span>
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Nome Completo</label>
                                        {isEditing ? (
                                            <input
                                                className="form-input"
                                                value={editForm.nome_completo || ''}
                                                onChange={e => setEditForm({ ...editForm, nome_completo: e.target.value })}
                                            />
                                        ) : (
                                            <div style={{ fontWeight: 600 }}>{selectedEntry.nome_completo}</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group-sm">
                                            <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>CPF</label>
                                            {isEditing ? (
                                                <input
                                                    className="form-input"
                                                    value={editForm.cpf || ''}
                                                    onChange={e => setEditForm({ ...editForm, cpf: maskCpf(e.target.value) })}
                                                />
                                            ) : (
                                                <div>{maskCpf(selectedEntry.cpf || '')}</div>
                                            )}
                                        </div>
                                        <div className="form-group-sm">
                                            <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Nascimento</label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    style={{ colorScheme: 'dark' }}
                                                    value={editForm.data_nascimento || ''}
                                                    onChange={e => setEditForm({ ...editForm, data_nascimento: e.target.value })}
                                                />
                                            ) : (
                                                <div>{selectedEntry.data_nascimento ? `${new Date(selectedEntry.data_nascimento.includes('T') ? selectedEntry.data_nascimento : `${selectedEntry.data_nascimento}T12:00:00`).toLocaleDateString('pt-BR')} (${calculateAge(selectedEntry.data_nascimento)})` : '—'}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>E-mail</label>
                                        {isEditing ? (
                                            <input
                                                type="email"
                                                className="form-input"
                                                value={editForm.email || ''}
                                                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                            />
                                        ) : (
                                            <div style={{ fontSize: '0.85rem' }}>{selectedEntry.email || '—'}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Contato e Endereço */}
                            <div className="card-inner" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Contato e Localização</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group-sm">
                                            <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Telefone</label>
                                            {isEditing ? (
                                                <input
                                                    className="form-input"
                                                    value={editForm.telefone || ''}
                                                    onChange={e => setEditForm({ ...editForm, telefone: formatTelefone(e.target.value) })}
                                                />
                                            ) : (
                                                <div>{formatTelefone(selectedEntry.telefone || '')}</div>
                                            )}
                                        </div>
                                        <div className="form-group-sm">
                                            <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>CEP</label>
                                            {isEditing ? (
                                                <input
                                                    className="form-input"
                                                    value={editForm.cep || ''}
                                                    onChange={e => setEditForm({ ...editForm, cep: e.target.value })}
                                                />
                                            ) : (
                                                <div>{selectedEntry.cep || '—'}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Endereço e Número</label>
                                        {isEditing ? (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    className="form-input"
                                                    style={{ flex: 3 }}
                                                    value={editForm.endereco || ''}
                                                    onChange={e => setEditForm({ ...editForm, endereco: e.target.value })}
                                                />
                                                <input
                                                    className="form-input"
                                                    style={{ flex: 1 }}
                                                    placeholder="Nº"
                                                    value={editForm.numero || ''}
                                                    onChange={e => setEditForm({ ...editForm, numero: e.target.value })}
                                                />
                                            </div>
                                        ) : (
                                            <div>{selectedEntry.endereco || '—'}{selectedEntry.numero ? `, ${selectedEntry.numero}` : ''}</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group-sm">
                                            <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Bairro</label>
                                            {isEditing ? (
                                                <input
                                                    className="form-input"
                                                    value={editForm.bairro || ''}
                                                    onChange={e => setEditForm({ ...editForm, bairro: e.target.value })}
                                                />
                                            ) : (
                                                <div>{selectedEntry.bairro}</div>
                                            )}
                                        </div>
                                        <div className="form-group-sm">
                                            <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Cidade/UF</label>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        className="form-input"
                                                        style={{ flex: 2 }}
                                                        value={editForm.cidade || ''}
                                                        onChange={e => setEditForm({ ...editForm, cidade: e.target.value })}
                                                    />
                                                    <input
                                                        className="form-input"
                                                        style={{ flex: 1 }}
                                                        maxLength={2}
                                                        value={editForm.estado || ''}
                                                        onChange={e => setEditForm({ ...editForm, estado: e.target.value.toUpperCase() })}
                                                    />
                                                </div>
                                            ) : (
                                                <div>{selectedEntry.cidade}/{selectedEntry.estado}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Família */}
                            <div className="card-inner" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Pais / Responsáveis</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Nome do Pai</label>
                                        {isEditing ? (
                                            <input
                                                className="form-input"
                                                value={editForm.nome_pai || ''}
                                                onChange={e => setEditForm({ ...editForm, nome_pai: e.target.value })}
                                            />
                                        ) : (
                                            <div>{selectedEntry.nome_pai || '—'}</div>
                                        )}
                                    </div>
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Telefone do Pai</label>
                                        {isEditing ? (
                                            <input
                                                className="form-input"
                                                value={editForm.telefone_pai || ''}
                                                onChange={e => setEditForm({ ...editForm, telefone_pai: formatTelefone(e.target.value) })}
                                            />
                                        ) : (
                                            <div>{formatTelefone(selectedEntry.telefone_pai || '') || '—'}</div>
                                        )}
                                    </div>
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Nome da Mãe</label>
                                        {isEditing ? (
                                            <input
                                                className="form-input"
                                                value={editForm.nome_mae || ''}
                                                onChange={e => setEditForm({ ...editForm, nome_mae: e.target.value })}
                                            />
                                        ) : (
                                            <div>{selectedEntry.nome_mae || '—'}</div>
                                        )}
                                    </div>
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Telefone da Mãe</label>
                                        {isEditing ? (
                                            <input
                                                className="form-input"
                                                value={editForm.telefone_mae || ''}
                                                onChange={e => setEditForm({ ...editForm, telefone_mae: formatTelefone(e.target.value) })}
                                            />
                                        ) : (
                                            <div>{formatTelefone(selectedEntry.telefone_mae || '') || '—'}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* EJC e Comunidade */}
                            <div className="card-inner" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Religioso / Outras Infos</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Comunidade/Paróquia</label>
                                        {isEditing ? (
                                            <input
                                                className="form-input"
                                                value={editForm.comunidade || ''}
                                                onChange={e => setEditForm({ ...editForm, comunidade: e.target.value })}
                                            />
                                        ) : (
                                            <div>{selectedEntry.comunidade || '—'}</div>
                                        )}
                                    </div>
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Fez EJC em outra paróquia?</label>
                                        {isEditing ? (
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                    <input type="radio" checked={editForm.fez_ejc_outra_paroquia === true} onChange={() => setEditForm({ ...editForm, fez_ejc_outra_paroquia: true })} /> Sim
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                    <input type="radio" checked={editForm.fez_ejc_outra_paroquia === false} onChange={() => setEditForm({ ...editForm, fez_ejc_outra_paroquia: false })} /> Não
                                                </label>
                                            </div>
                                        ) : (
                                            <div>{selectedEntry.fez_ejc_outra_paroquia ? 'Sim' : 'Não'}</div>
                                        )}
                                    </div>
                                    {(isEditing ? editForm.fez_ejc_outra_paroquia : selectedEntry.fez_ejc_outra_paroquia) && (
                                        <div className="form-group-sm">
                                            <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Qual paróquia?</label>
                                            {isEditing ? (
                                                <input
                                                    className="form-input"
                                                    value={editForm.qual_paroquia_ejc || ''}
                                                    onChange={e => setEditForm({ ...editForm, qual_paroquia_ejc: e.target.value })}
                                                />
                                            ) : (
                                                <div>{selectedEntry.qual_paroquia_ejc}</div>
                                            )}
                                        </div>
                                    )}
                                    <div className="form-group-sm">
                                        <label style={{ opacity: 0.6, fontSize: '0.75rem' }}>Outras informações</label>
                                        {isEditing ? (
                                            <textarea
                                                className="form-input"
                                                rows={2}
                                                value={editForm.outros_contatos || ''}
                                                onChange={e => setEditForm({ ...editForm, outros_contatos: e.target.value })}
                                            />
                                        ) : (
                                            <div style={{ fontSize: '0.85rem' }}>{selectedEntry.outros_contatos || '—'}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <div>
                                {viewMode === 'pendente' && (
                                    <button
                                        className={isEditing ? "btn-secondary" : "btn-primary"}
                                        onClick={() => {
                                            if (isEditing) {
                                                setIsEditing(false);
                                                setEditForm(selectedEntry);
                                            } else {
                                                setIsEditing(true);
                                            }
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        {isEditing ? <><X size={18} /> Cancelar Edição</> : <><Edit size={18} /> Editar Cadastro</>}
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn-secondary" onClick={() => { setSelectedEntry(null); setIsEditing(false); }}>Fechar</button>
                                {isEditing ? (
                                    <button
                                        className="btn-success"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                        onClick={handleUpdateEntry}
                                        disabled={isProcessing}
                                    >
                                        <Check size={18} /> Salvar Alterações
                                    </button>
                                ) : (
                                    viewMode === 'pendente' && (
                                        <button
                                            className="btn-success"
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                            onClick={async () => {
                                                if (selectedEntry) {
                                                    await handleEfetivarSingle(selectedEntry);
                                                    setSelectedEntry(null);
                                                }
                                            }}
                                            disabled={isProcessing}
                                        >
                                            <CheckCircle2 size={18} /> Aprovar e Efetivar
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
