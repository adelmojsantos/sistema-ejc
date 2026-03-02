import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, Shield, Plus, Trash2, Loader } from 'lucide-react';
import { Header } from '../../components/Header';
import { encontroService } from '../../services/encontroService';
import { inscricaoService } from '../../services/inscricaoService';
import { visitacaoService } from '../../services/visitacaoService';
import { equipeService } from '../../services/equipeService';
import type { Encontro } from '../../types/encontro';
import type { VisitaDupla, VisitaVinculo } from '../../types/visitacao';

export function VinculoPage() {
  const navigate = useNavigate();

  // Data States
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [equipeVisitacao, setEquipeVisitacao] = useState<any[]>([]);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [duplas, setDuplas] = useState<VisitaDupla[]>([]);
  const [vinculos, setVinculos] = useState<VisitaVinculo[]>([]);

  // UI States
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPessoa1, setSelectedPessoa1] = useState<string>('');
  const [selectedPessoa2, setSelectedPessoa2] = useState<string>('');

  // Load initial meetings
  useEffect(() => {
    async function loadEncontros() {
      try {
        const data = await encontroService.listar();
        setEncontros(data);
        if (data.length > 0) setSelectedEncontroId(data[data.length - 1].id);
      } finally {
        setIsFetching(false);
      }
    }
    loadEncontros();
  }, []);

  // Load data for the selected meeting
  const loadMeetingData = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsFetching(true);
    try {
      // 1. Get all memberships for this meeting
      const allInscricoes = await inscricaoService.listarPorEncontro(selectedEncontroId);

      // 2. Filter "Visitação" team and "Participantes"
      // We need to find the ID for the "Visitação" team first or assume it from the name
      const equipes = await equipeService.listar();
      const visitacaoTeam = equipes.find(e => e.nome?.toLowerCase().includes('visitação'));

      if (visitacaoTeam) {
        setEquipeVisitacao(allInscricoes.filter(i => i.equipe_id === visitacaoTeam.id));
      } else {
        setEquipeVisitacao([]);
      }

      setParticipantes(allInscricoes.filter(i => i.participante === true));

      // 3. Load duplas and vinculos
      const duplasData = await visitacaoService.listarDuplas(selectedEncontroId);
      setDuplas(duplasData);

      // Load vinculos for each dupla (this might be better handled in a single query if possible, 
      // but for now we follow the service pattern)
      const allVinculos: VisitaVinculo[] = [];
      for (const dupla of duplasData) {
        const v = await visitacaoService.listarVinculos(dupla.id);
        allVinculos.push(...v);
      }
      setVinculos(allVinculos);

    } catch (error) {
      console.error('Error loading meeting data:', error);
    } finally {
      setIsFetching(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadMeetingData();
  }, [loadMeetingData]);

  const handleCreateDupla = async () => {
    if (!selectedPessoa1 || !selectedPessoa2) return;
    if (selectedPessoa1 === selectedPessoa2) {
      alert('Selecione duas pessoas diferentes para formar uma dupla.');
      return;
    }

    setIsLoading(true);
    try {
      await visitacaoService.criarDupla({
        encontro_id: selectedEncontroId,
        pessoa1_id: selectedPessoa1,
        pessoa2_id: selectedPessoa2
      });
      setSelectedPessoa1('');
      setSelectedPessoa2('');
      await loadMeetingData();
    } catch (error) {
      alert('Erro ao criar dupla.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDupla = async (id: string) => {
    if (!confirm('Deseja remover esta dupla? Todos os vínculos de participantes também serão removidos.')) return;
    setIsLoading(true);
    try {
      await visitacaoService.excluirDupla(id);
      await loadMeetingData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVincularParticipante = async (duplaId: string, participanteId: string) => {
    try {
      await visitacaoService.vincularParticipante({
        dupla_id: duplaId,
        participante_id: participanteId
      });
      await loadMeetingData();
    } catch (error) {
      alert('Este participante já pode estar vinculado a outra dupla.');
    }
  };

  const handleDesvincular = async (vinculoId: string) => {
    try {
      await visitacaoService.desvincularParticipante(vinculoId);
      await loadMeetingData();
    } catch (error) {
      alert('Erro ao desvincular.');
    }
  };

  // Helper to get linked participants IDs
  const linkedParticipantIds = useMemo(() => new Set(vinculos.map(v => v.participante_id)), [vinculos]);

  if (isFetching && encontros.length === 0) return <div className="empty-state">Carregando...</div>;

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />
      <main className="main-content container flex-1" style={{ paddingBottom: '4rem' }}>
        <div className="page-header" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/')} className="icon-btn"><ChevronLeft size={20} /></button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Vínculo de Visitação</h1>
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

        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
          {/* Sidebar: Equipe e Criação de Duplas */}
          <aside className="flex flex-col gap-6">
            <div className="card">
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} color="var(--primary-color)" /> Equipe de Visitação
              </h3>
              <div className="flex flex-col gap-2">
                {equipeVisitacao.length === 0 ? (
                  <p style={{ opacity: 0.5, fontSize: '0.9rem', textAlign: 'center' }}>Ninguém escalado na Visitação.</p>
                ) : (
                  equipeVisitacao.map(m => (
                    <div key={m.id} style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--secondary-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      border: m.coordenador ? '1px solid var(--primary-color)' : '1px solid transparent'
                    }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: m.coordenador ? 'var(--primary-color)' : 'rgba(0,0,0,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: m.coordenador ? 'white' : 'inherit'
                      }}>
                        {m.coordenador ? <Shield size={16} /> : <Users size={16} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{m.pessoas?.nome_completo}</p>
                        {m.coordenador && <span style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>COORDENADOR</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1.5rem' }}>Montar Nova Dupla</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Pessoa 1</label>
                  <select
                    className="form-input"
                    value={selectedPessoa1}
                    onChange={e => setSelectedPessoa1(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {equipeVisitacao.map(m => (
                      <option key={m.id} value={m.pessoa_id}>{m.pessoas?.nome_completo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Pessoa 2</label>
                  <select
                    className="form-input"
                    value={selectedPessoa2}
                    onChange={e => setSelectedPessoa2(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {equipeVisitacao.map(m => (
                      <option key={m.id} value={m.pessoa_id}>{m.pessoas?.nome_completo}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCreateDupla}
                  disabled={isLoading || !selectedPessoa1 || !selectedPessoa2}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {isLoading ? <Loader size={18} className="animate-spin" /> : <Plus size={18} />}
                  Criar Dupla
                </button>
              </div>
            </div>
          </aside>

          {/* Main: Duplas e Participantes */}
          <main className="flex flex-col gap-6">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {duplas.map(dupla => (
                <div key={dupla.id} className="card" style={{ borderTop: '4px solid var(--primary-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{dupla.pessoa1?.nome_completo}</h4>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{dupla.pessoa2?.nome_completo}</h4>
                    </div>
                    <button onClick={() => handleDeleteDupla(dupla.id)} className="icon-btn text-danger"><Trash2 size={16} /></button>
                  </div>

                  <div style={{ background: 'var(--secondary-bg)', borderRadius: '8px', padding: '1rem', minHeight: '100px' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', opacity: 0.6, fontWeight: 'bold', letterSpacing: '0.05em' }}>
                      PARTICIPANTES VISITADOS
                    </p>
                    <div className="flex flex-col gap-2">
                      {vinculos.filter(v => v.dupla_id === dupla.id).map(v => (
                        <div key={v.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.4rem 0.75rem', background: 'var(--card-bg)', borderRadius: '6px', fontSize: '0.85rem'
                        }}>
                          <span>{v.participante?.nome_completo}</span>
                          <button onClick={() => handleDesvincular(v.id)} className="icon-btn x-small"><Trash2 size={12} /></button>
                        </div>
                      ))}

                      <select
                        className="form-input small"
                        style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleVincularParticipante(dupla.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        value=""
                      >
                        <option value="">+ Vincular Participante...</option>
                        {participantes
                          .filter(p => !linkedParticipantIds.has(p.pessoa_id))
                          .map(p => (
                            <option key={p.id} value={p.pessoa_id}>{p.pessoas?.nome_completo}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {duplas.length === 0 && (
                <div className="empty-state container card" style={{ gridColumn: '1 / -1' }}>
                  <Users size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                  <p style={{ opacity: 0.5 }}>Nenhuma dupla montada ainda.</p>
                </div>
              )}
            </div>
          </main>
        </div>
      </main >
    </div >
  );
}
