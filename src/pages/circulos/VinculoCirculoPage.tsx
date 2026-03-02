import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { encontroService } from '../../services/encontroService';
import { circuloService } from '../../services/circuloService';
import { circuloParticipacaoService } from '../../services/circuloParticipacaoService';
import { inscricaoService } from '../../services/inscricaoService';
import { equipeService } from '../../services/equipeService';
import type { Encontro } from '../../types/encontro';
import type { Circulo } from '../../types/circulo';
import { UserPlus, Trash2, Plus, ChevronLeft, Users, Loader } from 'lucide-react';

export function VinculoCirculoPage() {
  const navigate = useNavigate();

  // Data States
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [circulos, setCirculos] = useState<Circulo[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [selectedCirculoId, setSelectedCirculoId] = useState<string>('');
  const [participantes, setParticipantes] = useState<any[]>([]); // All people (participante: true)
  const [equipeCirculo, setEquipeCirculo] = useState<any[]>([]); // People from the circle team
  const [vinculos, setVinculos] = useState<any[]>([]); // Relationships for the meeting/circles

  // Selection states for forming pairs (Casais)
  const [selectedPessoa1, setSelectedPessoa1] = useState<string>('');
  const [selectedPessoa2, setSelectedPessoa2] = useState<string>('');

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
    setIsLoading(true);
    try {
      await circuloParticipacaoService.vincular(participacaoId, parseInt(selectedCirculoId));
      await loadData();
    } catch (error) {
      alert('Erro ao vincular ao círculo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCasal = async () => {
    if (!selectedCirculoId || !selectedPessoa1 || !selectedPessoa2) return;
    setIsLoading(true);
    try {
      // Link both people to the circle
      await Promise.all([
        circuloParticipacaoService.vincular(selectedPessoa1, parseInt(selectedCirculoId)),
        circuloParticipacaoService.vincular(selectedPessoa2, parseInt(selectedCirculoId))
      ]);
      setSelectedPessoa1('');
      setSelectedPessoa2('');
      await loadData();
    } catch (error) {
      alert('Erro ao vincular casal ao círculo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesvincular = async (id: string) => {
    setIsLoading(true);
    try {
      await circuloParticipacaoService.desvincular(id);
      await loadData();
    } catch (error) {
      alert('Erro ao desvincular.');
    } finally {
      setIsLoading(false);
    }
  };

  // Derived helpers
  const vinculadosIds = useMemo(() => new Set(vinculos.map(v => v.participacao)), [vinculos]);

  // Participants linked to the currently selected circle
  const participacoesNoCirculo = useMemo(() => {
    return vinculos.filter(v => v.circulo_id.toString() === selectedCirculoId);
  }, [vinculos, selectedCirculoId]);

  // Team members NOT linked to any circle
  const equipeDisponivel = useMemo(() => {
    return equipeCirculo.filter(p => !vinculadosIds.has(p.id));
  }, [equipeCirculo, vinculadosIds]);

  // Participants NOT linked to any circle
  const participantesDisponiveis = useMemo(() => {
    return participantes.filter(p => !vinculadosIds.has(p.id));
  }, [participantes, vinculadosIds]);

  if (isFetching && encontros.length === 0) return <div className="empty-state">Carregando...</div>;

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />
      <main className="main-content container flex-1" style={{ paddingBottom: '4rem' }}>
        <div className="page-header" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/')} className="icon-btn"><ChevronLeft size={20} /></button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Vínculo de Círculos</h1>
              <select
                className="form-input"
                style={{ border: 'none', background: 'transparent', padding: 0, fontWeight: 'bold' }}
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
                    onClick={() => setSelectedCirculoId(c.id.toString())}
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
                      {vinculos.filter(v => v.circulo_id === c.id).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex flex-col gap-6">
            {/* Form Casal (Pair) */}
            <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0 }}>Montar Casal do Círculo</h3>
                <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Selecione as duas pessoas que serão o casal deste círculo.</p>
              </div>
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
                  Vincular Casal
                </button>
              </div>
            </div>

            {/* Selected Circle Integrantes */}
            <div className="card">
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Integrantes do {circulos.find(c => c.id.toString() === selectedCirculoId)?.nome}</h3>
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{participacoesNoCirculo.length} vinculados</span>
              </div>
              <div style={{ padding: '1rem' }}>
                {participacoesNoCirculo.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                    <p>Nenhum integrante vinculado a este círculo.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                    {participacoesNoCirculo.map(v => (
                      <div key={v.id} style={{
                        padding: '1rem', borderRadius: '12px', background: 'var(--secondary-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <span style={{ fontWeight: 500 }}>{v.participacoes?.pessoas?.nome_completo}</span>
                        <button onClick={() => handleDesvincular(v.id)} className="icon-btn icon-btn-danger"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Available Participants */}
            <div className="card">
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0 }}>Vincular Participantes</h3>
                <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.2rem' }}>Clique no nome para adicionar ao círculo selecionado.</p>
              </div>
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  {participantesDisponiveis.map(p => (
                    <button
                      key={p.id}
                      className="row-hover"
                      onClick={() => handleVincular(p.id)}
                      disabled={isLoading}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>{p.pessoas?.nome_completo}</span>
                      <Plus size={16} opacity={0.5} />
                    </button>
                  ))
                  }
                  {participantesDisponiveis.length === 0 && (
                    <p style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                      Nenhum participante disponível para vínculo.
                    </p>
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
