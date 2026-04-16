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
    Phone,
    Loader,
    LayoutGrid,
    Map as MapIcon
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { visitacaoService } from '../../services/visitacaoService';
import type { VisitaParticipacaoEnriched, VisitaStatus, VisitaGrupo } from '../../types/visitacao';
import { toast } from 'react-hot-toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { MyParticipantsMap } from '../../components/visitacao/MyParticipantsMap';

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

    useEffect(() => {
        sessionStorage.setItem('visita_view_mode', viewMode);
    }, [viewMode]);

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
                    const { data, error } = await supabase
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

                    if (error) throw error;
                    setParticipantes((data as unknown as VisitaParticipacaoEnriched[]) || []);
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
        const total = participantes.length;
        const realizadas = participantes.filter(p => p.status === 'realizada').length;
        const pendentesPagamento = participantes.filter(p => !p.taxa_paga).length;
        return { total, realizadas, pendentesPagamento };
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
                    <div className="visita-dashboard-grid" style={{ marginBottom: '2.5rem' }}>
                        <div className="visita-dashboard-card visita-card-indigo">
                            <div className="visita-card-icon-container">
                                <Users size={20} />
                            </div>
                            <div className="visita-card-content">
                                <p className="visita-card-label">Total</p>
                                <h2 className="visita-card-value">{stats.total}</h2>
                            </div>
                        </div>
                        <div className="visita-dashboard-card visita-card-emerald">
                            <div className="visita-card-icon-container">
                                <TrendingUp size={20} />
                            </div>
                            <div className="visita-card-content">
                                <p className="visita-card-label">Visitas</p>
                                <h2 className="visita-card-value">{stats.realizadas}</h2>
                            </div>
                        </div>
                        <div className="visita-dashboard-card visita-card-rose" style={{
                            background: stats.pendentesPagamento > 0 ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                        }}>
                            <div className="visita-card-icon-container">
                                <DollarSign size={20} />
                            </div>
                            <div className="visita-card-content">
                                <p className="visita-card-label">Taxas</p>
                                <h2 className="visita-card-value">{stats.pendentesPagamento}</h2>
                            </div>
                        </div>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--card-bg)', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
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

                            <div style={{ fontSize: '0.85rem', opacity: 0.6, fontWeight: 600 }}>
                                {participantes.length} Encontristas
                            </div>
                        </div>

                        {viewMode === 'map' ? (
                            <MyParticipantsMap 
                                participantes={participantes} 
                                onSelect={(id) => navigate(`/visitacao/manutencao/${id}`)}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {participantes.map((p) => {
                            const status = getStatusInfo(p.status);
                            const pessoa = p.participacoes?.pessoas;
                            return (
                                <div key={p.id} className="card card-hover" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', transition: 'transform 0.2s' }}>
                                    <div style={{
                                        width: '60px', height: '60px', borderRadius: '12px', background: 'var(--secondary-bg)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <Users size={28} />
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{pessoa?.nome_completo}</h4>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem',
                                                    background: status.color + '20', color: status.color,
                                                    fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px'
                                                }}>
                                                    {status.icon} {status.label}
                                                </span>
                                                {p.taxa_paga ? (
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem',
                                                        background: '#10b98120', color: '#10b981',
                                                        fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px'
                                                    }}>
                                                        <DollarSign size={12} /> Pago
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem',
                                                        background: '#ef444420', color: '#ef4444',
                                                        fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px'
                                                    }}>
                                                        <DollarSign size={12} /> Pendente
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                            {/* Endereço com link para o Maps */}
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pessoa?.endereco}, ${pessoa?.numero}, ${pessoa?.bairro}, ${pessoa?.cidade}`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MapPin size={14} />
                                                {pessoa?.endereco ? `${pessoa?.endereco}, ${pessoa?.numero} - ${pessoa?.bairro}` : 'Endereço não informado'}
                                            </a>

                                            {/* Telefones */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', opacity: 0.8 }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Phone size={14} /> {pessoa?.telefone || 'Ñ inf.'}
                                                </span>
                                                {pessoa?.telefone_pai && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Phone size={14} /> <strong>Pai ({pessoa.nome_pai?.split(' ')[0]}):</strong> {pessoa.telefone_pai}
                                                    </span>
                                                )}
                                                {pessoa?.telefone_mae && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Phone size={14} /> <strong>Mãe ({pessoa.nome_mae?.split(' ')[0]}):</strong> {pessoa.telefone_mae}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="visita-item-actions">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleTax(p.id, p.taxa_paga); }}
                                            style={{
                                                padding: '0.6rem 1rem', borderRadius: '12px',
                                                background: p.taxa_paga ? '#10b981' : 'rgba(0,0,0,0.05)',
                                                color: p.taxa_paga ? 'white' : 'inherit',
                                                border: p.taxa_paga ? 'none' : '2px dashed var(--border-color)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                                transition: 'all 0.2s ease', cursor: 'pointer',
                                                fontSize: '0.85rem', fontWeight: 700
                                            }}
                                        >
                                            <DollarSign size={18} />
                                            {p.taxa_paga ? 'PAGO' : 'MARCAR PAGO'}
                                        </button>

                                        <button
                                            onClick={() => navigate(`/visitacao/manutencao/${p.id}`)}
                                            className="btn-primary"
                                            style={{ padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                        >
                                            <Edit3 size={16} /> Detalhes / Visita
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        )}
        </>
    );
}

