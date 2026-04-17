import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { encontroService } from '../../services/encontroService';
import { inscricaoService } from '../../services/inscricaoService';
import { equipeService } from '../../services/equipeService';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import { ChevronLeft, CheckCircle, AlertCircle, Users, Calendar, Search, Mail, MailWarning } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';

function formatDate(date: string | null | undefined) {
  if (!date) return '—';
  try {
    const d = new Date(date);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return date;
  }
}

interface TeamConfirmationStatus {
  equipe_id: string;
  equipe_nome: string;
  confirmado: boolean;
  membros_confirmados: number;
  total_membros: number;
  progresso: number;
  confirmado_por?: string;
  confirmado_em?: string;
  coordenadores: {
    nome: string;
    email: string | null;
    confirmou: boolean;
    data_confirmacao: string | null;
  }[];
}

export function ConfirmationReportPage() {
  const navigate = useNavigate();
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [participacoes, setParticipacoes] = useState<InscricaoEnriched[]>([]);
  const [equipeConfirmacoes, setEquipeConfirmacoes] = useState<{ equipe_id: string; confirmado_por: string; confirmado_em: string; profiles?: { email?: string } | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalData, setModalData] = useState<{ title: string; coordinators: TeamConfirmationStatus['coordenadores'] } | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [encontrosData, equipesData] = await Promise.all([
          encontroService.listar(),
          equipeService.listar()
        ]);
        setEncontros(encontrosData);
        setEquipes(equipesData);

        const active = encontrosData.find(e => e.ativo);
        if (active) setSelectedEncontroId(active.id);
        else if (encontrosData.length > 0) setSelectedEncontroId(encontrosData[0].id);
      } catch {
        toast.error('Erro ao carregar dados iniciais.');
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedEncontroId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [data, confs] = await Promise.all([
          inscricaoService.listarPorEncontro(selectedEncontroId),
          equipeService.listarConfirmacoes(selectedEncontroId)
        ]);
        setParticipacoes(data);
        setEquipeConfirmacoes(confs);
      } catch {
        toast.error('Erro ao carregar participações.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [selectedEncontroId]);

  const teamStatuses = useMemo(() => {
    const statuses: TeamConfirmationStatus[] = equipes.map(eq => {
      const teamParticipacoes = participacoes.filter(p => p.equipe_id === eq.id);
      const membersConfirmed = teamParticipacoes.filter(p => p.dados_confirmados).length;
      const totalMembers = teamParticipacoes.length;
      const progresso = totalMembers > 0 ? (membersConfirmed / totalMembers) * 100 : 0;

      const coordinators = teamParticipacoes.filter(p => p.coordenador);
      const teamConf = equipeConfirmacoes.find(c => c.equipe_id === eq.id);

      return {
        equipe_id: eq.id,
        equipe_nome: eq.nome || 'Sem nome',
        confirmado: !!teamConf,
        membros_confirmados: membersConfirmed,
        total_membros: totalMembers,
        progresso,
        confirmado_por: teamConf?.profiles?.email || 'Coordenador',
        confirmado_em: teamConf?.confirmado_em || undefined,
        coordenadores: coordinators.map(c => ({
          nome: c.pessoas?.nome_completo || 'Sem nome',
          email: c.pessoas?.email || null,
          confirmou: !!c.dados_confirmados,
          data_confirmacao: c.confirmado_em
        }))
      };
    });

    return statuses
      .filter(s => {
        const term = searchTerm.toLowerCase();
        const matchEquipe = s.equipe_nome.toLowerCase().includes(term);
        const matchCoord = s.coordenadores.some(c => c.nome.toLowerCase().includes(term));
        return matchEquipe || matchCoord;
      })
      .sort((a, b) => a.equipe_nome.localeCompare(b.equipe_nome));
  }, [equipes, participacoes, searchTerm, equipeConfirmacoes]);

  const stats = useMemo(() => {
    const total = teamStatuses.length;
    const confirmed = teamStatuses.filter(s => s.confirmado).length;
    return {
      total,
      confirmed,
      pending: total - confirmed,
      percent: total > 0 ? Math.round((confirmed / total) * 100) : 0
    };
  }, [teamStatuses]);

  return (
    <>
        <div className="fade-in">
          <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/secretaria')} className="icon-btn">
                <ChevronLeft size={18} />
              </button>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Relatórios</p>
                <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Confirmação de Dados por Equipe</h1>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Encontro</label>
                <LiveSearchSelect<Encontro>
                  value={selectedEncontroId}
                  onChange={(val) => setSelectedEncontroId(val)}
                  fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                  getOptionLabel={(e) => `${e.nome}${e.tema ? ` (${e.tema})` : ''} ${e.ativo ? '(Ativo)' : ''}`}
                  getOptionValue={(e) => String(e.id)}
                  placeholder="Selecione um Encontro..."
                  initialOptions={encontros}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                <label className="form-label">Buscar Equipe</label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nome da equipe..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div className="card" style={{ flex: '1 1 200px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: stats.percent === 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: stats.percent === 100 ? '#10b981' : 'var(--primary-color)',
              }}>
                <Calendar size={24} />
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.percent}%</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', marginTop: '0.25rem' }}>Progresso Total</div>
              </div>
            </div>

            <div className="card" style={{ flex: '1 1 200px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
              }}>
                <CheckCircle size={24} />
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.confirmed}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', marginTop: '0.25rem' }}>Confirmadas</div>
              </div>
            </div>

            <div className="card" style={{ flex: '1 1 200px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b',
              }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.pending}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', marginTop: '0.25rem' }}>Pendentes</div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="card text-center py-8">
              <p>Carregando dados de confirmação...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
              {teamStatuses.map(status => (
                <div key={status.equipe_id} className="card" style={{
                  padding: '1.25rem',
                  borderLeft: `4px solid ${status.confirmado ? '#10b981' : '#f59e0b'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '8px',
                        backgroundColor: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6
                      }}>
                        <Users size={20} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{status.equipe_nome}</h3>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{status.membros_confirmados} de {status.total_membros} confirmados</div>
                      </div>
                    </div>
                    {status.confirmado ? (
                      <span style={{
                        padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)'
                      }}>✓ FINALIZADA</span>
                    ) : (
                      <span style={{
                        padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                        backgroundColor: status.progresso > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0,0,0,0.05)', 
                        color: status.progresso > 0 ? '#f59e0b' : '#666',
                        border: `1px solid ${status.progresso > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0,0,0,0.1)'}`
                      }}>{status.progresso === 0 ? 'AGUARDANDO' : 'EM ANDAMENTO'}</span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: '-0.25rem' }}>
                    <div style={{ 
                      width: '100%', 
                      height: '6px', 
                      backgroundColor: 'rgba(0,0,0,0.05)', 
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${status.progresso}%`, 
                        height: '100%', 
                        backgroundColor: status.confirmado ? '#10b981' : (status.progresso > 80 ? '#f59e0b' : '#3b82f6'),
                        transition: 'width 0.4s ease-out'
                      }} />
                    </div>
                    {status.progresso > 0 && !status.confirmado && (
                      <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700, marginTop: '0.3rem', textAlign: 'right' }}>
                        {Math.round(status.progresso)}% completo
                      </div>
                    )}
                  </div>

                  {status.confirmado && (
                    <div style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(16, 185, 129, 0.05)',
                      fontSize: '0.85rem',
                      border: '1px solid rgba(16, 185, 129, 0.1)'
                    }}>
                      <div style={{ fontWeight: 600, color: '#065f46', marginBottom: '0.25rem' }}>Equipe Finalizada:</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
                        <span>{status.confirmado_por}</span>
                        <span>{formatDate(status.confirmado_em)}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                      Coordenadores
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {status.coordenadores.length === 0 ? (
                        <div style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>Nenhum coordenador vinculado</div>
                      ) : (
                        <>
                          {status.coordenadores.slice(0, 2).map((coord, i) => (
                            <div key={i} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.85rem',
                              opacity: coord.confirmou ? 1 : 0.9,
                              padding: '0.45rem 0.75rem',
                              borderRadius: '8px',
                              backgroundColor: coord.email ? 'var(--success-bg)' : 'rgba(245, 158, 11, 0.1)',
                              border: `1px solid ${coord.email ? 'var(--success-border)' : 'var(--accent-color)'}`,
                              color: coord.email ? 'var(--success-text)' : 'var(--accent-color)',
                              fontWeight: 600
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                                {coord.email ? <Mail size={14} style={{ opacity: 0.8, flexShrink: 0 }} /> : <MailWarning size={14} style={{ opacity: 0.8, flexShrink: 0 }} />}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{coord.nome}</span>
                              </div>
                              {coord.confirmou && (
                                <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                              )}
                            </div>
                          ))}

                          {status.coordenadores.length > 2 && (
                            <button
                              onClick={() => setModalData({ title: `Coordenadores: ${status.equipe_nome}`, coordinators: status.coordenadores })}
                              className="btn-text"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                textAlign: 'left',
                                color: 'var(--primary-color)',
                                fontWeight: 600,
                                marginTop: '0.2rem'
                              }}
                            >
                              + {status.coordenadores.length - 2} coordenador(es)...
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Modal
            isOpen={!!modalData}
            onClose={() => setModalData(null)}
            title={modalData?.title || ''}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {modalData?.coordinators.map((coord, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: coord.email ? 'var(--success-bg)' : 'rgba(245, 158, 11, 0.08)',
                  border: `1px solid ${coord.email ? 'var(--success-border)' : 'var(--accent-color)'}`,
                  color: 'var(--text-color)',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      backgroundColor: coord.email ? 'var(--success-bg)' : 'rgba(245, 158, 11, 0.15)',
                      color: coord.email ? 'var(--success-text)' : 'var(--accent-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${coord.email ? 'var(--success-border)' : 'var(--accent-color)'}`
                    }}>
                      {coord.email ? <Mail size={18} /> : <MailWarning size={18} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-color)' }}>{coord.nome}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.6, color: 'var(--text-color)' }}>{coord.email || 'Sem e-mail cadastrado'}</div>
                    </div>
                  </div>
                  {coord.confirmou && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.75rem', fontWeight: 800 }}>
                      <CheckCircle size={16} />
                      CONFIRMOU
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Modal>
        </div>
    </>
  );
}
