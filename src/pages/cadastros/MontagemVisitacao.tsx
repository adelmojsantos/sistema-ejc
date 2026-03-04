import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { encontroService } from '../../services/encontroService';
import { visitacaoService } from '../../services/visitacaoService';
import { inscricaoService } from '../../services/inscricaoService';
import { equipeService } from '../../services/equipeService';
import { normalizeString } from '../../utils/stringUtils';
import type { Encontro } from '../../types/encontro';
import type { VisitaGrupo, VisitaParticipacao } from '../../types/visitacao';
import { UserPlus, Trash2, Plus, ChevronLeft, Users, Loader, Search, X, Shield, Info, Edit2, Check } from 'lucide-react';

export function MontagemVisitacao() {
  const navigate = useNavigate();

  // Data States
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [grupos, setGrupos] = useState<VisitaGrupo[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  const [participantes, setParticipantes] = useState<any[]>([]); // All people (participante: true)
  const [equipeVisitacao, setEquipeVisitacao] = useState<any[]>([]); // People from the visitation team
  const [vinculos, setVinculos] = useState<VisitaParticipacao[]>([]); // Relationships for the meeting/groups

  // Selection states for forming pairs (Visitantes)
  const [selectedPessoa1, setSelectedPessoa1] = useState<string>('');
  const [selectedPessoa2, setSelectedPessoa2] = useState<string>('');
  const [searchParticipant, setSearchParticipant] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  // UI States
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Initial load
  useEffect(() => {
    async function loadBaseData() {
      try {
        const es = await encontroService.listar();
        setEncontros(es);
        if (es.length > 0) setSelectedEncontroId(es[es.length - 1].id);
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

      // Filter Visitation team
      const equipes = await equipeService.listar();
      const visitacaoTeam = equipes.find(e => e.nome?.toLowerCase().includes('visitação') || e.nome?.toLowerCase().includes('visitacao'));

      if (visitacaoTeam) {
        setEquipeVisitacao(allInscricoes.filter(i => i.equipe_id === visitacaoTeam.id));
      } else {
        setEquipeVisitacao(allInscricoes.filter(i => i.participante !== true));
      }

      // Load groups and participation
      const [gData, vData] = await Promise.all([
        visitacaoService.listarGrupos(selectedEncontroId),
        visitacaoService.listarParticipacaoPorEncontro(selectedEncontroId)
      ]);

      setGrupos(gData);
      setVinculos(vData || []);

      if (gData.length > 0 && !selectedGrupoId) {
        setSelectedGrupoId(gData[0].id);
      }
    } catch (error) {
      console.error('Error loading meeting data:', error);
    } finally {
      setIsFetching(false);
    }
  }, [selectedEncontroId, selectedGrupoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVincular = async (participacaoId: string) => {
    if (!selectedGrupoId || !selectedEncontroId) return;

    // Constraint: Can't be in more than one visit
    const existingVinculo = vinculos.find(v => v.participacao_id === participacaoId);
    if (existingVinculo) {
      toast.error('Esta pessoa já está vinculada a uma visita.');
      return;
    }

    setIsLoading(true);
    try {
      await visitacaoService.vincular({
        grupo_id: selectedGrupoId,
        participacao_id: participacaoId,
        visitante: false,
        encontro_id: selectedEncontroId // Assuming service handles it or it's in the formData
      } as any);
      await loadData();
      toast.success('Pessoa vinculada com sucesso!');
    } catch (error) {
      toast.error('Erro ao vincular à visita.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!selectedEncontroId || !selectedPessoa1 || !selectedPessoa2) return;

    const p1 = equipeVisitacao.find(p => p.id === selectedPessoa1);
    const p2 = equipeVisitacao.find(p => p.id === selectedPessoa2);

    // Auto-generate name: "Visita: Nome1 & Nome2"
    const name1 = p1?.pessoas?.nome_completo?.split(' ')[0] || 'Visitante 1';
    const name2 = p2?.pessoas?.nome_completo?.split(' ')[0] || 'Visitante 2';
    const groupName = `Visita: ${name1} & ${name2}`;

    setIsLoading(true);
    try {
      const newGroup = await visitacaoService.criarGrupo({
        encontro_id: selectedEncontroId,
        nome: groupName
      });

      // Link both visitors to the group
      await Promise.all([
        visitacaoService.vincular({ grupo_id: newGroup.id, participacao_id: selectedPessoa1, visitante: true }),
        visitacaoService.vincular({ grupo_id: newGroup.id, participacao_id: selectedPessoa2, visitante: true })
      ]);

      setSelectedPessoa1('');
      setSelectedPessoa2('');
      setSelectedGrupoId(newGroup.id);
      await loadData();
      toast.success('Dupla de visitação criada com sucesso!');
    } catch (error) {
      toast.error('Erro ao criar grupo de visitação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameGroup = async () => {
    if (!editingName || !tempName.trim()) return;
    setIsLoading(true);
    try {
      await visitacaoService.atualizarGrupo(editingName, tempName.trim());
      setEditingName(null);
      await loadData();
      toast.success('Grupo renomeado com sucesso!');
    } catch (error) {
      toast.error('Erro ao renomear grupo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesvincular = async (id: string) => {
    setIsLoading(true);
    try {
      await visitacaoService.desvincular(id);
      await loadData();
      toast.success('Desvinculado com sucesso!');
    } catch (error) {
      toast.error('Erro ao desvincular.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Deseja excluir este grupo de visitação?')) return;
    setIsLoading(true);
    try {
      await visitacaoService.excluirGrupo(id);
      if (selectedGrupoId === id) setSelectedGrupoId('');
      await loadData();
      toast.success('Grupo excluído com sucesso!');
    } catch (error) {
      toast.error('Erro ao excluir grupo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Derived helpers
  const visitantesNoGrupo = useMemo(() =>
    vinculos.filter(v => v.grupo_id === selectedGrupoId && v.visitante),
    [vinculos, selectedGrupoId]);

  const currentGrupo = useMemo(() =>
    grupos.find(g => g.id === selectedGrupoId),
    [grupos, selectedGrupoId]);

  // Unified Search Results
  const searchResults = useMemo(() => {
    const q = normalizeString(searchParticipant);

    // If no search, show only current group participants (excluding visitors)
    if (!q) {
      return vinculos
        .filter(v => v.grupo_id === selectedGrupoId && !v.visitante)
        .map(v => ({
          id: v.participacao_id,
          vinculoId: v.id,
          nome: v.participacoes?.pessoas?.nome_completo || 'Sem Nome',
          status: 'in_this_group' as const,
          grupoNome: null
        }));
    }

    // Search through all meeting participants
    return participantes
      .filter(p => normalizeString(p.pessoas?.nome_completo || '').includes(q))
      .map(p => {
        const vinculo = vinculos.find(v => v.participacao_id === p.id);

        if (!vinculo) {
          return {
            id: p.id,
            vinculoId: null,
            nome: p.pessoas?.nome_completo,
            status: 'available' as const,
            grupoNome: null
          };
        }

        if (vinculo.grupo_id === selectedGrupoId) {
          return {
            id: p.id,
            vinculoId: vinculo.id,
            nome: p.pessoas?.nome_completo,
            status: vinculo.visitante ? ('visitor_here' as const) : ('in_this_group' as const),
            grupoNome: null
          };
        }

        return {
          id: p.id,
          vinculoId: vinculo.id,
          nome: p.pessoas?.nome_completo,
          status: 'in_other_group' as const,
          grupoNome: vinculo.visita_grupos?.nome || 'Outra Visita'
        };
      });
  }, [participantes, vinculos, selectedGrupoId, searchParticipant]);

  // Team members NOT linked to any visit group
  const equipeDisponivel = useMemo(() => {
    const vinculadosIds = new Set(vinculos.map(v => v.participacao_id));
    return equipeVisitacao.filter(p => !vinculadosIds.has(p.id));
  }, [equipeVisitacao, vinculos]);

  if (isFetching && encontros.length === 0) return <div className="empty-state">Carregando...</div>;

  return (
    <div className="app-shell">
      <Header />
      <main className="main-content container flex-1" style={{ paddingBottom: '4rem' }}>
        <div className="page-header" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/cadastros')} className="icon-btn"><ChevronLeft size={20} /></button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Montagem Visitação</h1>
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
          {/* Sidebar: Grupos de Visita */}
          <aside>
            <div className="card" style={{ padding: '0.5rem' }}>
              <h3 style={{ padding: '1rem', margin: 0, fontSize: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <Users size={16} style={{ marginRight: '0.5rem' }} /> Duplas Visitação
              </h3>
              <div style={{ padding: '0.5rem' }}>
                {grupos.map(g => (
                  <div
                    key={g.id}
                    onClick={() => {
                      setSelectedGrupoId(g.id);
                      setSearchParticipant('');
                    }}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: selectedGrupoId === g.id ? 'var(--primary-color)' : 'transparent',
                      color: selectedGrupoId === g.id ? 'white' : 'inherit',
                      marginBottom: '0.25rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nome}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      background: selectedGrupoId === g.id ? 'rgba(255,255,255,0.2)' : 'var(--secondary-bg)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      marginLeft: '0.5rem'
                    }}>
                      {vinculos.filter(v => v.grupo_id === g.id && !v.visitante).length}
                    </span>
                  </div>
                ))}
                {grupos.length === 0 && (
                  <p style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>Sem duplas montadas.</p>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex flex-col gap-6">
            {/* Form Visita (Visitantes) */}
            <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingName === currentGrupo?.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        className="form-input"
                        value={tempName}
                        onChange={e => setTempName(e.target.value)}
                        style={{ height: '32px', padding: '0 0.5rem' }}
                      />
                      <button onClick={handleRenameGroup} className="icon-btn text-primary"><Check size={18} /></button>
                      <button onClick={() => setEditingName(null)} className="icon-btn"><X size={18} /></button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0 }}>{currentGrupo?.nome || 'Nova dupla'}</h3>
                      {currentGrupo && (
                        <button
                          onClick={() => { setEditingName(currentGrupo.id); setTempName(currentGrupo.nome || ''); }}
                          className="icon-btn" style={{ opacity: 0.5 }}
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {currentGrupo && (
                  <button onClick={() => handleDeleteGroup(currentGrupo.id)} className="icon-btn text-danger" title="Excluir dupla"><Trash2 size={16} /></button>
                )}
              </div>

              {visitantesNoGrupo.length > 0 ? (
                <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem' }}>
                  {visitantesNoGrupo.map(v => (
                    <div key={v.id} style={{
                      flex: 1, padding: '1rem', borderRadius: '12px', background: 'var(--secondary-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--primary-color)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Shield size={18} color="var(--primary-color)" />
                        <span style={{ fontWeight: 600 }}>{v.participacoes?.pessoas?.nome_completo}</span>
                      </div>
                      <button onClick={() => handleDesvincular(v.id)} className="icon-btn text-danger" title="Remover Visitante"><Trash2 size={16} /></button>
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
                    onClick={handleCreateGroup}
                    disabled={isLoading || !selectedPessoa1 || !selectedPessoa2}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px' }}
                  >
                    {isLoading ? <Loader size={18} className="animate-spin" /> : <UserPlus size={18} />}
                    Vincular Dupla
                  </button>
                </div>
              )}
            </div>

            {/* Unified Participants Management */}
            <div className="card">
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '100%' }}>
                  <h3 style={{ margin: 0 }}>Encontristas</h3>
                  <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Gerenciar encontristas vinculados a esta dupla.</p>
                </div>
                <div className="search-bar" style={{ marginBottom: 0, width: '100%' }}>
                  <Search size={16} style={{ opacity: 0.5 }} />
                  <input
                    className="search-input"
                    placeholder="Buscar encontrista para adicionar..."
                    value={searchParticipant}
                    onChange={e => setSearchParticipant(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                  {searchParticipant && <button onClick={() => setSearchParticipant('')} style={{ background: 'none', border: 'none', opacity: 0.5, cursor: 'pointer' }}><X size={14} /></button>}
                </div>
              </div>

              <div style={{ padding: '1rem' }}>
                {selectedGrupoId ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {searchResults.map(item => (
                      <div key={item.id} style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        background: item.status === 'in_this_group' ? 'var(--secondary-bg)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        opacity: item.status === 'in_other_group' || item.status === 'visitor_here' ? 0.7 : 1
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.nome}</span>
                          {item.status === 'in_other_group' && (
                            <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 500 }}>Em {item.grupoNome}</span>
                          )}
                          {item.status === 'visitor_here' && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 500 }}>Visitante</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {item.status === 'available' && (
                            <button
                              onClick={() => handleVincular(item.id)}
                              disabled={isLoading}
                              className="icon-btn"
                              style={{ color: 'var(--primary-color)' }}
                              title="Adicionar à dupla"
                            >
                              <Plus size={18} />
                            </button>
                          )}

                          {item.status === 'in_this_group' && item.vinculoId && (
                            <button
                              onClick={() => handleDesvincular(item.vinculoId!)}
                              disabled={isLoading}
                              className="icon-btn text-danger"
                              title="Remover da dupla"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

                          {item.status === 'in_other_group' && (
                            <div title="Já vinculado a outra dupla">
                              <Info size={16} opacity={0.5} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {searchResults.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                        <Users size={32} style={{ margin: '0 auto 1rem', display: 'block' }} />
                        {searchParticipant ? 'Nenhum resultado para esta busca.' : 'Esta dupla ainda não tem encontristas vinculados.'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                    <p>Selecione ou crie uma dupla para gerenciar encontristas.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
