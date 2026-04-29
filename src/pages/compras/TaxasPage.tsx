import { CheckCircle, ChevronLeft, Loader, Search, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useEncontros } from '../../contexts/EncontroContext';
import { useLoading } from '../../contexts/LoadingContext';
import { useDebounce } from '../../hooks/useDebounce';
import { comprasService, type TaxaReport } from '../../services/comprasService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import type { Equipe } from '../../types/equipe';
import type { InscricaoEnriched } from '../../types/inscricao';
import { encontroService } from '../../services/encontroService';

export function TaxasPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const { setIsLoading: setGlobalLoading } = useLoading();

  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [relatorioTaxas, setRelatorioTaxas] = useState<TaxaReport[]>([]);

  const [selectedEquipeId, setSelectedEquipeId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'encontristas' | 'equipes'>('encontristas');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (encontros.length > 0 && !selectedEncontroId) {
      const active = encontros.find(e => e.ativo);
      setSelectedEncontroId(active?.id ?? encontros[0].id);
    }
  }, [encontros, selectedEncontroId]);

  const loadData = useCallback(async () => {
    if (!selectedEncontroId) return;
    setLoading(true);
    setGlobalLoading(true);
    try {
      const [partsData, eqData, relData] = await Promise.all([
        inscricaoService.listarResumoPorEncontro(selectedEncontroId),
        equipeService.listar(),
        comprasService.listarRelatorioTaxas(selectedEncontroId)
      ]);
      setParticipantes(partsData);
      setEquipes(eqData);
      setRelatorioTaxas(relData);
    } catch {
      toast.error('Erro ao carregar dados de taxas.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  }, [selectedEncontroId, setGlobalLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cálculos consolidados
  const statsGeral = useMemo(() => {
    const total = participantes.length;
    const pagos = participantes.filter(p => p.pago_taxa).length;

    const encontristas = participantes.filter(p => p.participante);
    const totalEnc = encontristas.length;
    const pagosEnc = encontristas.filter(p => p.pago_taxa).length;

    const trabalhadores = participantes.filter(p => !p.participante);
    const totalTrab = trabalhadores.length;
    const pagosTrab = trabalhadores.filter(p => p.pago_taxa).length;

    return { total, pagos, totalEnc, pagosEnc, totalTrab, pagosTrab };
  }, [participantes]);

  const filteredParticipantes = useMemo(() => {
    return participantes.filter(p => {
      // Filtro por Aba
      const matchTab = activeTab === 'encontristas' ? p.participante : !p.participante;
      if (!matchTab) return false;

      // Filtro por Equipe (apenas na aba de equipes)
      const matchEquipe = activeTab === 'encontristas' || selectedEquipeId === 'all' || p.equipe_id === selectedEquipeId;

      const matchSearch = (p.pessoas?.nome_completo || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchEquipe && matchSearch;
    }).sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));
  }, [participantes, activeTab, selectedEquipeId, debouncedSearch]);

  const handleTogglePagamento = async (id: string, currentStatus: boolean) => {
    setUpdatingId(id);
    try {
      await inscricaoService.alterarStatusPagamento(id, !currentStatus);
      setParticipantes(prev => prev.map(p => p.id === id ? { ...p, pago_taxa: !currentStatus } : p));

      // Update summary report locally to avoid full reload
      setRelatorioTaxas(prev => prev.map(r => {
        const p = participantes.find(part => part.id === id);
        if (p && r.equipe_id === p.equipe_id) {
          return {
            ...r,
            pagos: !currentStatus ? r.pagos + 1 : r.pagos - 1,
            pendentes: !currentStatus ? r.pendentes - 1 : r.pendentes + 1
          };
        }
        return r;
      }));

      toast.success('Status de pagamento atualizado!');
    } catch {
      toast.error('Erro ao atualizar pagamento.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Pagamento de Taxas</h1>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
          <LiveSearchSelect
            value={selectedEncontroId}
            onChange={val => setSelectedEncontroId(val)}
            fetchData={async (s, p) => await encontroService.buscarComPaginacao(s, p)}
            getOptionLabel={e => e.nome}
            getOptionValue={e => e.id}
            initialOptions={encontros}
          />
        </div>
      </div>

      {/* Resumo Geral Consolidado */}
      <section className="grid-container" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div className="card" style={{ padding: '1.25rem 1rem', borderLeft: '4px solid var(--primary-color)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.5, textTransform: 'uppercase' }}>Geral (Total)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{statsGeral.pagos}</span>
            <span style={{ opacity: 0.4, fontSize: '0.9rem' }}>/ {statsGeral.total}</span>
          </div>
          <div className="progress-bar" style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(statsGeral.pagos / (statsGeral.total || 1)) * 100}%`,
                background: 'var(--primary-color)',
                transition: 'width 0.3s'
              }}
            />
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem 1rem', borderLeft: '4px solid var(--accent-color)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.5, textTransform: 'uppercase' }}>Encontristas</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-color)' }}>{statsGeral.pagosEnc}</span>
            <span style={{ opacity: 0.4, fontSize: '0.9rem' }}>/ {statsGeral.totalEnc}</span>
          </div>
          <div className="progress-bar" style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(statsGeral.pagosEnc / (statsGeral.totalEnc || 1)) * 100}%`,
                background: 'var(--accent-color)',
                transition: 'width 0.3s'
              }}
            />
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem 1rem', borderLeft: '4px solid var(--success-color)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.5, textTransform: 'uppercase' }}>Equipes</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-color)' }}>{statsGeral.pagosTrab}</span>
            <span style={{ opacity: 0.4, fontSize: '0.9rem' }}>/ {statsGeral.totalTrab}</span>
          </div>
          <div className="progress-bar" style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(statsGeral.pagosTrab / (statsGeral.totalTrab || 1)) * 100}%`,
                background: 'var(--success-color)',
                transition: 'width 0.3s'
              }}
            />
          </div>
        </div>
      </section>

      {/* Abas de Navegação */}
      <div className="tabs-container" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'encontristas' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px', padding: '0.5rem 1.5rem' }}
          onClick={() => { setActiveTab('encontristas'); setSelectedEquipeId('all'); }}
        >
          Encontristas
        </button>
        <button
          className={`btn ${activeTab === 'equipes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px', padding: '0.5rem 1.5rem' }}
          onClick={() => setActiveTab('equipes')}
        >
          Equipes
        </button>
      </div>

      {/* Conteúdo Dependente da Aba: Resumo de Equipes */}
      {activeTab === 'equipes' && (
        <section className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div
            className={`card card--clickable ${selectedEquipeId === 'all' ? 'active-filter' : ''}`}
            style={{
              padding: '0.75rem 1rem',
              borderLeft: '4px solid var(--primary-color)',
              cursor: 'pointer',
              backgroundColor: selectedEquipeId === 'all' ? 'rgba(37, 99, 235, 0.05)' : 'var(--card-bg)'
            }}
            onClick={() => setSelectedEquipeId('all')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Todas Equipes</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{statsGeral.pagosTrab}/{statsGeral.totalTrab}</span>
            </div>
          </div>
          {relatorioTaxas.filter(r => r.total_membros > 0).map(r => (
            <div
              key={r.equipe_id}
              className={`card card--clickable ${selectedEquipeId === r.equipe_id ? 'active-filter' : ''}`}
              style={{
                padding: '0.75rem 1rem',
                borderLeft: `4px solid ${r.pendentes === 0 ? 'var(--success-color)' : 'var(--warning-color)'}`,
                cursor: 'pointer',
                backgroundColor: selectedEquipeId === r.equipe_id ? 'rgba(37, 99, 235, 0.05)' : 'var(--card-bg)'
              }}
              onClick={() => setSelectedEquipeId(r.equipe_id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{r.equipe_nome}</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{r.pagos}/{r.total_membros}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Busca e Filtros Secundários */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className="form-input-wrapper" style={{ flex: 1, minWidth: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder={`Buscar ${activeTab}...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === 'equipes' && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
              <select className="form-input" value={selectedEquipeId} onChange={e => setSelectedEquipeId(e.target.value)}>
                <option value="all">Todas as Equipes</option>
                {equipes.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Listagem Final */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1rem', margin: 0, opacity: 0.7, textTransform: 'capitalize' }}>
          {activeTab} ({filteredParticipantes.length})
        </h2>
      </div>

      <div className="grid-container" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        paddingBottom: '2rem'
      }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <Loader className="animate-spin" size={32} style={{ margin: '0 auto', opacity: 0.5 }} />
            <p style={{ marginTop: '1rem', opacity: 0.6 }}>Carregando...</p>
          </div>
        ) : filteredParticipantes.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
            Nenhum {activeTab === 'encontristas' ? 'encontrista' : 'trabalhador'} encontrado.
          </div>
        ) : (
          filteredParticipantes.map(p => (
            <div key={p.id} className="card" style={{
              padding: '0.8rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
              borderLeft: `4px solid ${p.pago_taxa ? 'var(--success-border)' : 'var(--danger-border)'}`,
              transition: 'transform 0.2s',
              flexWrap: 'wrap',
              backgroundColor: `${p.pago_taxa ? 'var(--success-bg)' : 'var(--secondary-bg)'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1, minWidth: '300px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 0.15rem 0', fontWeight: 700 }}>{p.pessoas?.nome_completo}</h3>
                  <p style={{ fontSize: '0.8rem', margin: 0, opacity: 0.6, fontWeight: 500 }}>
                    {activeTab === 'encontristas' ? (p.pessoas?.cpf || 'Encontrista') : (p.equipes?.nome || 'Sem Equipe')}
                  </p>
                </div>

                <div style={{ minWidth: '110px', textAlign: 'center' }}>
                  {p.pago_taxa ? (
                    <span style={{
                      backgroundColor: 'var(--success-bg)',
                      color: 'var(--success-text)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid var(--success-border)'
                    }}>
                      <CheckCircle size={14} /> PAGO
                    </span>
                  ) : (
                    <span style={{
                      backgroundColor: 'var(--danger-bg)',
                      color: 'var(--danger-text)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid var(--danger-border)'
                    }}>
                      <XCircle size={14} /> PENDENTE
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                minWidth: '180px'
              }}>
                <button
                  className={p.pago_taxa ? "btn-secondary" : "btn-primary"}
                  style={{
                    padding: '0.4rem 1.25rem',
                    fontSize: '0.8rem',
                    minWidth: '160px',
                    justifyContent: 'center'
                  }}
                  disabled={updatingId === p.id}
                  onClick={() => handleTogglePagamento(p.id, p.pago_taxa || false)}
                >
                  {updatingId === p.id ? (
                    <Loader className="animate-spin" size={16} />
                  ) : (
                    <>
                      {p.pago_taxa ? 'Estornar' : 'Confirmar'}
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
