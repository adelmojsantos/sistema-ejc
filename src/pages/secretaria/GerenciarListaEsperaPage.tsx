import { Calendar, Check, CheckCircle, CheckCircle2, ChevronRight, Mail, MapPin, Phone, Search, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Header } from '../../components/Header';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { encontroService } from '../../services/encontroService';
import { listaEsperaService } from '../../services/listaEsperaService';
import type { Encontro } from '../../types/encontro';
import type { ListaEsperaEntry } from '../../types/listaEspera';
import { formatTelefone, maskCpf, maskTelefone } from '../../utils/cpfUtils';
import { calculateAge } from '../../utils/dateUtils';


export function GerenciarListaEsperaPage() {
    const [encontroAtivo, setEncontroAtivo] = useState<Encontro | null>(null);
    const [entries, setEntries] = useState<ListaEsperaEntry[]>([]);
    const [efetivados, setEfetivados] = useState<ListaEsperaEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Batch Selection Data
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog / Modal Data
    const [showBatchConfirm, setShowBatchConfirm] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<ListaEsperaEntry | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const encontros = await encontroService.listar();
            const active = encontros.find(e => e.ativo);

            if (active) {
                setEncontroAtivo(active);
                const pendentes = await listaEsperaService.listPendentesNoEncontro(active.id);
                const efetivados = await listaEsperaService.listEfetivadosNoEncontro(active.id);
                setEntries([...pendentes]);
                setEfetivados([...efetivados]);
            }
        } catch (error) {
            toast.error('Erro ao carregar fila de espera');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredEntries = entries.filter(e =>
        e.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.telefone.includes(searchTerm)
    );

    const handleSelectAll = () => {
        if (selectedIds.size === entries.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(entries.map(e => e.id)));
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

    const handleEfetivarSingle = async (entry: ListaEsperaEntry) => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const { id, created_at, status, ...formData } = entry;
            await listaEsperaService.efetivarListaEspera(id, formData);
            toast.success(`Inscrição de ${entry.nome_completo} efetivada com sucesso!`);
            await loadData();

            const newSet = new Set(selectedIds);
            newSet.delete(id);
            setSelectedIds(newSet);
        } catch (err: any) {
            toast.error(`Erro: ${err.message}`);
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

            if (result.fails > 0) {
                toast.error(`${result.success} efetuados com sucesso. ${result.fails} falharam.`, { id: idLoadingToast });
            } else {
                toast.success(`Todos os ${result.success} foram efetivados com sucesso!`, { id: idLoadingToast });
            }

            setSelectedIds(new Set());
            await loadData();
        } catch (err) {
            toast.error('Erro inesperado na aprovação em lote', { id: idLoadingToast });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="app-shell">
            <Header />

            <main className="main-content container">
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
                        <div className="stats-row">
                            <div className="premium-stat-card">
                                <div className="stat-icon-wrapper">
                                    <Users size={24} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{entries.length}</div>
                                    <div className="stat-label">Inscritos Online</div>
                                </div>
                            </div>
                            <div className="premium-stat-card">
                                <div className="stat-icon-wrapper" style={{ color: 'var(--accent-color)', background: 'rgba(245, 158, 11, 0.1)' }}>
                                    <CheckCircle size={24} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">
                                        {encontroAtivo.limite_vagas_online - (entries.length + efetivados.length) > 0
                                            ? encontroAtivo.limite_vagas_online - (entries.length + efetivados.length)
                                            : 0}
                                    </div>
                                    <div className="stat-label">Vagas Restantes</div>
                                </div>
                            </div>
                        </div>

                        {/* Search and Batch Actions Card */}
                        <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                            <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Buscar por nome ou telefone..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft: '3rem', fontSize: '0.9rem' }}
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                {selectedIds.size > 0 && (
                                    <button
                                        className="btn-success"
                                        onClick={() => setShowBatchConfirm(true)}
                                        disabled={isProcessing}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <CheckCircle2 size={18} /> <span>Aprovar Selecionados ({selectedIds.size})</span>
                                    </button>
                                )}
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
                                    <input
                                        type="checkbox"
                                        className="form-checkbox"
                                        checked={selectedIds.size === entries.length && entries.length > 0}
                                        onChange={handleSelectAll}
                                        style={{ width: '1.2rem', height: '1.2rem' }}
                                    />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Selecionar Todos</span>
                                </label>
                            </div>
                        </div>

                        {/* Card List Rendering */}
                        {isLoading ? (
                            <div className="text-center py-8 text-muted">Aguarde, carregando lista...</div>
                        ) : filteredEntries.length === 0 ? (
                            <div className="empty-state card">
                                <Users size={48} />
                                <h3>Nenhum cadastro encontrado</h3>
                                <p>Tente ajustar sua busca ou verifique se há inscritos para este encontro.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {filteredEntries.map((entry) => {
                                    const isPriority = entry.fez_ejc_outra_paroquia;
                                    const age = calculateAge(entry.data_nascimento);

                                    return (
                                        <div
                                            key={entry.id}
                                            className={`member-premium-card ${isPriority ? 'is-priority' : ''} ${selectedIds.has(entry.id) ? 'selected' : ''}`}
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('button')) return;
                                                handleToggleSelect(entry.id);
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="member-selection-header">
                                                <div className="desktop-selection hide-mobile">
                                                    <input
                                                        type="checkbox"
                                                        className="form-checkbox"
                                                        checked={selectedIds.has(entry.id)}
                                                        onChange={() => handleToggleSelect(entry.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ width: '1.2rem', height: '1.2rem' }}
                                                    />
                                                </div>

                                                <div className="member-selection-mobile show-mobile">
                                                    <div className="name-checkbox-group">
                                                        <input
                                                            type="checkbox"
                                                            className="form-checkbox"
                                                            checked={selectedIds.has(entry.id)}
                                                            onChange={() => handleToggleSelect(entry.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }}
                                                        />
                                                        <div className="mobile-name-badges">
                                                            <div className="member-header-row" style={{ margin: 0 }}>
                                                                <span className="member-name" style={{ fontSize: '1rem' }}>{entry.nome_completo}</span>
                                                            </div>
                                                            {isPriority && (
                                                                <span className="member-badge-pill priority" style={{ marginTop: '4px' }}>
                                                                    <Check size={8} /> Prioridade
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        className="status-pill-btn"
                                                        onClick={(e) => { e.stopPropagation(); handleEfetivarSingle(entry); }}
                                                        disabled={isProcessing}
                                                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                                    >
                                                        <CheckCircle size={14} /> Efetivar
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="member-main-info">
                                                <div className="member-header-row hide-mobile">
                                                    <span className="member-name">{entry.nome_completo}</span>
                                                    {isPriority && (
                                                        <span className="member-badge-pill priority">
                                                            <Check size={10} /> Outra Paróquia
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="member-meta-grid">
                                                    <div className="meta-item">
                                                        <Phone size={14} /> {maskTelefone(entry.telefone)}
                                                    </div>
                                                    <div className="meta-item">
                                                        <Calendar size={14} /> {age ? `${age} anos` : '—'}
                                                    </div>
                                                    <div className="meta-item">
                                                        <Mail size={14} /> <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{entry.email || '—'}</span>
                                                    </div>
                                                    <div className="meta-item">
                                                        <MapPin size={14} /> {entry.bairro}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="member-actions">
                                                <button
                                                    className="status-pill-btn hide-mobile"
                                                    onClick={(e) => { e.stopPropagation(); handleEfetivarSingle(entry); }}
                                                    disabled={isProcessing}
                                                >
                                                    <CheckCircle size={16} /> Efetivar
                                                </button>

                                                <button
                                                    className="btn-text member-details-btn"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, opacity: 0.8 }}
                                                >
                                                    <span>Ver Ficha <span className="hide-mobile">Completa</span></span>
                                                    <ChevronRight size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>

            <ConfirmDialog
                isOpen={showBatchConfirm}
                title="Aprovação em Lote"
                message={<>Você está prestes a aprovar e inserir oficialmente <strong>{selectedIds.size} jovens</strong> ao encontro ativo. Eles se tornarão Pessoas e Participantes no sistema.<br /><br />Deseja confirmar?</>}
                confirmText="Sim, Efetivar Todos"
                cancelText="Cancelar"
                onConfirm={handleEfetivarLote}
                onCancel={() => setShowBatchConfirm(false)}
            />

            {/* Modal de Detalhes Completo */}
            <Modal
                isOpen={!!selectedEntry}
                onClose={() => setSelectedEntry(null)}
                title="Ficha do Jovem"
                maxWidth="800px"
            >
                {selectedEntry && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            {/* Dados Pessoais */}
                            <div className="card-inner" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Dados Pessoais</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, auto) 1fr', gap: '0.5rem 1rem', fontSize: '0.9rem' }}>
                                    <span style={{ opacity: 0.6 }}>Nome:</span> <span style={{ fontWeight: 600 }}>{selectedEntry.nome_completo}</span>
                                    <span style={{ opacity: 0.6 }}>CPF:</span> <span>{maskCpf(selectedEntry.cpf)}</span>
                                    <span style={{ opacity: 0.6 }}>E-mail:</span> <span style={{ fontSize: '0.85rem' }}>{selectedEntry.email || '—'}</span>
                                    <span style={{ opacity: 0.6 }}>Nasc:</span> <span>{selectedEntry.data_nascimento ? `${new Date(selectedEntry.data_nascimento.includes('T') ? selectedEntry.data_nascimento : `${selectedEntry.data_nascimento}T00:00:00`).toLocaleDateString('pt-BR')} (${calculateAge(selectedEntry.data_nascimento)} anos)` : '—'}</span>
                                </div>
                            </div>

                            {/* Contato e Endereço */}
                            <div className="card-inner" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Contato e Localização</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, auto) 1fr', gap: '0.5rem 1rem', fontSize: '0.9rem' }}>
                                    <span style={{ opacity: 0.6 }}>Telefone:</span> <span>{formatTelefone(selectedEntry.telefone)}</span>
                                    <span style={{ opacity: 0.6 }}>CEP:</span> <span>{selectedEntry.cep || '—'}</span>
                                    <span style={{ opacity: 0.6 }}>Endereço:</span> <span>{selectedEntry.endereco || '—'}{selectedEntry.numero ? `, ${selectedEntry.numero}` : ''}</span>
                                    <span style={{ opacity: 0.6 }}>Bairro:</span> <span>{selectedEntry.bairro} - {selectedEntry.cidade}/{selectedEntry.estado}</span>
                                </div>
                            </div>

                            {/* Família */}
                            <div className="card-inner" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Pais / Responsáveis</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, auto) 1fr', gap: '0.5rem 1rem', fontSize: '0.9rem' }}>
                                    <span style={{ opacity: 0.6 }}>Pai:</span> <span>{selectedEntry.nome_pai || '—'}</span>
                                    <span style={{ opacity: 0.6 }}>Tel Pai:</span> <span>{formatTelefone(selectedEntry.telefone_pai) || '—'}</span>
                                    <span style={{ opacity: 0.6 }}>Mãe:</span> <span>{selectedEntry.nome_mae || '—'}</span>
                                    <span style={{ opacity: 0.6 }}>Tel Mãe:</span> <span>{formatTelefone(selectedEntry.telefone_mae) || '—'}</span>
                                </div>
                            </div>

                            {/* EJC e Comunidade */}
                            <div className="card-inner" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Religioso / EJC</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, auto) 1fr', gap: '0.5rem 1rem', fontSize: '0.9rem' }}>
                                    <span style={{ opacity: 0.6 }}>Comunidade:</span> <span>{selectedEntry.comunidade || '—'}</span>
                                    <span style={{ opacity: 0.6 }}>Fez outro:</span> <span>{selectedEntry.fez_ejc_outra_paroquia ? 'Sim' : 'Não'}</span>
                                    {selectedEntry.fez_ejc_outra_paroquia && (
                                        <>
                                            <span style={{ opacity: 0.6 }}>Onde:</span> <span>{selectedEntry.qual_paroquia_ejc}</span>
                                        </>
                                    )}
                                    <span style={{ opacity: 0.6 }}>Outros:</span> <span style={{ fontSize: '0.85rem' }}>{selectedEntry.outros_contatos || '—'}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <button className="btn-secondary" onClick={() => setSelectedEntry(null)}>Fechar</button>
                            <button
                                className="btn-success"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                onClick={async () => {
                                    await handleEfetivarSingle(selectedEntry);
                                    setSelectedEntry(null);
                                }}
                                disabled={isProcessing}
                            >
                                <CheckCircle2 size={18} /> Aprovar e Efetivar
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
