import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    TrendingUp,
    DollarSign,
    CheckCircle,
    Clock,
    AlertCircle,
    Edit3,
    MapPin,
    Loader,
    LayoutGrid,
    Map as MapIcon,
    Heart,
    UtensilsCrossed,
    Pill,
    AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { visitacaoService } from '../../services/visitacaoService';
import { inscricaoService } from '../../services/inscricaoService';
import type { VisitaParticipacaoEnriched, VisitaStatus, VisitaGrupo } from '../../types/visitacao';
import { toast } from 'react-hot-toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { MyParticipantsMap } from '../../components/visitacao/MyParticipantsMap';
import { formatPhone } from '../../utils/stringUtils';
import { WhatsappLogo } from 'phosphor-react';

export function VisitacaoMeusParticipantesPage() {
    const { userParticipacao, hasPermission } = useAuth();
    const navigate = useNavigate();
    const isCoordinator = hasPermission('modulo_visitacao_coordenar');

    const [participantes, setParticipantes] = useState<VisitaParticipacaoEnriched[]>([]);
    const [loading, setLoading] = useState(true);
    const [grupos, setGrupos] = useState<VisitaGrupo[]>([]);
    const [selectedGrupoId, setSelectedGrupoId] = useState<string>(() => {
        return sessionStorage.getItem('visita_selected_grupo_id') || '';
    });
    const [viewMode, setViewMode] = useState<'list' | 'map'>(() => {
        return (sessionStorage.getItem('visita_view_mode') as 'list' | 'map') || 'list';
    });
    const [grupoNome, setGrupoNome] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'pendentes' | 'visitados' | 'ausentes' | 'cancelados'>('todos');

    useEffect(() => {
        sessionStorage.setItem('visita_view_mode', viewMode);
    }, [viewMode]);

    useEffect(() => {
        if (selectedGrupoId) {
            sessionStorage.setItem('visita_selected_grupo_id', selectedGrupoId);
        }
    }, [selectedGrupoId]);

    useEffect(() => {
        async function loadGroups() {
            if (isCoordinator && userParticipacao?.encontro_id) {
                try {
                    const data = await visitacaoService.listarGrupos(userParticipacao.encontro_id);
                    setGrupos(data);
                } catch (error) {
                    console.error('Erro ao carregar grupos:', error);
                }
            }
        }
        loadGroups();
    }, [isCoordinator, userParticipacao?.encontro_id]);

    useEffect(() => {
        async function loadParticipants() {
            if (!userParticipacao) {
                setLoading(false);
                return;
            }

            try {
                let targetGrupoId = selectedGrupoId;
                let targetGrupoNome = '';

                // If not coordinator or no group selected yet, try to find the user's own group
                if (!isCoordinator || !selectedGrupoId) {
                    const { data: myVinculo, error: vinculoError } = await supabase
                        .from('visita_participacao')
                        .select('grupo_id, visita_grupos(nome)')
                        .eq('participacao_id', userParticipacao.id)
                        .eq('visitante', true)
                        .maybeSingle();

                    if (vinculoError) throw vinculoError;

                    if (myVinculo) {
                        const grupoData = Array.isArray(myVinculo.visita_grupos)
                            ? myVinculo.visita_grupos[0]
                            : myVinculo.visita_grupos;

                        targetGrupoId = myVinculo.grupo_id;
                        targetGrupoNome = (grupoData as { nome?: string } | null)?.nome || 'Minha Dupla';

                        // Set selectedGrupoId only if not already set (initial load)
                        if (isCoordinator && !selectedGrupoId) {
                            setSelectedGrupoId(targetGrupoId);
                        }
                    }
                }

                // If we have a group name from the list (for coordinators)
                if (isCoordinator && selectedGrupoId) {
                    const g = grupos.find(g => g.id === selectedGrupoId);
                    if (g) targetGrupoNome = g.nome || '';
                }

                setGrupoNome(targetGrupoNome);

                if (targetGrupoId) {
                    const encontroId = userParticipacao?.encontro_id || '';
                    
                    // 1. Fetch active participants
                    const { data: activeData, error: activeError } = await supabase
                        .from('visita_participacao')
                        .select(`
                            *,
                            participacoes:participacao_id (
                                id,
                                pessoas (*)
                            )
                        `)
                        .eq('grupo_id', targetGrupoId)
                        .eq('visitante', false);

                    if (activeError) throw activeError;

                    // 2. Fetch canceled participants from history
                    let transformedCanceled: any[] = [];
                    try {
                        const canceledData = await inscricaoService.listarCanceladosPorGrupo(targetGrupoId, encontroId);
                        transformedCanceled = canceledData.map(c => ({
                            id: c.id,
                            grupo_id: c.grupo_id,
                            participacao_id: c.dados_snapshot?.participacao_id || '',
                            status: 'cancelada',
                            observacoes: c.observacoes,
                            taxa_paga: c.dados_snapshot?.taxa_paga || false,
                            participacoes: {
                                id: c.dados_snapshot?.participacao_id || '',
                                pessoas: c.pessoas
                            },
                            is_history: true
                        }));
                    } catch (err) {
                        console.error('Erro ao buscar cancelados:', err);
                    }

                    setParticipantes([...(activeData || []), ...transformedCanceled] as unknown as VisitaParticipacaoEnriched[]);
                } else {
                    setParticipantes([]);
                }
            } catch (error) {
                console.error('Erro ao buscar participantes da visita:', error);
            } finally {
                setLoading(false);
            }
        }

        loadParticipants();
    }, [userParticipacao, isCoordinator, selectedGrupoId, grupos]);

    const stats = useMemo(() => {
        const ativos = participantes.filter(p => p.status !== 'cancelada');
        const total = ativos.length;
        const realizadas = ativos.filter(p => p.status === 'realizada').length;
        const pendentesVisita = total - realizadas;
        const pagas = ativos.filter(p => p.taxa_paga).length;
        const pendentesPagamento = total - pagas;
        return { total, realizadas, pendentesVisita, pagas, pendentesPagamento };
    }, [participantes]);

    const participantesFiltrados = useMemo(() => {
        switch (filterStatus) {
            case 'pendentes':
                return participantes.filter(p => p.status === 'pendente');
            case 'visitados':
                return participantes.filter(p => p.status === 'realizada');
            case 'ausentes':
                return participantes.filter(p => p.status === 'ausente');
            case 'cancelados':
                return participantes.filter(p => p.status === 'cancelada');
            default:
                return participantes;
        }
    }, [participantes, filterStatus]);

    const urgentes = useMemo(() => {
        return participantes.filter(p => !p.taxa_paga && p.status === 'pendente');
    }, [participantes]);

    const handleToggleTax = async (pId: string, currentStatus: boolean) => {
        try {
            await visitacaoService.atualizarVisita(pId, { taxa_paga: !currentStatus });
            setParticipantes(prev => prev.map(p => p.id === pId ? { ...p, taxa_paga: !currentStatus } : p));
            toast.success(currentStatus ? 'Pagamento removido' : 'Pagamento registrado com sucesso!');
        } catch (error) {
            console.error('Erro ao atualizar taxa:', error);
            toast.error('Erro ao atualizar pagamento.');
        }
    };

    const getStatusInfo = (status: VisitaStatus) => {
        switch (status) {
            case 'realizada': return { label: 'Visitado', color: '#10b981', icon: <CheckCircle size={14} /> };
            case 'ausente': return { label: 'Ausente', color: '#f59e0b', icon: <AlertCircle size={14} /> };
            case 'cancelada': return { label: 'Cancelada', color: '#ef4444', icon: <AlertCircle size={14} /> };
            default: return { label: 'Pendente', color: '#6b7280', icon: <Clock size={14} /> };
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader className="animate-spin" size={32} />
            </div>
        );
    }

    return (
        <>
            <PageHeader
                title={grupoNome || 'Participantes da Visita'}
                subtitle="Início / Visitação"
                backPath="/visitacao"
            />

            {isCoordinator && (
                <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>Alternar Visualização de Dupla</label>
                    <select
                        className="form-input"
                        value={selectedGrupoId}
                        onChange={(e) => setSelectedGrupoId(e.target.value)}
                    >
                        <option value="">Selecione uma dupla...</option>
                        {grupos.map(g => (
                            <option key={g.id} value={g.id}>{g.nome}</option>
                        ))}
                    </select>
                </div>
            )}

            {userParticipacao && participantes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    {/* HERO PROGRESS BAR */}
                    <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, var(--card-bg) 0%, rgba(59, 130, 246, 0.05) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <TrendingUp size={18} /> Progresso da Dupla
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                                    Você visitou <strong>{stats.realizadas}</strong> de <strong>{stats.total}</strong> encontristas.
                                </p>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                                {stats.total > 0 ? Math.round((stats.realizadas / stats.total) * 100) : 0}%
                            </div>
                        </div>
                        <div style={{ width: '100%', height: '12px', background: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${stats.total > 0 ? Math.round((stats.realizadas / stats.total) * 100) : 0}%`,
                                background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                                borderRadius: '99px',
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} />
                        </div>
                    </div>

                    {/* STAT CARDS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <div style={{ background: '#10b98120', padding: '0.5rem', borderRadius: '8px', color: '#10b981' }}>
                                    <CheckCircle size={20} />
                                </div>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.realizadas}/{stats.total}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)', opacity: 0.8 }}>Visitas Realizadas</p>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '99px', marginTop: '0.75rem' }}>
                                <div style={{ height: '100%', width: `${stats.total > 0 ? (stats.realizadas / stats.total) * 100 : 0}%`, background: '#10b981', borderRadius: '99px' }} />
                            </div>
                        </div>

                        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <div style={{ background: '#f59e0b20', padding: '0.5rem', borderRadius: '8px', color: '#f59e0b' }}>
                                    <DollarSign size={20} />
                                </div>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.pagas}/{stats.total}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)', opacity: 0.8 }}>Taxas Pagas</p>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '99px', marginTop: '0.75rem' }}>
                                <div style={{ height: '100%', width: `${stats.total > 0 ? (stats.pagas / stats.total) * 100 : 0}%`, background: '#f59e0b', borderRadius: '99px' }} />
                            </div>
                        </div>

                        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <div style={{ background: '#6366f120', padding: '0.5rem', borderRadius: '8px', color: '#6366f1' }}>
                                    <Clock size={20} />
                                </div>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.pendentesVisita}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)', opacity: 0.8 }}>Restam Visitar</p>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', opacity: 0.6 }}>Conclua para bater a meta!</p>
                        </div>
                    </div>

                    {/* URGENTES TRAY */}
                    {urgentes.length > 0 && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ background: '#fee2e2', color: '#ef4444', padding: '0.5rem', borderRadius: '50%' }}>
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, color: '#991b1b', fontSize: '0.95rem' }}>Atenção Necessária</h4>
                                <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                    Você tem {urgentes.length} encontrista(s) pendente(s) de visita e pagamento. Planeje estas visitas em breve!
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!userParticipacao ? (
                <div className="card empty-state">
                    <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>Você não possui uma participação ativa neste encontro.</p>
                </div>
            ) : participantes.length === 0 ? (
                <div className="card empty-state">
                    <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>Nenhum encontrista vinculado à sua dupla no momento.</p>
                </div>
            ) : (
                <>
                    {/* CONTROLS & FILTERS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <LayoutGrid size={16} /> Lista
                                </button>
                                <button
                                    onClick={() => setViewMode('map')}
                                    className={viewMode === 'map' ? 'btn-primary' : 'btn-secondary'}
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <MapIcon size={16} /> Mapa
                                </button>
                            </div>

                            {viewMode === 'list' && (
                                <div className="filter-chips" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => setFilterStatus('todos')}
                                        style={{ padding: '0.3rem 0.8rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, border: 'none', background: filterStatus === 'todos' ? 'var(--primary-color)' : 'var(--secondary-bg)', color: filterStatus === 'todos' ? 'white' : 'var(--text-color)', cursor: 'pointer', transition: '0.2s' }}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('pendentes')}
                                        style={{ padding: '0.3rem 0.8rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, border: 'none', background: filterStatus === 'pendentes' ? '#6b7280' : 'var(--secondary-bg)', color: filterStatus === 'pendentes' ? 'white' : 'var(--text-color)', cursor: 'pointer', transition: '0.2s' }}
                                    >
                                        Pendentes
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('visitados')}
                                        style={{ padding: '0.3rem 0.8rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, border: 'none', background: filterStatus === 'visitados' ? '#10b981' : 'var(--secondary-bg)', color: filterStatus === 'visitados' ? 'white' : 'var(--text-color)', cursor: 'pointer', transition: '0.2s' }}
                                    >
                                        Visitados
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('ausentes')}
                                        style={{ padding: '0.3rem 0.8rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, border: 'none', background: filterStatus === 'ausentes' ? '#f59e0b' : 'var(--secondary-bg)', color: filterStatus === 'ausentes' ? 'white' : 'var(--text-color)', cursor: 'pointer', transition: '0.2s' }}
                                    >
                                        Ausentes
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('cancelados')}
                                        style={{ padding: '0.3rem 0.8rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, border: 'none', background: filterStatus === 'cancelados' ? '#ef4444' : 'var(--secondary-bg)', color: filterStatus === 'cancelados' ? 'white' : 'var(--text-color)', cursor: 'pointer', transition: '0.2s' }}
                                    >
                                        Cancelados
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {viewMode === 'map' ? (
                        <MyParticipantsMap
                            participantes={participantesFiltrados}
                            onSelect={(id) => navigate(`/visitacao/manutencao/${id}`)}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {participantesFiltrados.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>
                                    Nenhum participante encontrado para este filtro.
                                </div>
                            ) : (
                                participantesFiltrados.map((p: any) => {
                                    const status = getStatusInfo(p.status);
                                    const pessoa = p.participacoes?.pessoas;
                                    return (
                                        <div key={p.id} className="card card-hover" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', maxWidth: '100%' }}>
                                            {/* Indicador de status lateral (borda) */}
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: status.color }} />

                                            <div style={{ display: 'flex', gap: '1.25rem', flexDirection: 'column', paddingLeft: '0.5rem' }}>
                                                {/* Header do Card */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: 1 }}>
                                                        <div style={{
                                                            width: '48px', height: '48px', borderRadius: '50%', background: status.color + '20',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: status.color,
                                                            fontWeight: 700, fontSize: '1.2rem', flexShrink: 0
                                                        }}>
                                                            {pessoa?.nome_completo?.charAt(0) || <Users size={24} />}
                                                        </div>
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                            <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pessoa?.nome_completo}</h4>
                                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                                                                <span style={{
                                                                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem',
                                                                    background: status.color + '15', color: status.color,
                                                                    fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', border: `1px solid ${status.color}30`
                                                                }}>
                                                                    {status.icon} {status.label}
                                                                </span>
                                                                {p.taxa_paga ? (
                                                                    <span style={{
                                                                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem',
                                                                        background: '#10b98115', color: '#10b981',
                                                                        fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #10b98130'
                                                                    }}>
                                                                        <DollarSign size={12} /> Taxa Paga
                                                                    </span>
                                                                ) : (
                                                                    <span style={{
                                                                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem',
                                                                        background: '#ef444415', color: '#ef4444',
                                                                        fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #ef444430'
                                                                    }}>
                                                                        <DollarSign size={12} /> Pendente
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Ações Rápidas Topo */}
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleToggleTax(p.id, p.taxa_paga); }}
                                                            style={{
                                                                padding: '0.4rem 0.8rem', borderRadius: '8px',
                                                                background: p.taxa_paga ? '#10b98110' : 'transparent',
                                                                color: p.taxa_paga ? '#10b981' : 'var(--text-color)',
                                                                border: p.taxa_paga ? '1px solid #10b98130' : '1px solid var(--border-color)',
                                                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: '0.2s'
                                                            }}
                                                            title={p.taxa_paga ? "Remover pagamento" : "Marcar como pago"}
                                                        >
                                                            {p.taxa_paga ? <CheckCircle size={14} /> : <DollarSign size={14} />}
                                                            {p.taxa_paga ? 'Pago' : 'Marcar Pago'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Info Secundária (Endereço e Contatos) */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', padding: '0.75rem 1rem', background: 'var(--secondary-bg)', borderRadius: '8px', fontSize: '0.85rem', overflow: 'hidden' }}>
                                                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                                                        <a
                                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pessoa?.endereco}, ${pessoa?.numero}, ${pessoa?.bairro}, ${pessoa?.cidade}`)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '6px', color: 'var(--text-color)', textDecoration: 'none', transition: 'color 0.2s' }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="hover-primary"
                                                        >
                                                            <MapPin size={16} style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: '2px' }} />
                                                            <span style={{ lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                                                {pessoa?.endereco ? `${pessoa?.endereco}, ${pessoa?.numero}${pessoa?.complemento ? ` - ${pessoa.complemento}` : ''}` : 'Endereço não informado'}<br />
                                                                <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>
                                                                    {pessoa?.bairro}{pessoa?.cidade ? ` — ${pessoa.cidade}` : ''}{pessoa?.estado ? `/${pessoa.estado}` : ''}{pessoa?.cep ? ` • CEP: ${pessoa.cep}` : ''}
                                                                </span>
                                                            </span>
                                                        </a>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 200px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-color)' }}>
                                                            {pessoa?.telefone ? (
                                                                <a
                                                                    href={`https://wa.me/55${pessoa.telefone.replace(/\D/g, '')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                                    className="whatsapp-link"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <WhatsappLogo size={16} color="#25D366" weight="fill" />
                                                                    {formatPhone(pessoa.telefone)}
                                                                </a>
                                                            ) : (
                                                                <span style={{ fontWeight: 600 }}>Ñ inf.</span>
                                                            )}
                                                        </div>
                                                        {pessoa?.telefone_pai && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', opacity: 0.9 }}>
                                                                <a
                                                                    href={`https://wa.me/55${pessoa.telefone_pai.replace(/\D/g, '')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                                    className="whatsapp-link"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <WhatsappLogo size={14} color="#25D366" weight="fill" />
                                                                    Pai ({pessoa.nome_pai?.split(' ')[0]}): {formatPhone(pessoa.telefone_pai)}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {pessoa?.telefone_mae && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', opacity: 0.9 }}>
                                                                <a
                                                                    href={`https://wa.me/55${pessoa.telefone_mae.replace(/\D/g, '')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                                    className="whatsapp-link"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <WhatsappLogo size={14} color="#25D366" weight="fill" />
                                                                    Mãe ({pessoa.nome_mae?.split(' ')[0]}): {formatPhone(pessoa.telefone_mae)}
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Informações de Saúde */}
                                                {(pessoa?.restricao_alimentar || pessoa?.alergia || pessoa?.medicamento_continuo || pessoa?.observacoes_saude) && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem 1rem', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(245, 158, 11, 0.04) 100%)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.7, color: '#ef4444' }}>
                                                            <Heart size={12} />
                                                            Informações de Saúde
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                            {pessoa?.restricao_alimentar && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: '#f59e0b15', color: '#d97706', border: '1px solid #f59e0b25' }}>
                                                                    <UtensilsCrossed size={11} /> {pessoa.restricao_alimentar}
                                                                </span>
                                                            )}
                                                            {pessoa?.alergia && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: '#ef444415', color: '#dc2626', border: '1px solid #ef444425' }}>
                                                                    <AlertTriangle size={11} /> {pessoa.alergia}
                                                                </span>
                                                            )}
                                                            {pessoa?.medicamento_continuo && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: '#6366f115', color: '#4f46e5', border: '1px solid #6366f125' }}>
                                                                    <Pill size={11} /> {pessoa.medicamento_continuo}
                                                                </span>
                                                            )}
                                                            {pessoa?.observacoes_saude && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: '#10b98115', color: '#059669', border: '1px solid #10b98125' }}>
                                                                    <Heart size={11} /> {pessoa.observacoes_saude}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Rodapé do Card / Ação Principal */}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                                                    <button
                                                        onClick={() => navigate(`/visitacao/manutencao/${p.id}`)}
                                                        className="btn-primary visita-detail-btn"
                                                        style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', borderRadius: '8px' }}
                                                    >
                                                        <Edit3 size={16} /> <span>Detalhes da Visita</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </>
            )}

            <style>{`
                    .hover-primary:hover {
                        color: var(--primary-color) !important;
                    }
                    .whatsapp-link {
                        transition: all 0.2s ease;
                    }
                    .whatsapp-link:hover {
                        color: #25D366 !important;
                        transform: translateX(4px);
                    }
                `}</style>
        </>
    );
}

