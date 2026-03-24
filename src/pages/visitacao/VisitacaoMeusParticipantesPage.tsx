import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import type { VisitaParticipacaoEnriched } from '../../types/visitacao';
import { Users, Loader, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
                // 1. Find the group this visitor belongs to
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
                    
                    // 2. Fetch all participants in this group (visitante: false)
                    const { data, error } = await supabase
                        .from('visita_participacao')
                        .select(`
                            *,
                            participacoes:participacao_id (
                                id,
                                pessoas (nome_completo, cpf)
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

    if (loading) {
        return (
            <div className="container" style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader className="animate-spin" size={32} />
            </div>
        );
    }

    return (
        <div className="container" style={{ paddingBottom: '4rem' }}>
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => navigate('/dashboard')} className="icon-btn"><ChevronLeft size={20} /></button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{grupoNome || 'Meus Participantes'}</h1>
                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>Lista de encontristas vinculados à sua visita</p>
                    </div>
                </div>
            </div>

            {!userParticipacao ? (
                <div className="card empty-state">
                    <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>Você não possui uma participação ativa neste encontro.</p>
                </div>
            ) : participantes.length === 0 ? (
                <div className="card empty-state">
                    <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>Nenhum participante vinculado à sua dupla no momento.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <div className="pessoa-list">
                        {participantes.map((p) => (
                            <div key={p.id} className="pessoa-row" style={{ borderBottom: '1px solid var(--border-color)', borderRadius: 0, padding: '1.25rem 1.5rem' }}>
                                <div className="pessoa-row-main" style={{ flex: 1 }}>
                                    <div className="pessoa-avatar" style={{ background: 'var(--primary-color)', color: 'white' }}>
                                        <Users size={20} />
                                    </div>
                                    <div className="pessoa-row-info">
                                        <h4 className="pessoa-row-name" style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                                            {(p.participacoes as any)?.pessoas?.nome_completo}
                                        </h4>
                                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', opacity: 0.7 }}>
                                            <span>CPF: {(p.participacoes as any)?.pessoas?.cpf || 'Não informado'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
