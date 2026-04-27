import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { equipeService } from '../../services/equipeService';
import { encontroService } from '../../services/encontroService';
import { useEncontros } from '../../contexts/EncontroContext';
import type { Encontro } from '../../types/encontro';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Users,
  Calendar,
  Search,
  Mail,
  MailWarning,
  Eye,
  X,
  Loader,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';

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

type EquipeResumo = Awaited<ReturnType<typeof equipeService.listarResumoConfirmacoes>>[number];

export function ConfirmationReportPage() {
  const navigate = useNavigate();
  const { encontros, encontroAtivo } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [equipesResumo, setEquipesResumo] = useState<EquipeResumo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [activeFilter, setActiveFilter] = useState<'all' | 'confirmed' | 'pending'>('all');

  // Seleciona o encontro ativo automaticamente via contexto
  useEffect(() => {
    if (!selectedEncontroId && encontroAtivo) {
      setSelectedEncontroId(encontroAtivo.id);
    } else if (!selectedEncontroId && encontros.length > 0) {
      setSelectedEncontroId(encontros[0].id);
    }
  }, [encontros, encontroAtivo, selectedEncontroId]);

  // Carrega resumo leve ao trocar de encontro
  useEffect(() => {
    if (!selectedEncontroId) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const resumo = await equipeService.listarResumoConfirmacoes(selectedEncontroId);
        setEquipesResumo(resumo);
      } catch {
        toast.error('Erro ao carregar resumo de confirmações.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedEncontroId]);

  const stats = useMemo(() => {
    const total = equipesResumo.length;
    const confirmed = equipesResumo.filter(s => s.confirmado).length;
    return {
      total,
      confirmed,
      pending: total - confirmed,
      percent: total > 0 ? Math.round((confirmed / total) * 100) : 0
    };
  }, [equipesResumo]);

  const displayedTeams = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    return equipesResumo
      .filter(s => {
        if (activeFilter === 'confirmed') return s.confirmado;
        if (activeFilter === 'pending') return !s.confirmado;
        return true;
      })
      .filter(s => {
        if (!term) return true;
        const matchEquipe = s.equipe_nome.toLowerCase().includes(term);
        const matchCoord = s.coordenadores.some(c => {
          const matchName = c.nome.toLowerCase().includes(term);
          const matchEmail = c.email?.toLowerCase().includes(term);
          return matchName || matchEmail;
        });
        return matchEquipe || matchCoord;
      })
      .sort((a, b) => a.equipe_nome.localeCompare(b.equipe_nome));
  }, [equipesResumo, activeFilter, debouncedSearch]);

  const handleVisualizarEquipe = (equipeId: string) => {
    navigate(`/secretaria/confirmacoes/${equipeId}`, {
      state: { encontroId: selectedEncontroId }
    });
  };

  const handleRefreshCard = async (equipeId: string) => {
    if (!selectedEncontroId || refreshingId) return;
    setRefreshingId(equipeId);
    try {
      const resumo = await equipeService.listarResumoConfirmacoes(selectedEncontroId);
      setEquipesResumo(resumo);
    } catch {
      toast.error('Erro ao atualizar dados.');
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <>
      <div className="fade-in">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => navigate('/secretaria')} className="icon-btn">
              <ChevronLeft size={18} />
            </button>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Secretaria</p>
              <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Confirmação de Dados por Equipe</h1>
            </div>
          </div>
        </div>

        {/* Filtros */}
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
              <div className="form-input-wrapper">
                <div className="form-input-icon">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  className="form-input form-input--with-icon"
                  placeholder="Nome da equipe ou coordenador..."
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
          </div>
        </div>

        {/* Dashboard Stats */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div
            className={`card ${activeFilter === 'all' ? 'active-filter' : ''}`}
            onClick={() => setActiveFilter('all')}
            style={{
              flex: '1 1 180px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
              cursor: 'pointer', border: activeFilter === 'all' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
              position: 'relative', transition: 'all 0.2s ease',
              transform: activeFilter === 'all' ? 'translateY(-2px)' : 'none',
              boxShadow: activeFilter === 'all' ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none'
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(71, 124, 239, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
              <Users size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.total}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', marginTop: '0.25rem' }}>Total Equipes</div>
            </div>
            <div style={{ color: 'var(--primary-color)', position: 'absolute', bottom: '8px', right: '12px', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <span>Filtrar</span> <ChevronRight size={10} />
            </div>
          </div>

          <div
            className={`card ${activeFilter === 'confirmed' ? 'active-filter' : ''}`}
            onClick={() => setActiveFilter('confirmed')}
            style={{
              flex: '1 1 180px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
              cursor: 'pointer', border: activeFilter === 'confirmed' ? '2px solid #10b981' : '1px solid var(--border-color)',
              position: 'relative', transition: 'all 0.2s ease',
              transform: activeFilter === 'confirmed' ? 'translateY(-2px)' : 'none',
              boxShadow: activeFilter === 'confirmed' ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none'
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <CheckCircle size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.confirmed}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', marginTop: '0.25rem' }}>Confirmadas</div>
            </div>
            <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontSize: '0.6rem', fontWeight: 800, color: '#10b981', opacity: 0.6, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <span>Filtrar</span> <ChevronRight size={10} />
            </div>
          </div>

          <div
            className={`card ${activeFilter === 'pending' ? 'active-filter' : ''}`}
            onClick={() => setActiveFilter('pending')}
            style={{
              flex: '1 1 180px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
              cursor: 'pointer', border: activeFilter === 'pending' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
              position: 'relative', transition: 'all 0.2s ease',
              transform: activeFilter === 'pending' ? 'translateY(-2px)' : 'none',
              boxShadow: activeFilter === 'pending' ? '0 4px 12px rgba(245, 158, 11, 0.15)' : 'none'
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <AlertCircle size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.pending}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', marginTop: '0.25rem' }}>Pendentes</div>
            </div>
            <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontSize: '0.6rem', fontWeight: 800, color: '#f59e0b', opacity: 0.6, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <span>Filtrar</span> <ChevronRight size={10} />
            </div>
          </div>

          <div className="card" style={{ flex: '1 1 180px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.85, position: 'relative' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)' }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleRefreshCard('__stats__'); }}
                disabled={!!refreshingId}
                title="Atualizar dados"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  cursor: refreshingId ? 'not-allowed' : 'pointer',
                  color: 'var(--text-color)',
                  opacity: refreshingId ? 0.6 : 1,
                  transition: 'opacity 0.2s, background 0.2s',
                  padding: 0,
                }}
                onMouseEnter={e => { if (!refreshingId) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--secondary-bg)'; } }}
                onMouseLeave={e => { e.currentTarget.style.opacity = refreshingId ? '0.4' : '0.55'; e.currentTarget.style.background = 'transparent'; }}
              >
                <RefreshCw
                  size={16}
                  style={{ animation: refreshingId === '__stats__' ? 'spin 0.8s linear infinite' : 'none' }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Cards de Equipes */}
        {isLoading ? (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '2.5rem', opacity: 0.6 }}>
            <Loader className="animate-spin" size={20} />
            <span>Carregando equipes...</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
            gap: '1rem'
          }}>
            {displayedTeams.length === 0 && (
              <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
                <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>Nenhuma equipe encontrada.</p>
              </div>
            )}
            {displayedTeams.map(status => (
              <div
                key={status.equipe_id}
                className="card animate-fade-in"
                style={{
                  padding: '1.25rem',
                  borderLeft: `4px solid ${status.confirmado ? '#10b981' : '#f59e0b'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6, flexShrink: 0
                    }}>
                      <Users size={20} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status.equipe_nome}</h3>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{status.membros_confirmados} de {status.total_membros} confirmados</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
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

                    <button
                      onClick={() => handleVisualizarEquipe(status.equipe_id)}
                      className="btn-primary"
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        borderRadius: '8px'
                      }}
                    >
                      <Eye size={14} />
                      <span className="hide-mobile">Visualizar</span>
                    </button>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div style={{ marginTop: '-0.25rem' }}>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
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

                {/* Info de finalização */}
                {status.confirmado && (
                  <div style={{
                    padding: '0.75rem', borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    fontSize: '0.85rem', border: '1px solid rgba(16, 185, 129, 0.1)'
                  }}>
                    <div style={{ fontWeight: 600, color: '#065f46', marginBottom: '0.25rem' }}>Equipe Finalizada:</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8, flexWrap: 'wrap', gap: '0.25rem' }}>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={status.confirmado_por_nome}>
                          {status.confirmado_por_nome || status.confirmado_por_email || '—'}
                        </div>
                        {status.confirmado_por_email && status.confirmado_por_nome && (
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{status.confirmado_por_email}</div>
                        )}
                      </div>
                      <span style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatDate(status.confirmado_em)}</span>
                    </div>
                  </div>
                )}

                {/* Coordenadores */}
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
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            fontSize: '0.85rem',
                            padding: '0.45rem 0.75rem', borderRadius: '8px',
                            backgroundColor: coord.email ? 'var(--success-bg)' : 'rgba(245, 158, 11, 0.1)',
                            border: `1px solid ${coord.email ? 'var(--success-border)' : 'var(--accent-color)'}`,
                            color: coord.email ? 'var(--success-text)' : 'var(--accent-color)',
                            fontWeight: 600
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden', minWidth: 0 }}>
                              {coord.email ? <Mail size={14} style={{ opacity: 0.8, flexShrink: 0 }} /> : <MailWarning size={14} style={{ opacity: 0.8, flexShrink: 0 }} />}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{coord.nome}</span>
                            </div>
                            {coord.confirmou && (
                              <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                            )}
                          </div>
                        ))}
                        {status.coordenadores.length > 2 && (
                          <div style={{ fontSize: '0.75rem', padding: '0 0.5rem', opacity: 0.5 }}>+ {status.coordenadores.length - 2} mais...</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
