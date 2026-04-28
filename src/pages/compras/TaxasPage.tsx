import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, ChevronLeft, Search, Filter, CheckCircle, XCircle, Loader, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useEncontros } from '../../contexts/EncontroContext';
import { useLoading } from '../../contexts/LoadingContext';
import { comprasService, TaxaReport } from '../../services/comprasService';
import { inscricaoService } from '../../services/inscricaoService';
import { equipeService } from '../../services/equipeService';
import type { Equipe } from '../../types/equipe';
import type { InscricaoEnriched } from '../../types/inscricao';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useDebounce } from '../../hooks/useDebounce';

export function TaxasPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const { setIsLoading: setGlobalLoading } = useLoading();
  
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [relatorioTaxas, setRelatorioTaxas] = useState<TaxaReport[]>([]);
  
  const [selectedEquipeId, setSelectedEquipeId] = useState<string>('all');
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

  const filteredParticipantes = useMemo(() => {
    return participantes.filter(p => {
      const matchEquipe = selectedEquipeId === 'all' || p.equipe_id === selectedEquipeId;
      const matchSearch = (p.pessoas?.nome_completo || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchEquipe && matchSearch;
    }).sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));
  }, [participantes, selectedEquipeId, debouncedSearch]);

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
          <button onClick={() => navigate('/gestao-compras')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Pagamento de Taxas</h1>
          </div>
        </div>
      </div>

      {/* Resumo por Equipe */}
      <section className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {relatorioTaxas.filter(r => r.total_membros > 0).map(r => (
          <div key={r.equipe_id} className="card" style={{ padding: '1rem', borderLeft: `4px solid ${r.pendentes === 0 ? 'var(--success-color)' : 'var(--warning-color)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', margin: 0 }}>{r.equipe_nome}</h3>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-text)' }}>{r.pagos}/{r.total_membros}</span>
            </div>
            <div className="progress-bar" style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${(r.pagos / r.total_membros) * 100}%`, 
                  background: r.pendentes === 0 ? 'var(--success-color)' : 'var(--primary-color)',
                  transition: 'width 0.3s'
                }} 
              />
            </div>
          </div>
        ))}
      </section>

      {/* Filtros e Busca */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
            <label className="form-label">Filtrar por Equipe</label>
            <select className="form-input" value={selectedEquipeId} onChange={e => setSelectedEquipeId(e.target.value)}>
              <option value="all">Todas as Equipes</option>
              {equipes.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '280px' }}>
            <label className="form-label">Buscar Participante</label>
            <div className="form-input-wrapper">
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Nome do participante..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
            <label className="form-label">Encontro</label>
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
      </div>

      {/* Tabela de Resultados */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--surface-1)' }}>
                <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Participante</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Equipe</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: '3rem', textAlign: 'center' }}>
                    <Loader className="animate-spin" size={24} style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '0.5rem', opacity: 0.6 }}>Carregando dados...</p>
                  </td>
                </tr>
              ) : filteredParticipantes.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                    Nenhum participante encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredParticipantes.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontWeight: 600 }}>{p.pessoas?.nome_completo}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.9rem' }}>{p.equipes?.nome || 'Sem Equipe'}</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {p.pago_taxa ? (
                        <span style={{ color: 'var(--success-color)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
                          <CheckCircle size={16} /> Pago
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger-text)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
                          <XCircle size={16} /> Pendente
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button 
                        className={p.pago_taxa ? "btn-secondary" : "btn-primary"} 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        disabled={updatingId === p.id}
                        onClick={() => handleTogglePagamento(p.id, p.pago_taxa || false)}
                      >
                        {updatingId === p.id ? <Loader className="animate-spin" size={14} /> : (p.pago_taxa ? 'Estornar' : 'Marcar como Pago')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
