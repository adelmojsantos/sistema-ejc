import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { encontroService } from '../../services/encontroService';
import { circuloService } from '../../services/circuloService';
import { circuloParticipacaoService } from '../../services/circuloParticipacaoService';
import { inscricaoService } from '../../services/inscricaoService';
import { equipeService } from '../../services/equipeService';
import { normalizeString } from '../../utils/stringUtils';
import type { Encontro } from '../../types/encontro';
import type { Circulo, CirculoParticipacao } from '../../types/circulo';
import { UserPlus, Trash2, Plus, ChevronLeft, Users, Loader, Search, X, Shield, Info } from 'lucide-react';

export function MontagemCirculos() {
  const navigate = useNavigate();

  // Data States
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [circulos, setCirculos] = useState<Circulo[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [selectedCirculoId, setSelectedCirculoId] = useState<string>('');
  const [participantes, setParticipantes] = useState<any[]>([]); // All people (participante: true)
  const [equipeCirculo, setEquipeCirculo] = useState<any[]>([]); // People from the circle team
  const [vinculos, setVinculos] = useState<CirculoParticipacao[]>([]); // Relationships for the meeting/circles

  // Selection states for forming pairs (Casais/Mediadores)
  const [selectedPessoa1, setSelectedPessoa1] = useState<string>('');
  const [selectedPessoa2, setSelectedPessoa2] = useState<string>('');
  const [searchParticipant, setSearchParticipant] = useState('');

  // UI States
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Initial load
  useEffect(() => {
    async function loadBaseData() {
      try {
        const [es, cs] = await Promise.all([
          encontroService.listar(),
          circuloService.listar()
        ]);
        setEncontros(es);
        setCirculos(cs);
        if (es.length > 0) setSelectedEncontroId(es[es.length - 1].id);
        if (cs.length > 0) setSelectedCirculoId(cs[0].id.toString());
      } catch (error) {
        console.error('Error loading base data:', error);
      } finally {
        setIsFetching(false);
      }
    }
    loadBaseData();
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsFetching(true);
    try {
      const allInscricoes = await inscricaoService.listarPorEncontro(selectedEncontroId);

      // Filter participants (jovens)
      setParticipantes(allInscricoes.filter(i => i.participante === true));

      // Try to find the "Círculo" team to form "Casais"
      const equipes = await equipeService.listar();
      const circuloTeam = equipes.find(e => e.nome?.toLowerCase().includes('círculo') || e.nome?.toLowerCase().includes('circulo'));

      if (circuloTeam) {
        setEquipeCirculo(allInscricoes.filter(i => i.equipe_id === circuloTeam.id));
      } else {
        // If team not found, show all team members as potential "Casais"
        setEquipeCirculo(allInscricoes.filter(i => i.participante !== true));
      }

      // Get all circle linkings for this meeting
      const vData = await circuloParticipacaoService.listarPorEncontro(selectedEncontroId);
      setVinculos(vData || []);
    } catch (error) {
      console.error('Error loading meeting data:', error);
    } finally {
      setIsFetching(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVincular = async (participacaoId: string) => {
    if (!selectedCirculoId) return;

    // Constraint: Can't be in more than one circle
    const existingVinculo = vinculos.find(v => v.participacao === participacaoId);
    if (existingVinculo) {
      toast.error('Esta pessoa já está vinculada a um círculo.');
      return;
    }

    setIsLoading(true);
    try {
      await circuloParticipacaoService.vincular(participacaoId, parseInt(selectedCirculoId), false);
      await loadData();
      toast.success('Pessoa vinculada com sucesso!');
    } catch (error) {
      toast.error('Erro ao vincular ao círculo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCasal = async () => {
    if (!selectedCirculoId || !selectedPessoa1 || !selectedPessoa2) return;

    const vinculadosIds = new Set(vinculos.map(v => v.participacao));

    // Constraint: Only one couple per circle
    const mediadoresNoCirculo = vinculos.filter(v => v.circulo_id.toString() === selectedCirculoId && v.mediador);
    if (mediadoresNoCirculo.length >= 2) {
      toast.error('Este círculo já possui um casal mediador.');
      return;
    }

    // Constraint: Can't be in more than one circle
    if (vinculadosIds.has(selectedPessoa1) || vinculadosIds.has(selectedPessoa2)) {
      toast.error('Uma das pessoas selecionadas já está vinculada a um círculo.');
      return;
    }

    setIsLoading(true);
    try {
      // Link both people to the circle as mediadores
      await Promise.all([
        circuloParticipacaoService.vincular(selectedPessoa1, parseInt(selectedCirculoId), true),
        circuloParticipacaoService.vincular(selectedPessoa2, parseInt(selectedCirculoId), true)
      ]);
      setSelectedPessoa1('');
      setSelectedPessoa2('');
      await loadData();
      toast.success('Casal mediador vinculado com sucesso!');
    } catch (error) {
      toast.error('Erro ao vincular casal ao círculo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesvincular = async (id: string) => {
    setIsLoading(true);
    try {
      await circuloParticipacaoService.desvincular(id);
      await loadData();
      toast.success('Desvinculado com sucesso!');
    } catch (error) {
      toast.error('Erro ao desvincular.');
    } finally {
      setIsLoading(false);
    }
  };

  // Derived helpers
  const mediadoresNoCirculo = useMemo(() =>
    vinculos.filter(v => v.circulo_id.toString() === selectedCirculoId && v.mediador),
    [vinculos, selectedCirculoId]);

  // Unified Search Results
  const searchResults = useMemo(() => {
    const q = normalizeString(searchParticipant);

    // If no search, show only current circle participants (excluding mediators)
    if (!q) {
      return vinculos
        .filter(v => v.circulo_id.toString() === selectedCirculoId && !v.mediador)
        .map(v => ({
          id: v.participacao,
          vinculoId: v.id,
          nome: v.participacoes?.pessoas?.nome_completo || 'Sem Nome',
          status: 'in_this_circle' as const,
          circuloNome: null
        }));
    }

    // Search through all meeting participants
    return participantes
      .filter(p => normalizeString(p.pessoas?.nome_completo || '').includes(q))
      .map(p => {
        const vinculo = vinculos.find(v => v.participacao === p.id);

        if (!vinculo) {
          return {
            id: p.id,
            vinculoId: null,
            nome: p.pessoas?.nome_completo,
            status: 'available' as const,
            circuloNome: null
          };
        }

        if (vinculo.circulo_id.toString() === selectedCirculoId) {
          return {
            id: p.id,
            vinculoId: vinculo.id,
            nome: p.pessoas?.nome_completo,
            status: vinculo.mediador ? ('mediator_here' as const) : ('in_this_circle' as const),
            circuloNome: null
          };
        }

        return {
          id: p.id,
          vinculoId: vinculo.id,
          nome: p.pessoas?.nome_completo,
          status: 'in_other_circle' as const,
          circuloNome: vinculo.circulos?.nome || 'Outro Círculo'
        };
      });
  }, [participantes, vinculos, selectedCirculoId, searchParticipant]);

  // Team members NOT linked to any circle
  const equipeDisponivel = useMemo(() => {
    const vinculadosIds = new Set(vinculos.map(v => v.participacao));
    return equipeCirculo.filter(p => !vinculadosIds.has(p.id));
  }, [equipeCirculo, vinculos]);

  if (isFetching && encontros.length === 0) return <div className="empty-state">Carregando...</div>;

  return (
    <div className="app-shell">
      <Header />
      <main className="main-content container flex-1" style={{ paddingBottom: '4rem' }}>
        <div className="page-header" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/cadastros')} className="icon-btn"><ChevronLeft size={20} /></button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Montagem Círculos</h1>
              <select
                className="form-input"
                style={{ border: 'none', background: 'transparent', padding: 0, fontWeight: 'bold', cursor: 'pointer' }}
                value={selectedEncontroId}
                onChange={e => setSelectedEncontroId(e.target.value)}
              >
                {encontros.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
          {/* Sidebar: Círculos */}
          <aside>
            <div className="card" style={{ padding: '0.5rem' }}>
              <h3 style={{ padding: '1rem', margin: 0, fontSize: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <Users size={16} style={{ marginRight: '0.5rem' }} /> Círculos
              </h3>
              <div style={{ padding: '0.5rem' }}>
                {circulos.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCirculoId(c.id.toString());
                      setSearchParticipant('');
                    }}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: selectedCirculoId === c.id.toString() ? 'var(--primary-color)' : 'transparent',
                      color: selectedCirculoId === c.id.toString() ? 'white' : 'inherit',
                      marginBottom: '0.25rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{c.nome}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      background: selectedCirculoId === c.id.toString() ? 'rgba(255,255,255,0.2)' : 'var(--secondary-bg)',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      {vinculos.filter(v => v.circulo_id === c.id && !v.mediador).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex flex-col gap-6">
            {/* Form Casal (Mediadores) */}
            <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0 }}>Mediadores</h3>
                {/* <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Cada círculo deve ter 2 mediadores.</p> */}
              </div>

              {mediadoresNoCirculo.length >= 2 ? (
                <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem' }}>
                  {mediadoresNoCirculo.map(v => (
                    <div key={v.id} style={{
                      flex: 1, padding: '1rem', borderRadius: '12px', background: 'var(--secondary-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--primary-color)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Shield size={18} color="var(--primary-color)" />
                        <span style={{ fontWeight: 600 }}>{v.participacoes?.pessoas?.nome_completo}</span>
                      </div>
                      <button onClick={() => handleDesvincular(v.id)} className="icon-btn text-danger" title="Remover Mediador"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Pessoa 1</label>
                    <select
                      className="form-input"
                      value={selectedPessoa1}
                      onChange={e => setSelectedPessoa1(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {equipeDisponivel.filter(p => p.id !== selectedPessoa2).map(p => (
                        <option key={p.id} value={p.id}>{p.pessoas?.nome_completo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Pessoa 2</label>
                    <select
                      className="form-input"
                      value={selectedPessoa2}
                      onChange={e => setSelectedPessoa2(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {equipeDisponivel.filter(p => p.id !== selectedPessoa1).map(p => (
                        <option key={p.id} value={p.id}>{p.pessoas?.nome_completo}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleCreateCasal}
                    disabled={isLoading || !selectedPessoa1 || !selectedPessoa2}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px' }}
                  >
                    {isLoading ? <Loader size={18} className="animate-spin" /> : <UserPlus size={18} />}
                    Vincular Mediadores
                  </button>
                </div>
              )}
            </div>

            {/* Unified Participants Management */}
            <div className="card">
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: '100%' }}>
                  <h3 style={{ margin: 0 }}>Encontristas</h3>
                  <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Gerenciar encontristas vinculados ao círculo.</p>
                </div>
                <div className="search-bar" style={{ marginBottom: 0, width: '100%' }}>
                  <Search size={16} style={{ opacity: 0.5 }} />
                  <input
                    className="search-input"
                    placeholder="Buscar para adicionar..."
                    value={searchParticipant}
                    onChange={e => setSearchParticipant(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                  />
                  {searchParticipant && <button onClick={() => setSearchParticipant('')} style={{ background: 'none', border: 'none', opacity: 0.5, cursor: 'pointer' }}><X size={14} /></button>}
                </div>
              </div>

              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {searchResults.map(item => (
                    <div key={item.id} style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      background: item.status === 'in_this_circle' ? 'var(--secondary-bg)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: item.status === 'in_other_circle' || item.status === 'mediator_here' ? 0.7 : 1
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.nome}</span>
                        {item.status === 'in_other_circle' && (
                          <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 500 }}>Em {item.circuloNome}</span>
                        )}
                        {item.status === 'mediator_here' && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 500 }}>Mediador</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {item.status === 'available' && (
                          <button
                            onClick={() => handleVincular(item.id)}
                            disabled={isLoading}
                            className="icon-btn"
                            style={{ color: 'var(--primary-color)' }}
                            title="Adicionar ao Círculo"
                          >
                            <Plus size={18} />
                          </button>
                        )}

                        {item.status === 'in_this_circle' && item.vinculoId && (
                          <button
                            onClick={() => handleDesvincular(item.vinculoId!)}
                            disabled={isLoading}
                            className="icon-btn text-danger"
                            title="Remover do Círculo"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}

                        {item.status === 'in_other_circle' && (
                          <div title="Já vinculado a outro círculo">
                            <Info size={16} opacity={0.5} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {searchResults.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                      <Users size={32} style={{ margin: '0 auto 1rem', display: 'block' }} />
                      {searchParticipant ? 'Nenhum resultado para esta busca.' : 'Este círculo ainda não tem encontristas vinculados.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
