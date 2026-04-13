import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import type { VisitaParticipacaoEnriched, VisitaStatus } from '../../types/visitacao';
import { Header } from '../../components/Header';
import { PageHeader } from '../../components/ui/PageHeader';

export function VisitacaoMeusParticipantesPage() {
    const { userParticipacao } = useAuth();
    const navigate = useNavigate();
    const [participantes, setParticipantes] = useState<VisitaParticipacaoEnriched[]>([]);
    const [loading, setLoading] = useState(true);
    const [grupoNome, setGrupoNome] = useState('');

    useEffect(() => {
        async function loadMyParticipants() {
            if (!userParticipacao) {
                setLoading(false);
                return;
            }

            try {
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
                    setGrupoNome((grupoData as any)?.nome || 'Minha Dupla');
                    
                    const { data, error } = await supabase
                        .from('visita_participacao')
                        .select(`
                            *,
                            participacoes:participacao_id (
                                id,
                                pessoas (nome_completo, cpf, endereco, bairro)
                            )
                        `)
                        .eq('grupo_id', myVinculo.grupo_id)
                        .eq('visitante', false);

                    if (error) throw error;
                    setParticipantes(data || []);
                }
            } catch (error) {
                console.error('Erro ao buscar participantes da visita:', error);
            } finally {
                setLoading(false);
            }
        }

        loadMyParticipants();
    }, [userParticipacao]);

    const stats = useMemo(() => {
        const total = participantes.length;
        const realizadas = participantes.filter(p => p.status === 'realizada').length;
        const pendentesPagamento = participantes.filter(p => !p.taxa_paga).length;
        return { total, realizadas, pendentesPagamento };
    }, [participantes]);

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
            <div className="app-shell">
                <Header />
                <div className="container" style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <Loader className="animate-spin" size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className="app-shell">
            <Header />
            <main className="container main-content" style={{ paddingBottom: '4rem' }}>
                <PageHeader 
                    title={grupoNome || 'Meus Encontristas'}
                    subtitle="Início / Visitação"
                    backPath="/visitacao"
                />

                {userParticipacao && participantes.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: '2.5rem' }}>
                        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
                            <div style={{ background: 'var(--primary-color)15', color: 'var(--primary-color)', padding: '0.75rem', borderRadius: '10px' }}>
                                <Users size={20} />
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Encontristas</p>
                                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{stats.total}</h2>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #10b981' }}>
                            <div style={{ background: '#10b98115', color: '#10b981', padding: '0.75rem', borderRadius: '10px' }}>
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visitas Realizadas</p>
                                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{stats.realizadas}</h2>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ background: '#ef444415', color: '#ef4444', padding: '0.75rem', borderRadius: '10px' }}>
                                <DollarSign size={20} />
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendentes de Taxa</p>
                                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{stats.pendentesPagamento}</h2>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {participantes.map((p) => {
                            const status = getStatusInfo(p.status);
                            const pessoa = (p.participacoes as any)?.pessoas;
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
                                        
                                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MapPin size={14} /> {pessoa?.bairro || 'Bairro ñ inf.'}
                                            </span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => navigate(`/visitacao/manutencao/${p.id}`)}
                                        className="btn-primary"
                                        style={{ padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                    >
                                        <Edit3 size={16} /> Registrar Visita
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

