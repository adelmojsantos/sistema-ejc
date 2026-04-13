import {
  Check,
  Edit2,
  ExternalLink,
  Link2,
  List,
  Loader,
  Lock,
  MapPin,
  Monitor,
  Plus,
  Search as SearchIcon,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Header } from '../../components/Header';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EncontristaMap } from '../../components/visitacao/EncontristaMap';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import { visitacaoService } from '../../services/visitacaoService';
import type { Encontro } from '../../types/encontro';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { VisitaGrupo, VisitaParticipacaoEnriched, VisitaStatus } from '../../types/visitacao';
import { normalizeString } from '../../utils/stringUtils';

export function CoordenadorVisitacaoPage() {
  const [activeTab, setActiveTab] = useState<'duplas' | 'vincular' | 'monitoramento'>('duplas');

  // Data States
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [grupos, setGrupos] = useState<VisitaGrupo[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [equipeVisitacao, setEquipeVisitacao] = useState<InscricaoEnriched[]>([]);
  const [vinculos, setVinculos] = useState<VisitaParticipacaoEnriched[]>([]);

  // Selection states 
  const [selectedPessoa1, setSelectedPessoa1] = useState<string>('');
  const [selectedPessoa2, setSelectedPessoa2] = useState<string>('');
  const [searchParticipant, setSearchParticipant] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [vincularSubTab, setVincularSubTab] = useState<'lista' | 'buscar' | 'mapa'>('lista');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // New Filter States
  const [hideLinkedToSelected, setHideLinkedToSelected] = useState(false);
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);

  // UI States
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    async function loadBaseData() {
      try {
        const es = await encontroService.listar();
        setEncontros(es);
        if (es.length > 0) setSelectedEncontroId(es[es.length - 1].id);
      } catch (_error) {
        console.error('Error loading base data:', _error);
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
      setParticipantes(allInscricoes.filter(i => i.participante === true));

      const equipes = await equipeService.listar();
      const visitacaoTeam = equipes.find(e => e.nome?.toLowerCase().includes('visitação') || e.nome?.toLowerCase().includes('visitacao'));

      if (visitacaoTeam) {
        setEquipeVisitacao(allInscricoes.filter(i => i.equipe_id === visitacaoTeam.id));
      } else {
        setEquipeVisitacao(allInscricoes.filter(i => i.participante !== true));
      }

      const [gData, vData] = await Promise.all([
        visitacaoService.listarGrupos(selectedEncontroId),
        visitacaoService.listarParticipacaoPorEncontro(selectedEncontroId)
      ]);

      setGrupos(gData);
      setVinculos(vData || []);

      if (gData.length > 0 && !selectedGrupoId) {
        setSelectedGrupoId(gData[0].id);
      }
    } catch (_error) {
      console.error('Error loading meeting data:', _error);
    } finally {
      setIsFetching(false);
    }
  }, [selectedEncontroId, selectedGrupoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Updated filtering rule for visitors
  const visitantesDisponiveis = useMemo(() => {
    // Current group visitors
    const vinculadosComoVisitantes = new Set(
      vinculos.filter(v => v.visitante).map(v => v.participacao_id)
    );

    return equipeVisitacao.filter(p =>
      !p.coordenador && // Not a coordinator
      !vinculadosComoVisitantes.has(p.id) // Not already linked as visitor
    );
  }, [equipeVisitacao, vinculos]);

  const handleVincular = async (participacaoId: string) => {
    if (!selectedGrupoId || !selectedEncontroId) return;
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
        status: 'pendente'
      });
      await loadData();
      toast.success('Pessoa vinculada com sucesso!');
    } catch {
      toast.error('Erro ao vincular à visita.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!selectedEncontroId || !selectedPessoa1 || !selectedPessoa2) return;
    const p1 = equipeVisitacao.find(p => p.id === selectedPessoa1);
    const p2 = equipeVisitacao.find(p => p.id === selectedPessoa2);
    const name1 = p1?.pessoas?.nome_completo?.split(' ')[0] || 'Visitante 1';
    const name2 = p2?.pessoas?.nome_completo?.split(' ')[0] || 'Visitante 2';
    const groupName = `${name1} & ${name2}`;

    setIsLoading(true);
    try {
      const newGroup = await visitacaoService.criarGrupo({
        encontro_id: selectedEncontroId,
        nome: groupName
      });

      await Promise.all([
        visitacaoService.vincular({ grupo_id: newGroup.id, participacao_id: selectedPessoa1, visitante: true }),
        visitacaoService.vincular({ grupo_id: newGroup.id, participacao_id: selectedPessoa2, visitante: true })
      ]);

      setSelectedPessoa1('');
      setSelectedPessoa2('');
      setSelectedGrupoId(newGroup.id);
      setIsCreateModalOpen(false);
      await loadData();
      toast.success('Dupla de visitação criada com sucesso!');
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      toast.error('Erro ao excluir grupo.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentGrupo = useMemo(() =>
    grupos.find(g => g.id === selectedGrupoId),
    [grupos, selectedGrupoId]);

  const searchResults = useMemo(() => {
    const q = normalizeString(searchParticipant);
    let results = [];

    if (!q) {
      if (!selectedGrupoId) return [];
      results = vinculos
        .filter(v => v.grupo_id === selectedGrupoId && !v.visitante)
        .map(v => ({
          id: v.participacao_id,
          vinculoId: v.id,
          nome: v.participacoes?.pessoas?.nome_completo || 'Sem Nome',
          status: 'in_this_group' as const,
          grupoNome: null
        }));
    } else {
      results = participantes
        .filter(p => {
          const name = normalizeString(p.pessoas?.nome_completo || '');
          const email = normalizeString(p.pessoas?.email || '');
          const phone = normalizeString(p.pessoas?.telefone || '');
          return name.includes(q) || email.includes(q) || phone.includes(q);
        })
        .map(p => {
          const vinculo = vinculos.find(v => v.participacao_id === p.id);
          if (!vinculo) return { id: p.id, vinculoId: null, nome: p.pessoas?.nome_completo, status: 'available' as const, grupoNome: null };
          if (vinculo.grupo_id === selectedGrupoId) return { id: p.id, vinculoId: vinculo.id, nome: p.pessoas?.nome_completo, status: vinculo.visitante ? ('visitor_here' as const) : ('in_this_group' as const), grupoNome: null };
          return { id: p.id, vinculoId: vinculo.id, nome: p.pessoas?.nome_completo, status: 'in_other_group' as const, grupoNome: vinculo.visita_grupos?.nome || 'Outra Visita' };
        });
    }
    // Apply filters

    if (hideLinkedToSelected && selectedGrupoId) {
      results = results.filter(r => r.status !== 'in_this_group' && r.status !== 'visitor_here');
    }

    if (showOnlyUnmapped) {
      results = results.filter(r => {
        const p = participantes.find(part => part.id === r.id);
        return p && (!p.pessoas?.latitude || !p.pessoas?.longitude);
      });
    }

    return results.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [participantes, vinculos, selectedGrupoId, searchParticipant, hideLinkedToSelected, showOnlyUnmapped]);

  const stats = useMemo(() => {
    const totalP = vinculos.filter(v => !v.visitante).length;
    const realizada = vinculos.filter(v => !v.visitante && v.status === 'realizada').length;
    const pendente = vinculos.filter(v => !v.visitante && v.status === 'pendente').length;
    return { totalP, realizada, pendente, percent: totalP > 0 ? (realizada / totalP) * 100 : 0 };
  }, [vinculos]);

  const monitoramentoGrupos = useMemo(() => {
    return grupos.map(g => {
      const membrosVisita = vinculos.filter(v => v.grupo_id === g.id && !v.visitante);
      const visitantes = vinculos.filter(v => v.grupo_id === g.id && v.visitante);
      return {
        ...g,
        visitantes,
        membrosVisita,
        progresso: membrosVisita.length > 0
          ? (membrosVisita.filter(m => m.status === 'realizada').length / membrosVisita.length) * 100
          : 0
      };
    });
  }, [grupos, vinculos]);

  const getStatusBadge = (status: VisitaStatus) => {
    const config = {
      pendente: { label: 'Pendente', color: '#6b7280' },
      realizada: { label: 'Realizada', color: '#10b981' },
      ausente: { label: 'Ausente', color: '#f59e0b' },
      cancelada: { label: 'Cancelada', color: '#ef4444' }
    };
    const s = config[status] || config.pendente;
    return <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', background: s.color + '20', color: s.color, fontWeight: 600 }}>{s.label}</span>;
  };

  if (isFetching && encontros.length === 0) return <div className="empty-state">Carregando...</div>;

  return (
    <div className="app-shell">
      <Header />
      <main className="main-content container flex-1" style={{ paddingBottom: '4rem' }}>
        <PageHeader
          title="Gestão de Visitação"
          subtitle="Início / Visitação"
          backPath="/visitacao"
          actions={
            <div style={{ width: '300px' }}>
              <LiveSearchSelect<Encontro>
                value={selectedEncontroId}
                onChange={(val) => setSelectedEncontroId(val)}
                fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                getOptionLabel={(e) => `${e.nome} ${e.ativo ? '(Ativo)' : ''}`}
                getOptionValue={(e) => String(e.id)}
                placeholder="Selecione um Encontro..."
                initialOptions={encontros}
                className="montagem-header-select"
              />
            </div>
          }
          tabs={
            <div className="tabs-modern-container">
              <button
                onClick={() => setActiveTab('duplas')}
                className={`tab-btn-modern ${activeTab === 'duplas' ? 'active' : ''}`}
              >
                <Users size={18} /> 1. Montagem de Duplas
              </button>
              <button
                onClick={() => setActiveTab('vincular')}
                className={`tab-btn-modern ${activeTab === 'vincular' ? 'active' : ''}`}
              >
                <UserPlus size={18} /> 2. Vínculo de Encontristas
              </button>
              <button
                onClick={() => setActiveTab('monitoramento')}
                className={`tab-btn-modern ${activeTab === 'monitoramento' ? 'active' : ''}`}
              >
                <Monitor size={18} /> 3. Monitoramento
              </button>
            </div>
          }
        />

        {activeTab === 'duplas' && (
          <div className="flex-col gap-6">
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsCreateModalOpen(true)} className="btn-new-visita">
                <Plus size={20} /> Montar Nova Dupla
              </button>
            </div>

            <div className="visita-grid">
              {grupos.map(g => {
                const visitantes = vinculos.filter(v => v.grupo_id === g.id && v.visitante);
                const count = vinculos.filter(v => v.grupo_id === g.id && !v.visitante).length;
                return (
                  <div key={g.id} className="visita-grupo-card">
                    <div className="visita-card-header">
                      {editingName === g.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                          <input
                            className="form-input"
                            style={{ height: '32px', fontSize: '0.9rem', padding: '0 8px' }}
                            value={tempName}
                            onChange={e => setTempName(e.target.value)}
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleRenameGroup()}
                          />
                          <button onClick={handleRenameGroup} className="icon-btn text-primary" title="Salvar">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditingName(null)} className="icon-btn" title="Cancelar">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h4 className="visita-card-title">{g.nome}</h4>
                          <div className="visita-card-actions">
                            <button
                              onClick={() => { setEditingName(g.id); setTempName(g.nome || ''); }}
                              className="icon-btn"
                              title="Editar Nome"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(g.id)}
                              className="icon-btn text-danger"
                              title="Excluir Dupla"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="visita-card-info-row">
                      <div className="visita-card-visitors-inline">
                        {visitantes.map(v => (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Shield size={14} />
                            <span>{v.participacoes?.pessoas?.nome_completo}</span>
                          </div>
                        ))}
                      </div>

                      <div className="visita-card-stats-inline">
                        <Users size={14} />
                        <span>{count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Modal
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              title="Nova Dupla de Visitação"
            >
              <div className="flex-col gap-6">
                <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>
                  Escolha dois membros da equipe de visitação para formar uma nova dupla.
                </p>

                <div className="form-group">
                  <label className="form-label">Primeiro Visitante</label>
                  <LiveSearchSelect<InscricaoEnriched>
                    value={selectedPessoa1}
                    onChange={(val) => setSelectedPessoa1(val)}
                    fetchData={async (search) => {
                      const q = normalizeString(search);
                      return visitantesDisponiveis
                        .filter(v => v.id !== selectedPessoa2)
                        .filter(v => normalizeString(v.pessoas?.nome_completo || '').includes(q));
                    }}
                    getOptionLabel={(p) => p.pessoas?.nome_completo || ''}
                    getOptionValue={(p) => p.id}
                    placeholder="Selecione o primeiro visitante..."
                    initialOptions={visitantesDisponiveis.filter(v => v.id !== selectedPessoa2)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Segundo Visitante</label>
                  <LiveSearchSelect<InscricaoEnriched>
                    value={selectedPessoa2}
                    onChange={(val) => setSelectedPessoa2(val)}
                    fetchData={async (search) => {
                      const q = normalizeString(search);
                      return visitantesDisponiveis
                        .filter(v => v.id !== selectedPessoa1)
                        .filter(v => normalizeString(v.pessoas?.nome_completo || '').includes(q));
                    }}
                    getOptionLabel={(p) => p.pessoas?.nome_completo || ''}
                    getOptionValue={(p) => p.id}
                    placeholder="Selecione o segundo visitante..."
                    initialOptions={visitantesDisponiveis.filter(v => v.id !== selectedPessoa1)}
                  />
                </div>

                <div className="form-actions" style={{ marginTop: '1rem', borderTop: 'none', paddingTop: 0 }}>
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="btn-secondary"
                    disabled={isLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateGroup}
                    disabled={isLoading || !selectedPessoa1 || !selectedPessoa2}
                    className="btn-primary"
                    style={{ minWidth: '140px' }}
                  >
                    {isLoading ? <Loader className="animate-spin" /> : 'Criar Dupla'}
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        )}

        {activeTab === 'vincular' && (
          <div className="vincular-container">
            {/* Sidebar / Duo Selector */}
            <aside className={`vincular-sidebar ${isSidebarOpen ? 'open' : ''}`}>
              <div className="card" style={{ padding: '0.5rem', height: '100%' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={16} /> Duplas
                  </h3>
                  <button className="mobile-only icon-btn" onClick={() => setIsSidebarOpen(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div style={{ padding: '0.5rem', maxHeight: '100%', overflowY: 'auto' }}>
                  {grupos.map(g => (
                    <div
                      key={g.id}
                      onClick={() => { setSelectedGrupoId(g.id); setSearchParticipant(''); setIsSidebarOpen(false); }}
                      className={`vincular-sidebar-item ${selectedGrupoId === g.id ? 'active' : ''}`}
                    >
                      <span className="sidebar-item-name">{g.nome}</span>
                      <span className="sidebar-item-count">
                        {vinculos.filter(v => v.grupo_id === g.id && !v.visitante).length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <div className="vincular-main">
              {/* Mobile Duo Selector Trigger */}
              <div className="mobile-only duo-selector-card card">
                <div>
                  <span className="duo-selector-label">Dupla Selecionada</span>
                  <p className="duo-selector-name">{currentGrupo?.nome || 'Nenhuma'}</p>
                </div>
                <button className="btn-secondary-sm" onClick={() => setIsSidebarOpen(true)}>
                  Trocar Dupla
                </button>
              </div>

              <div className="card overflow-hidden">
                {/* Internal Sub-Tabs */}
                <div className="sub-tabs-container">
                  <button
                    onClick={() => setVincularSubTab('lista')}
                    className={`sub-tab-btn ${vincularSubTab === 'lista' ? 'active' : ''}`}
                  >
                    <List size={16} /> Lista
                  </button>
                  <button
                    onClick={() => setVincularSubTab('buscar')}
                    className={`sub-tab-btn ${vincularSubTab === 'buscar' ? 'active' : ''}`}
                  >
                    <SearchIcon size={16} /> Buscar
                  </button>
                  <button
                    onClick={() => setVincularSubTab('mapa')}
                    className={`sub-tab-btn ${vincularSubTab === 'mapa' ? 'active' : ''}`}
                  >
                    <MapPin size={16} /> Mapa
                  </button>
                </div>

                <div className="vincular-scroll-content">
                  {vincularSubTab === 'lista' && (
                    <div className="flex-col gap-6">
                      <div className="flex gap-4 items-center flex-wrap">
                        <div className="search-bar-container">
                          <div className="search-bar" style={{ flex: 1, marginBottom: 0, width: '100%' }}>
                            <SearchIcon size={18} style={{ opacity: 0.5 }} />
                            <input className="search-input" placeholder="Filtrar por nome..." value={searchParticipant} onChange={e => setSearchParticipant(e.target.value)} />
                          </div>
                          {searchParticipant && (
                            <button className="btn-clear-input" onClick={() => setSearchParticipant('')}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <div className="search-bar-container">
                          <div className="search-bar" style={{ flex: 1, marginBottom: 0, width: '100%' }}>
                            <MapPin size={18} style={{ opacity: 0.5 }} />
                            <input className="search-input" placeholder="Filtrar por bairro..." value={neighborhoodFilter} onChange={e => setNeighborhoodFilter(e.target.value)} />
                          </div>
                          {neighborhoodFilter && (
                            <button className="btn-clear-input" onClick={() => setNeighborhoodFilter('')}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* New Filters Row */}
                      <div className="flex gap-4 items-center mb-4" style={{ flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input type="checkbox" checked={hideLinkedToSelected} onChange={e => setHideLinkedToSelected(e.target.checked)} />
                          Ocultar vinculados a esta dupla
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input type="checkbox" checked={showOnlyUnmapped} onChange={e => setShowOnlyUnmapped(e.target.checked)} />
                          Apenas sem coordenadas
                        </label>
                      </div>

                      <div className="link-cards-grid">
                        {participantes
                          .filter(p => {
                            const q = normalizeString(searchParticipant);
                            const n = normalizeString(neighborhoodFilter);
                            const nameMatch = normalizeString(p.pessoas?.nome_completo || '').includes(q);
                            const neighborhoodMatch = normalizeString(p.pessoas?.bairro || '').includes(n);

                            const vinculo = vinculos.find(v => v.participacao_id === p.id && !v.visitante);
                            const isLinkedToSelected = vinculo?.grupo_id === selectedGrupoId;
                            const isUnmapped = !p.pessoas?.latitude || !p.pessoas?.longitude;

                            if (hideLinkedToSelected && isLinkedToSelected) return false;
                            if (showOnlyUnmapped && !isUnmapped) return false;

                            return nameMatch && neighborhoodMatch;
                          })
                          .sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''))
                          .map(p => {
                            const vinculo = vinculos.find(v => v.participacao_id === p.id && !v.visitante);
                            return (
                              <div key={p.id} className={`item-link-card compact ${vinculo ? 'linked' : ''} ${vinculo?.grupo_id === selectedGrupoId ? 'selected' : ''} ${vinculo && vinculo.grupo_id !== selectedGrupoId ? 'busy' : ''}`}>
                                <div className="item-link-card-info" style={{ flex: 1 }}>
                                  <h4 className="item-link-card-name">{p.pessoas?.nome_completo}</h4>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span className="item-link-card-address">
                                      {p.pessoas?.endereco}{p.pessoas?.numero ? `, ${p.pessoas.numero}` : ''} - {p.pessoas?.bairro || 'Sem Bairro'}
                                    </span>
                                    <a
                                      href={
                                        p.pessoas?.latitude && p.pessoas?.longitude
                                          ? `https://www.google.com/maps/search/?api=1&query=${p.pessoas.latitude},${p.pessoas.longitude}`
                                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.pessoas?.endereco || ''}, ${p.pessoas?.numero || ''}, ${p.pessoas?.bairro || ''}, Franca, SP`)}`
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover-opacity"
                                      title="Abrir no Google Maps"
                                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink size={12} /> Ver no Mapa
                                    </a>
                                  </div>
                                </div>

                                <div className="item-link-card-actions">
                                  {!vinculo ? (
                                    <button
                                      onClick={() => handleVincular(p.id)}
                                      disabled={isLoading || !selectedGrupoId}
                                      className="btn-primary-sm btn-icon"
                                      title={selectedGrupoId ? 'Vincular' : 'Selecione uma Dupla'}
                                    >
                                      <Link2 size={18} />
                                    </button>
                                  ) : (
                                    vinculo.grupo_id === selectedGrupoId ? (
                                      <button
                                        onClick={() => handleDesvincular(vinculo.id)}
                                        className="btn-outline-danger-sm btn-icon"
                                        title="Desvincular"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    ) : (
                                      <div className="busy-badge" title={`Vinculado em ${vinculo.visita_grupos?.nome}`}>
                                        <Lock size={16} />
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>
                  )}

                  {vincularSubTab === 'buscar' && (
                    <div className="flex-col gap-6">
                      <div className="card-glass" style={{ padding: '2rem', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 0.5rem' }}>Busca Rápida</h3>
                        <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1.5rem' }}>Busque por nome, e-mail ou telefone para vincular à dupla <strong>{currentGrupo?.nome}</strong></p>
                        <div className="search-bar-container" style={{ width: '100%' }}>
                          <div className="search-bar-large">
                            <SearchIcon size={24} />
                            <input
                              autoFocus
                              placeholder="Ex: joao@email.com ou 16 99999..."
                              value={searchParticipant}
                              onChange={e => setSearchParticipant(e.target.value)}
                            />
                          </div>
                          {searchParticipant && (
                            <button className="btn-clear-input" onClick={() => setSearchParticipant('')}>
                              <X size={20} />
                            </button>
                          )}
                        </div>

                        {/* New Filters Row for Search Tab */}
                        <div className="flex gap-4 items-center justify-center mt-4" style={{ marginTop: '16px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input type="checkbox" checked={hideLinkedToSelected} onChange={e => setHideLinkedToSelected(e.target.checked)} />
                            Ocultar vinculados a esta dupla
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input type="checkbox" checked={showOnlyUnmapped} onChange={e => setShowOnlyUnmapped(e.target.checked)} />
                            Apenas sem coordenadas
                          </label>
                        </div>
                      </div>

                      <div className="link-cards-grid">
                        {searchResults
                          .filter(item => item.status !== 'visitor_here')
                          .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                          .map(item => (
                            <div key={item.id} className={`item-link-card compact ${item.status === 'in_this_group' ? 'selected' : ''} ${item.status === 'in_other_group' ? 'busy' : ''}`}>
                              <div className="item-link-card-info" style={{ flex: 1 }}>
                                <span className="item-link-card-name">{item.nome}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span className="item-link-card-address" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                    {(() => {
                                      const p = participantes.find(p => p.id === item.id);
                                      return p ? `${p.pessoas?.endereco || ''}${p.pessoas?.numero ? `, ${p.pessoas.numero}` : ''}${p.pessoas?.bairro ? ` - ${p.pessoas.bairro}` : ''}` : '';
                                    })()}
                                  </span>
                                  {(() => {
                                    const p = participantes.find(p => p.id === item.id);
                                    if (!p?.pessoas?.endereco) return null;
                                    return (
                                      <a
                                        href={
                                          p.pessoas?.latitude && p.pessoas?.longitude
                                            ? `https://www.google.com/maps/search/?api=1&query=${p.pessoas.latitude},${p.pessoas.longitude}`
                                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.pessoas?.endereco || ''}, ${p.pessoas?.numero || ''}, ${p.pessoas?.bairro || ''}, Franca, SP`)}`
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover-opacity"
                                        title="Abrir no Google Maps"
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 600, textDecoration: 'none' }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink size={12} /> Maps
                                      </a>
                                    );
                                  })()}
                                </div>
                                <div className="item-link-card-status-compact">
                                  {item.status === 'in_other_group' && <span className="busy-text">Ocupado: {item.grupoNome}</span>}
                                  {item.status === 'in_this_group' && <span className="selected-text">Vinculado aqui</span>}
                                </div>
                              </div>
                              <div className="item-link-card-actions">
                                {item.status === 'available' && (
                                  <button onClick={() => handleVincular(item.id)} disabled={isLoading || !selectedGrupoId} className="btn-primary-sm btn-icon">
                                    <Link2 size={18} />
                                  </button>
                                )}
                                {item.status === 'in_this_group' && item.vinculoId && (
                                  <button onClick={() => handleDesvincular(item.vinculoId!)} disabled={isLoading} className="btn-outline-danger-sm btn-icon">
                                    <Trash2 size={18} />
                                  </button>
                                )}
                                {item.status === 'in_other_group' && (
                                  <div className="busy-badge">
                                    <Lock size={16} />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {vincularSubTab === 'mapa' && (
                    <EncontristaMap
                      participantes={participantes}
                      vinculos={vinculos}
                      selectedGrupoId={selectedGrupoId}
                      onVincular={handleVincular}
                      onDesvincular={handleDesvincular}
                      onShowUnmappedClick={() => {
                        setShowOnlyUnmapped(true);
                        setVincularSubTab('lista');
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitoramento' && (
          <div className="flex-col gap-6">
            <div className="monitoramento-grid">
              <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
                <div style={{ background: 'var(--primary-color)15', color: 'var(--primary-color)', padding: '0.75rem', borderRadius: '10px' }}><Users size={20} /></div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Total Participantes</p>
                  <h3 style={{ margin: 0 }}>{stats.totalP}</h3>
                </div>
              </div>
              <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #10b981' }}>
                <div style={{ background: '#10b98115', color: '#10b981', padding: '0.75rem', borderRadius: '10px' }}><Check size={20} /></div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Visitas Realizadas</p>
                  <h3 style={{ margin: 0 }}>{stats.realizada}</h3>
                </div>
              </div>
              <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ background: '#f59e0b15', color: '#f59e0b', padding: '0.75rem', borderRadius: '10px' }}><Loader size={20} /></div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Visitas Pendentes</p>
                  <h3 style={{ margin: 0 }}>{stats.pendente}</h3>
                </div>
              </div>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Progresso Geral</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 700 }}>{Math.round(stats.percent)}%</span>
                </div>
                <div style={{ height: '6px', background: 'var(--secondary-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.percent}%`, height: '100%', background: 'var(--primary-color)' }} />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dupla</th>
                      <th>Visitantes</th>
                      <th>Participantes</th>
                      <th>Progresso</th>
                      <th>Status Relatado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitoramentoGrupos.map(g => (
                      <tr key={g.id}>
                        <td><span style={{ fontWeight: 600 }}>{g.nome}</span></td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {g.visitantes.map(v => (
                              <span key={v.id} style={{
                                fontSize: '0.75rem',
                                background: 'color-mix(in srgb, var(--primary-color) 15%, transparent)',
                                color: 'var(--primary-color)',
                                fontWeight: 600,
                                padding: '4px 10px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <Shield size={12} />
                                {v.participacoes?.pessoas?.nome_completo?.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td><span style={{ fontSize: '0.9rem' }}>{g.membrosVisita.length} pessoas</span></td>
                        <td style={{ width: '160px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ flex: 1, height: '8px', background: 'var(--secondary-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${g.progresso}%`, height: '100%', background: '#10b981', transition: 'width 0.5s ease-in-out' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, width: '30px' }}>{Math.round(g.progresso)}%</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {g.membrosVisita.map(m => (
                              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{m.participacoes?.pessoas?.nome_completo?.split(' ')[0]}:</span>
                                {getStatusBadge(m.status)}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
