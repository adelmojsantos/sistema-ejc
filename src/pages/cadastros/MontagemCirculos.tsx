import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronDown, Loader,
  Users, Shield, UserCircle, Eraser, AlertCircle,
  X,
  UserPlus, Dices, CheckSquare, Square
} from 'lucide-react';

import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { encontroService } from '../../services/encontroService';
import { circuloService } from '../../services/circuloService';
import { circuloParticipacaoService } from '../../services/circuloParticipacaoService';
import { inscricaoService } from '../../services/inscricaoService';
import { normalizeString } from '../../utils/stringUtils';

import type { Encontro } from '../../types/encontro';
import type { Circulo } from '../../types/circulo';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { CirculoParticipacaoEnriched } from '../../types/circuloParticipacao';

import { useEncontros } from '../../contexts/EncontroContext';
import { useEquipes } from '../../contexts/EquipeContext';

/* ------------------------------------------------------------------ */

interface MediadorSlot {
  value: string;   // participacao ID
  label: string;   // nome da pessoa
}

/* ------------------------------------------------------------------ */

export function MontagemCirculos() {
  const navigate = useNavigate();
  const { encontros, encontroAtivo } = useEncontros();
  const { equipes } = useEquipes();

  // ── Data ──────────────────────────────────────────────────────────
  const [circulos, setCirculos] = useState<Circulo[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [vinculos, setVinculos] = useState<CirculoParticipacaoEnriched[]>([]);

  // ── UI ───────────────────────────────────────────────────────────
  const [isLoadingCirculos, setIsLoadingCirculos] = useState(true);
  const [isFetchingVinculos, setIsFetchingVinculos] = useState(false);
  const [openCirculoId, setOpenCirculoId] = useState<number | null>(null);

  // Mediadores (por círculo aberto — reset ao mudar)
  const [mediador1, setMediador1] = useState<MediadorSlot | null>(null);
  const [mediador2, setMediador2] = useState<MediadorSlot | null>(null);
  const [isSavingMediadores, setIsSavingMediadores] = useState(false);

  // Sorteio Aleatório
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [selectedLotteryCirculos, setSelectedLotteryCirculos] = useState<number[]>([]);
  const [isProcessingLottery, setIsProcessingLottery] = useState(false);

  // Operações pontuais (add/remove participante)
  const [isOperating, setIsOperating] = useState(false);

  // ── Equipe círculo: busca inteligente e prioritária ──────────────
  const equipeCirculoId = useMemo(() => {
    if (!equipes.length) return null;

    // 1. Prioridade Máxima: Nome exato (ex: "Círculos" ou "Circulo")
    const exactMatch = equipes.find(e => {
      const n = normalizeString(e.nome || '');
      return n === 'circulos' || n === 'circulo';
    });
    if (exactMatch) return exactMatch.id;

    // 2. Segunda Prioridade: Começa com (ex: "Círculos - Equipe")
    const startsWithMatch = equipes.find(e =>
      normalizeString(e.nome || '').startsWith('circulo')
    );
    if (startsWithMatch) return startsWithMatch.id;

    // 3. Fallback: Contém a palavra em qualquer lugar
    return equipes.find(e =>
      normalizeString(e.nome || '').includes('circulo')
    )?.id ?? null;
  }, [equipes]);

  // ── Seleciona encontro ativo por padrão ───────────────────────────
  useEffect(() => {
    if (encontroAtivo && !selectedEncontroId) {
      setSelectedEncontroId(encontroAtivo.id);
    } else if (encontros.length > 0 && !selectedEncontroId) {
      // Fallback para o último se nenhum estiver ativo
      setSelectedEncontroId(encontros[encontros.length - 1].id);
    }
  }, [encontroAtivo, encontros, selectedEncontroId]);

  // ── Carrega círculos globais (uma única vez) ──────────────────────
  useEffect(() => {
    async function loadCirculos() {
      setIsLoadingCirculos(true);
      try {
        setCirculos(await circuloService.listar());
      } catch {
        toast.error('Erro ao carregar círculos.');
      } finally {
        setIsLoadingCirculos(false);
      }
    }
    loadCirculos();
  }, []);

  // ── Carrega/recarrega vínculos do encontro ────────────────────────
  const reloadVinculos = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsFetchingVinculos(true);
    try {
      const v = await circuloParticipacaoService.listarPorEncontro(selectedEncontroId);
      setVinculos(v ?? []);
    } catch {
      toast.error('Erro ao carregar vínculos.');
    } finally {
      setIsFetchingVinculos(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => { reloadVinculos(); }, [reloadVinculos]);

  // Ao carregar círculos, seleciona todos para o sorteio por padrão
  useEffect(() => {
    if (circulos.length > 0) {
      setSelectedLotteryCirculos(circulos.map(c => c.id));
    }
  }, [circulos]);

  // Reset mediadores ao trocar o círculo aberto
  useEffect(() => {
    setMediador1(null);
    setMediador2(null);
  }, [openCirculoId]);

  // ── Derivados ─────────────────────────────────────────────────────
  /** IDs de participacao já vinculados a qualquer círculo */
  const occupiedIds = useMemo(
    () => new Set(vinculos.map(v => v.participacao)),
    [vinculos]
  );

  const mediadoresPorCirculo = useMemo(() => {
    const map = new Map<number, CirculoParticipacaoEnriched[]>();
    vinculos.filter(v => v.mediador).forEach(v => {
      map.set(v.circulo_id, [...(map.get(v.circulo_id) ?? []), v]);
    });
    return map;
  }, [vinculos]);

  const participantesPorCirculo = useMemo(() => {
    const map = new Map<number, CirculoParticipacaoEnriched[]>();
    vinculos.filter(v => !v.mediador).forEach(v => {
      map.set(v.circulo_id, [...(map.get(v.circulo_id) ?? []), v]);
    });
    return map;
  }, [vinculos]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleDefinirMediadores = async (circuloId: number) => {
    if (!mediador1 || !mediador2) return;
    if (mediador1.value === mediador2.value) {
      toast.error('Selecione pessoas diferentes para os dois mediadores.');
      return;
    }
    if (occupiedIds.has(mediador1.value) || occupiedIds.has(mediador2.value)) {
      toast.error('Um dos selecionados já está vinculado a um círculo.');
      return;
    }
    setIsSavingMediadores(true);
    try {
      await Promise.all([
        circuloParticipacaoService.vincular(mediador1.value, circuloId, true),
        circuloParticipacaoService.vincular(mediador2.value, circuloId, true),
      ]);
      setMediador1(null);
      setMediador2(null);
      await reloadVinculos();
      toast.success('Mediadores definidos!');
    } catch {
      toast.error('Erro ao definir mediadores.');
    } finally {
      setIsSavingMediadores(false);
    }
  };

  const handleAddParticipante = async (participacaoId: string, circuloId: number) => {
    if (occupiedIds.has(participacaoId)) {
      toast.error('Este encontrista já está vinculado a um círculo.');
      return;
    }
    setIsOperating(true);
    try {
      await circuloParticipacaoService.vincular(participacaoId, circuloId, false);
      await reloadVinculos();
      toast.success('Encontrista adicionado!');
    } catch {
      toast.error('Erro ao adicionar encontrista.');
    } finally {
      setIsOperating(false);
    }
  };

  const handleDesvincular = async (vinculoId: string) => {
    setIsOperating(true);
    try {
      await circuloParticipacaoService.desvincular(vinculoId);
      await reloadVinculos();
      toast.success('Removido com sucesso!');
    } catch {
      toast.error('Erro ao remover.');
    } finally {
      setIsOperating(false);
    }
  };

  const handleLimparCirculo = async (circuloId: number) => {
    if (!selectedEncontroId) return;
    setIsOperating(true);
    try {
      await circuloParticipacaoService.removerPorCirculoEEncontro(circuloId, selectedEncontroId);
      await reloadVinculos();
      toast.success('Círculo limpo neste encontro.');
    } catch {
      toast.error('Erro ao limpar o círculo.');
    } finally {
      setIsOperating(false);
    }
  };

  const handleRandomAssignment = async () => {
    if (!selectedEncontroId || selectedLotteryCirculos.length === 0) return;

    setIsProcessingLottery(true);
    try {
      // 1. Buscar todos os participantes do encontro
      const allParticipants = await inscricaoService.listarParticipantesPorEncontro(selectedEncontroId);

      // 2. Filtrar apenas os que não estão vinculados
      const available = allParticipants.filter(p => !occupiedIds.has(p.id));

      if (available.length === 0) {
        toast.error('Todos os participantes já estão vinculados!');
        return;
      }

      // 3. Embaralhar (Fisher-Yates)
      const shuffled = [...available];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // 4. Distribuir entre os círculos selecionados
      const assignments: any[] = [];
      const numCircles = selectedLotteryCirculos.length;

      shuffled.forEach((p, index) => {
        const circuloId = selectedLotteryCirculos[index % numCircles];
        assignments.push({
          participacao: p.id,
          circulo_id: circuloId,
          mediador: false
        });
      });

      // 5. Salvar em massa
      await circuloParticipacaoService.vincularMuitos(assignments);

      toast.success(`${assignments.length} participantes distribuídos aleatoriamente!`);
      setShowLotteryModal(false);
      reloadVinculos();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao realizar atribuição aleatória aos círculos.');
    } finally {
      setIsProcessingLottery(false);
    }
  };

  const toggleCirculo = (id: number) =>
    setOpenCirculoId(prev => (prev === id ? null : id));

  // ── Render helpers ────────────────────────────────────────────────
  const renderOccupiedBadge = (id: string, currentMediadorValue?: string) => {
    if (id === currentMediadorValue)
      return <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 700, marginLeft: '0.5rem', flexShrink: 0 }}>Já selecionado</span>;
    if (occupiedIds.has(id))
      return <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 700, marginLeft: '0.5rem', flexShrink: 0 }}>Já vinculado</span>;
    return null;
  };

  // ── JSX ───────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <main className="main-content container" style={{ paddingBottom: '4rem' }}>

        {/* ── Header ── */}
        <div className="page-header" style={{
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => navigate('/circulos')}
              className="icon-btn"
              aria-label="Voltar"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Montagem — Círculos</h1>
              {isFetchingVinculos && (
                <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Loader size={12} className="animate-spin" /> Atualizando...
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ minWidth: '220px', maxWidth: '300px', flex: '1' }}>
              <LiveSearchSelect<Encontro>
                value={selectedEncontroId}
                onChange={(val) => { setSelectedEncontroId(val); setOpenCirculoId(null); }}
                fetchData={async (search, page) => encontroService.buscarComPaginacao(search, page)}
                getOptionLabel={(e) => `${e.nome}${e.ativo ? ' (Ativo)' : ''}`}
                getOptionValue={(e) => String(e.id)}
                placeholder="Selecione um Encontro..."
                initialOptions={encontros}
              />
            </div>

            {selectedEncontroId && (
              <button
                onClick={() => setShowLotteryModal(true)}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  height: '44px',
                  padding: '0 1rem'
                }}
                title="Atribuição Aleatória aos Círculos"
              >
                <Dices size={20} />
                <span className="hide-mobile">Atribuição Aleatória</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Modal de Sorteio ── */}
        {showLotteryModal && (
          <div className="card fade-in" style={{
            marginBottom: '1.5rem',
            padding: '1.25rem',
            border: '1px solid var(--primary-color)',
            backgroundColor: 'var(--card-bg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Dices className="text-primary" /> Distribuição Aleatória
              </h3>
              <button className="icon-btn" onClick={() => setShowLotteryModal(false)}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--muted-text)' }}>
              Selecione quais círculos participarão da distribuição aleatória. Os participantes não vinculados serão divididos igualmente entre eles.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              {circulos.map(c => {
                const isSelected = selectedLotteryCirculos.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedLotteryCirculos(prev =>
                        isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                      );
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      padding: '0.85rem',
                      borderRadius: '12px',
                      border: '2px solid',
                      borderColor: isSelected ? 'var(--success-border)' : 'var(--border-color)',
                      backgroundColor: isSelected ? 'var(--success-bg)' : 'var(--card-bg)',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      height: '100%',
                      minHeight: '64px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: isSelected ? 'var(--success-border)' : 'inherit' }}>
                      {isSelected ? <CheckSquare size={22} /> : <Square size={22} style={{ opacity: 0.5 }} />}
                    </div>
                    <span style={{
                      fontWeight: isSelected ? 600 : 500,
                      fontSize: '0.92rem',
                      lineHeight: '1.2',
                      color: isSelected ? 'var(--success-border)' : 'inherit'
                    }}>
                      {c.nome}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowLotteryModal(false)}>Cancelar</button>
              <button
                className="btn-primary"
                disabled={selectedLotteryCirculos.length === 0 || isProcessingLottery}
                onClick={handleRandomAssignment}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isProcessingLottery ? <Loader className="animate-spin" size={18} /> : <Dices size={18} />}
                Realizar Distribuição
              </button>
            </div>
          </div>
        )}


        {/* ── Loading inicial ── */}
        {isLoadingCirculos && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: '1rem', opacity: 0.6 }}>
            <Loader size={32} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
            <span style={{ fontWeight: 500 }}>Carregando círculos...</span>
          </div>
        )}

        {/* ── Sem encontro selecionado ── */}
        {!isLoadingCirculos && !selectedEncontroId && (
          <div className="empty-state">
            <AlertCircle size={40} style={{ opacity: 0.4 }} />
            <p>Selecione um encontro para gerenciar os círculos.</p>
          </div>
        )}

        {/* ── Lista vazia ── */}
        {!isLoadingCirculos && selectedEncontroId && circulos.length === 0 && (
          <div className="empty-state">
            <Users size={40} style={{ opacity: 0.3 }} />
            <p>Nenhum círculo cadastrado globalmente.</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-text)' }}>Cadastre os círculos na aba "Cadastros" do módulo.</p>
          </div>
        )}

        {/* ── Accordion list ── */}
        {!isLoadingCirculos && selectedEncontroId && circulos.length > 0 && (
          <div className="mc-circles-list">
            {circulos.map(circulo => {
              const mediadores = mediadoresPorCirculo.get(circulo.id) ?? [];
              const participantes = participantesPorCirculo.get(circulo.id) ?? [];
              const isOpen = openCirculoId === circulo.id;
              const hasMediadores = mediadores.length >= 2;

              return (
                <article
                  key={circulo.id}
                  className={`mc-accordion-card${isOpen ? ' mc-accordion-card--open' : ''}`}
                >
                  {/* ── Card Header ── */}
                  <button
                    className="mc-accordion-card__header"
                    onClick={() => toggleCirculo(circulo.id)}
                    aria-expanded={isOpen}
                    aria-controls={`mc-body-${circulo.id}`}
                  >
                    <div className="mc-accordion-card__header-left">
                      <div className={`mc-circulo-icon${hasMediadores ? ' mc-circulo-icon--active' : ''}`}>
                        <Users size={15} />
                      </div>
                      <span className="mc-accordion-card__name">{circulo.nome}</span>
                    </div>
                    <div className="mc-accordion-card__header-right">
                      <span className="mc-badge mc-badge--mediator" title="Mediadores">
                        <Shield size={11} />
                        {mediadores.length}/2
                      </span>
                      <span className="mc-badge mc-badge--participant" title="Encontristas">
                        <UserCircle size={11} />
                        {participantes.length}
                      </span>
                      <ChevronDown
                        size={17}
                        className="mc-accordion-chevron"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                      />
                    </div>
                  </button>

                  {/* ── Card Body: renderização condicional — elimina content bleeding */}
                  {isOpen && (
                    <div
                      className="mc-accordion-card__content"
                      id={`mc-body-${circulo.id}`}
                      role="region"
                    >

                      {/* ── MEDIADORES ── */}
                      <section className="mc-section" aria-labelledby={`mc-med-${circulo.id}`}>
                        <p className="mc-section-label" id={`mc-med-${circulo.id}`}>
                          <Shield size={12} />
                          Mediadores
                        </p>

                        {hasMediadores ? (
                          /* 2 mediadores definidos — mostrar chips */
                          <div className="mc-chips-row">
                            {mediadores.map(v => (
                              <span key={v.id} className="mc-chip mc-chip--mediator">
                                <Shield size={12} />
                                {v.participacoes?.pessoas?.nome_completo ?? '—'}
                                <button
                                  className="mc-chip__remove"
                                  onClick={() => handleDesvincular(v.id)}
                                  disabled={isOperating}
                                  title="Remover mediador"
                                  aria-label={`Remover ${v.participacoes?.pessoas?.nome_completo}`}
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          /* Seleção dos 2 mediadores */
                          <>
                            <div className="mc-mediator-slots">
                              <div className="mc-mediator-slot">
                                <label className="mc-slot-label" htmlFor={`med1-${circulo.id}`}>
                                  Mediador 1
                                </label>
                                <LiveSearchSelect<InscricaoEnriched>
                                  value={mediador1?.value ?? ''}
                                  onChange={(val, item) => {
                                    if (!val) { setMediador1(null); return; }
                                    if (occupiedIds.has(val)) {
                                      toast.error('Esta pessoa já está vinculada a um círculo.');
                                      return;
                                    }
                                    if (val === mediador2?.value) {
                                      toast.error('Já selecionado como Mediador 2.');
                                      return;
                                    }
                                    setMediador1(item ? { value: val, label: item.pessoas?.nome_completo ?? val } : null);
                                  }}
                                  fetchData={(busca, pag) =>
                                    equipeCirculoId
                                      ? inscricaoService.buscarEncontreirosDaEquipePorNome(selectedEncontroId, equipeCirculoId, busca, pag, 10)
                                      : Promise.resolve([])
                                  }
                                  getOptionLabel={item => item.pessoas?.nome_completo ?? '—'}
                                  getOptionValue={item => item.id}
                                  renderOption={item => (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                      <span>{item.pessoas?.nome_completo}</span>
                                      {renderOccupiedBadge(item.id, mediador2?.value)}
                                    </div>
                                  )}
                                  placeholder={equipeCirculoId ? 'Buscar mediador...' : 'Equipe círculo não encontrada'}
                                  disabled={!equipeCirculoId || isSavingMediadores}
                                />
                              </div>

                              <div className="mc-mediator-slot">
                                <label className="mc-slot-label" htmlFor={`med2-${circulo.id}`}>
                                  Mediador 2
                                </label>
                                <LiveSearchSelect<InscricaoEnriched>
                                  value={mediador2?.value ?? ''}
                                  onChange={(val, item) => {
                                    if (!val) { setMediador2(null); return; }
                                    if (occupiedIds.has(val)) {
                                      toast.error('Esta pessoa já está vinculada a um círculo.');
                                      return;
                                    }
                                    if (val === mediador1?.value) {
                                      toast.error('Já selecionado como Mediador 1.');
                                      return;
                                    }
                                    setMediador2(item ? { value: val, label: item.pessoas?.nome_completo ?? val } : null);
                                  }}
                                  fetchData={(busca, pag) =>
                                    equipeCirculoId
                                      ? inscricaoService.buscarEncontreirosDaEquipePorNome(selectedEncontroId, equipeCirculoId, busca, pag, 10)
                                      : Promise.resolve([])
                                  }
                                  getOptionLabel={item => item.pessoas?.nome_completo ?? '—'}
                                  getOptionValue={item => item.id}
                                  renderOption={item => (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                      <span>{item.pessoas?.nome_completo}</span>
                                      {renderOccupiedBadge(item.id, mediador1?.value)}
                                    </div>
                                  )}
                                  placeholder={equipeCirculoId ? 'Buscar mediador...' : 'Equipe círculo não encontrada'}
                                  disabled={!equipeCirculoId || isSavingMediadores}
                                />
                              </div>
                            </div>

                            <div className="mc-mediator-actions">
                              <button
                                onClick={() => handleDefinirMediadores(circulo.id)}
                                disabled={!mediador1 || !mediador2 || isSavingMediadores}
                                className="btn-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', height: '40px' }}
                              >
                                {isSavingMediadores
                                  ? <><Loader size={15} className="animate-spin" /> Salvando...</>
                                  : <><UserPlus size={15} /> Definir Mediadores</>
                                }
                              </button>
                            </div>
                          </>
                        )}
                      </section>

                      {/* ── ENCONTRISTAS ── */}
                      <section className="mc-section" aria-labelledby={`mc-part-${circulo.id}`}>
                        <p className="mc-section-label" id={`mc-part-${circulo.id}`}>
                          <UserCircle size={12} />
                          Encontristas
                        </p>

                        {/* Search (sempre visível) */}
                        <div className="mc-add-participant">
                          <LiveSearchSelect<InscricaoEnriched>
                            value=""
                            onChange={(val) => {
                              if (!val) return;
                              handleAddParticipante(val, circulo.id);
                            }}
                            fetchData={(busca, pag) =>
                              inscricaoService.buscarParticipantesPorNome(selectedEncontroId, busca, pag, 10)
                            }
                            getOptionLabel={item => item.pessoas?.nome_completo ?? '—'}
                            getOptionValue={item => item.id}
                            renderOption={item => {
                              const isOccupied = occupiedIds.has(item.id);
                              const isHere = participantes.some(p => p.participacao === item.id);
                              return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', opacity: (isOccupied && !isHere) ? 0.6 : 1 }}>
                                  <span>{item.pessoas?.nome_completo}</span>
                                  {isHere && <span style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 700, marginLeft: '0.5rem', flexShrink: 0 }}>Neste círculo</span>}
                                  {isOccupied && !isHere && <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 700, marginLeft: '0.5rem', flexShrink: 0 }}>Outro círculo</span>}
                                </div>
                              );
                            }}
                            placeholder="Buscar e adicionar encontrista..."
                            disabled={isOperating}
                          />
                        </div>

                        {/* Chips dos participantes já vinculados */}
                        {participantes.length > 0 && (
                          <div className="mc-participants-chips">
                            {participantes.map(v => (
                              <span key={v.id} className="mc-chip mc-chip--participant">
                                {v.participacoes?.pessoas?.nome_completo ?? '—'}
                                <button
                                  className="mc-chip__remove"
                                  onClick={() => handleDesvincular(v.id)}
                                  disabled={isOperating}
                                  title="Remover do círculo"
                                  aria-label={`Remover ${v.participacoes?.pessoas?.nome_completo}`}
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {participantes.length === 0 && (
                          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted-text)', fontStyle: 'italic' }}>
                            Nenhum encontrista vinculado a este círculo ainda.
                          </p>
                        )}
                      </section>

                      {/* ── Footer — Limpar ── */}
                      {(mediadores.length > 0 || participantes.length > 0) && (
                        <div className="mc-card-footer">
                          <button
                            onClick={() => handleLimparCirculo(circulo.id)}
                            disabled={isOperating}
                            className="btn-danger"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
                            title={`Remover todos os vínculos deste círculo no encontro atual`}
                          >
                            <Eraser size={14} />
                            Limpar círculo neste encontro
                          </button>
                        </div>
                      )}

                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
