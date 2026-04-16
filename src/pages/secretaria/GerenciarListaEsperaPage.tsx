import { Calendar, CheckCircle, CheckCircle2, CheckSquare, ChevronRight, Clock, Mail, MapPin, Phone, Search, Square, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { encontroService } from '../../services/encontroService';
import { listaEsperaService } from '../../services/listaEsperaService';
import { pessoaService } from '../../services/pessoaService';
import type { Encontro } from '../../types/encontro';
import type { ListaEsperaEntry } from '../../types/listaEspera';
import type { Pessoa } from '../../types/pessoa';
import { formatTelefone, maskCpf } from '../../utils/cpfUtils';
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

    // Duplicate Check Modal Data
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateEntry, setDuplicateEntry] = useState<ListaEsperaEntry | null>(null);
    const [duplicateCandidates, setDuplicateCandidates] = useState<Pessoa[]>([]);

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

            const { id, created_at, status, ...formData } = entry;
            await listaEsperaService.efetivarListaEspera(id, formData);
            toast.success(`Inscrição de ${entry.nome_completo} efetivada com sucesso!`);

            setShowDuplicateModal(false);
            setDuplicateEntry(null);
            setDuplicateCandidates([]);

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

    const handleVincularExistente = async (pessoa: Pessoa) => {
        if (!duplicateEntry || isProcessing) return;
        setIsProcessing(true);
        try {
            const { id, created_at, status, ...formData } = duplicateEntry;
            await listaEsperaService.vincularPessoaExistente(id, pessoa.id, formData);
            toast.success(`${duplicateEntry.nome_completo} vinculado e efetivado com sucesso!`);

            setShowDuplicateModal(false);
            setDuplicateEntry(null);
            setDuplicateCandidates([]);

            await loadData();
        } catch (err: any) {
            toast.error(`Erro: ${err.message}`);
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
        } catch (err: any) {
            toast.error(`Erro ao remover: ${err.message}`);
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
        } catch (err) {
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
                            <div
                                onClick={handleSelectAll}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none', padding: '0.5rem', borderRadius: '8px', transition: 'background 0.2s' }}
                                className="hover-highlight"
                            >
                                {selectedIds.size === entries.length && entries.length > 0 ? (
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
                                                    <span className="waiting-list-tag waiting-list-tag--amber">
                                                        Outra Paróquia
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
                                                <button
                                                    className="btn-success"
                                                    onClick={(e) => { e.stopPropagation(); handleEfetivarSingle(entry); }}
                                                    disabled={isProcessing}
                                                >
                                                    <CheckCircle size={16} /> Efetivar
                                                </button>
                                                <button
                                                    className="btn-text"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)' }}
                                                >
                                                    <span>Ver Ficha Completa</span>
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
                                        {((c as any).participacoes && (c as any).participacoes.length > 0) && (
                                            <div style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
                                                <strong style={{ opacity: 0.6 }}>Histórico: </strong>
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
                                    <span style={{ opacity: 0.6 }}>CPF:</span> <span>{maskCpf(selectedEntry.cpf || '')}</span>
                                    <span style={{ opacity: 0.6 }}>E-mail:</span> <span style={{ fontSize: '0.85rem' }}>{selectedEntry.email || '—'}</span>
                                    <span style={{ opacity: 0.6 }}>Nasc:</span> <span>{selectedEntry.data_nascimento ? `${new Date(selectedEntry.data_nascimento.includes('T') ? selectedEntry.data_nascimento : `${selectedEntry.data_nascimento}T00:00:00`).toLocaleDateString('pt-BR')} (${calculateAge(selectedEntry.data_nascimento)})` : '—'}</span>
                                </div>
                            </div>

                            {/* Contato e Endereço */}
                            <div className="card-inner" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Contato e Localização</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, auto) 1fr', gap: '0.5rem 1rem', fontSize: '0.9rem' }}>
                                    <span style={{ opacity: 0.6 }}>Telefone:</span> <span>{formatTelefone(selectedEntry.telefone || '')}</span>
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
                                    <span style={{ opacity: 0.6 }}>Tel Pai:</span> <span>{formatTelefone(selectedEntry.telefone_pai || '') || '—'}</span>
                                    <span style={{ opacity: 0.6 }}>Mãe:</span> <span>{selectedEntry.nome_mae || '—'}</span>
                                    <span style={{ opacity: 0.6 }}>Tel Mãe:</span> <span>{formatTelefone(selectedEntry.telefone_mae || '') || '—'}</span>
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
                                    if (selectedEntry) {
                                        await handleEfetivarSingle(selectedEntry);
                                        setSelectedEntry(null);
                                    }
                                }}
                                disabled={isProcessing}
                            >
                                <CheckCircle2 size={18} /> Aprovar e Efetivar
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
