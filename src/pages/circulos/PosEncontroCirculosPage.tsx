import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CalendarCheck, CheckSquare, Paperclip, Square, Music, Car, FileText, ChevronRight, ChevronLeft, UserCheck, X, Bike } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { ActionStepper, type ActionStep } from '../../components/ui/ActionStepper';
import { circuloService } from '../../services/circuloService';
import { posEncontroService } from '../../services/posEncontroService';
import { equipeService } from '../../services/equipeService';
import type { Circulo } from '../../types/circulo';
import type { PosEncontro, PosEncontroParticipanteCirculo, PosEncontroRealizacao, PosEncontroStatus } from '../../types/posEncontro';
import type { Equipe } from '../../types/equipe';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';

const formatFileSize = (size?: number | null) => {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

const htmlToText = (html?: string | null) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

const formatEncontroOption = (encontro: { nome?: string | null; edicao?: number | null; tema?: string | null }) => {
  const edicaoLabel = encontro.edicao ? `${encontro.edicao}º EJC` : '';
  const nome = encontro.nome?.trim() ?? '';
  const nomeSemEdicao = edicaoLabel && nome.toLowerCase() === edicaoLabel.toLowerCase() ? '' : nome;
  const titulo = [edicaoLabel, nomeSemEdicao].filter(Boolean).join(' - ') || nome || 'Encontro';
  return encontro.tema ? `${titulo} • ${encontro.tema}` : titulo;
};

const getAcessoColor = (acesso?: string | null) => {
  if (acesso === 'verde') return '#10b981'; // Green
  if (acesso === 'amarela') return '#eab308'; // Yellow
  if (acesso === 'vermelha') return '#ef4444'; // Red
  return '#64748b'; // Slate default
};

const getEquipeInitials = (nome?: string | null) => {
  if (!nome) return 'EQ';
  const parts = nome.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nome.substring(0, 2).toUpperCase();
};

export function PosEncontroCirculosPage() {
  const navigate = useNavigate();
  const { id: routePosId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const routeCirculoId = searchParams.get('circuloId');
  const { encontros, encontroAtivo } = useEncontros();
  const { hasPermission, userParticipacao } = useAuth();
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const [posEncontros, setPosEncontros] = useState<PosEncontro[]>([]);
  const [selectedPosId, setSelectedPosId] = useState('');
  const [circulos, setCirculos] = useState<Circulo[]>([]);
  const [selectedCirculoId, setSelectedCirculoId] = useState<number | ''>('');
  const [realizacoesPorPos, setRealizacoesPorPos] = useState<Record<string, PosEncontroRealizacao | null>>({});
  const [realizacaoDraft, setRealizacaoDraft] = useState({ data_realizada: '', observacoes: '', status: 'pendente' as PosEncontroStatus });
  const [participantes, setParticipantes] = useState<PosEncontroParticipanteCirculo[]>([]);
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isLoadingParticipantes, setIsLoadingParticipantes] = useState(false);
  const [isSavingPresencas, setIsSavingPresencas] = useState(false);
  const [isNoPresenceDialogOpen, setIsNoPresenceDialogOpen] = useState(false);
  const canChooseCirculo = hasPermission('modulo_circulos_coordenador') || hasPermission('modulo_admin');
  const isMediatorOnly = hasPermission('modulo_circulos_mediador') && !canChooseCirculo;
  const isDetailRoute = !!routePosId;

  // Estados adicionados para a Ficha Pós-Encontro
  const [showFichasView, setShowFichasView] = useState(false);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [selectedParticipantForFicha, setSelectedParticipantForFicha] = useState<PosEncontroParticipanteCirculo | null>(null);

  // Stepper Modal State
  const [stepperStep, setStepperStep] = useState(1);
  const [subStep, setSubStep] = useState(1);
  const [fichaDraft, setFichaDraft] = useState({
    toca_instrumento: null as boolean | null,
    instrumentos: '',
    tem_carro: false,
    tem_moto: false,
    observacoes: '',
    preferencias: ['', '', ''] // 1ª, 2ª, 3ª opções (equipe_id)
  });
  const [isSavingFicha, setIsSavingFicha] = useState(false);

  const handleSelectTeamCard = (teamId: string) => {
    setFichaDraft(prev => {
      const prefs = [...prev.preferencias];
      prefs[subStep - 1] = teamId;
      return { ...prev, preferencias: prefs };
    });
    if (subStep < 3) {
      setSubStep(prev => prev + 1);
    } else {
      setSubStep(4);
    }
  };

  // Carregar Equipes Ativas
  useEffect(() => {
    async function loadEquipes() {
      try {
        const data = await equipeService.listar();
        setEquipes(data.filter(eq => eq.aparece_pos_encontro !== false));
      } catch (error) {
        console.error('Erro ao carregar equipes:', error);
      }
    }
    loadEquipes();
  }, []);

  // Lógica para carregar os participantes e suas fichas no modo Ficha
  const loadFichasParticipantes = async () => {
    if (!selectedEncontroId || !selectedCirculoId) return;
    setIsLoadingParticipantes(true);
    try {
      const data = await posEncontroService.listarParticipantesCirculo(selectedEncontroId, selectedCirculoId as number);
      setParticipantes(data);
    } catch (error) {
      console.error('Erro ao carregar participantes para as fichas:', error);
      toast.error('Não foi possível carregar os encontristas.');
    } finally {
      setIsLoadingParticipantes(false);
    }
  };

  useEffect(() => {
    if (showFichasView) {
      loadFichasParticipantes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFichasView, selectedEncontroId, selectedCirculoId]);

  const openFichaStepper = (participant: PosEncontroParticipanteCirculo) => {
    setSelectedParticipantForFicha(participant);
    setStepperStep(1);

    if (participant.ficha) {
      const pEquipes = participant.ficha.pos_encontro_ficha_equipes || [];
      const sortedPref = [...pEquipes].sort((a, b) => a.ordem_preferencia - b.ordem_preferencia);
      const prefIds = [
        sortedPref.find(p => p.ordem_preferencia === 1)?.equipe_id ?? '',
        sortedPref.find(p => p.ordem_preferencia === 2)?.equipe_id ?? '',
        sortedPref.find(p => p.ordem_preferencia === 3)?.equipe_id ?? '',
      ];

      setFichaDraft({
        toca_instrumento: participant.ficha.toca_instrumento,
        instrumentos: participant.ficha.instrumentos ?? '',
        tem_carro: participant.ficha.tem_carro,
        tem_moto: participant.ficha.tem_moto,
        observacoes: participant.ficha.observacoes ?? '',
        preferencias: prefIds
      });
      setSubStep(prefIds.filter(Boolean).length === 3 ? 4 : 1);
    } else {
      setFichaDraft({
        toca_instrumento: null,
        instrumentos: '',
        tem_carro: false,
        tem_moto: false,
        observacoes: '',
        preferencias: ['', '', '']
      });
      setSubStep(1);
    }
  };

  const handleSaveFicha = async () => {
    if (!selectedParticipantForFicha) return;

    const activePrefs = fichaDraft.preferencias.filter(Boolean);
    if (activePrefs.length !== 3) {
      toast.error('As 3 opções de equipe devem ser obrigatoriamente preenchidas.');
      return;
    }
    const uniquePrefs = new Set(activePrefs);
    if (activePrefs.length !== uniquePrefs.size) {
      toast.error('Você não pode escolher a mesma equipe em mais de uma opção de preferência.');
      return;
    }

    setIsSavingFicha(true);
    try {
      const payload = {
        encontro_id: selectedEncontroId,
        participacao_id: selectedParticipantForFicha.participacao.id,
        toca_instrumento: !!fichaDraft.toca_instrumento,
        instrumentos: fichaDraft.toca_instrumento ? (fichaDraft.instrumentos.trim() || null) : null,
        tem_carro: fichaDraft.tem_carro,
        tem_moto: fichaDraft.tem_moto,
        observacoes: fichaDraft.observacoes.trim() || null,
      };

      const preferenciasPayload = fichaDraft.preferencias
        .map((equipeId, index) => ({
          equipe_id: equipeId,
          ordem_preferencia: index + 1
        }))
        .filter(p => p.equipe_id);

      await posEncontroService.salvarFicha(payload, preferenciasPayload);
      toast.success('Ficha Pós-Encontro salva com sucesso!');

      setSelectedParticipantForFicha(null);
      await loadFichasParticipantes();
    } catch (error) {
      console.error('Erro ao salvar ficha:', error);
      toast.error('Não foi possível salvar a ficha pós-encontro.');
    } finally {
      setIsSavingFicha(false);
    }
  };

  useEffect(() => {
    if (isDetailRoute) return;
    if (!selectedEncontroId) {
      setSelectedEncontroId(encontroAtivo?.id ?? encontros[encontros.length - 1]?.id ?? '');
    }
  }, [encontroAtivo, encontros, isDetailRoute, selectedEncontroId]);

  useEffect(() => {
    if (!routeCirculoId || isMediatorOnly) return;
    const parsed = Number(routeCirculoId);
    if (Number.isFinite(parsed)) setSelectedCirculoId(parsed);
  }, [isMediatorOnly, routeCirculoId]);

  useEffect(() => {
    if (!routePosId) {
      setSelectedPosId('');
      return;
    }
    const posId = routePosId;

    async function loadRoutePos() {
      try {
        const pos = await posEncontroService.obterPorId(posId);
        if (!pos) {
          toast.error('Pós-encontro não encontrado.');
          navigate('/circulos/pos-encontros', { replace: true });
          return;
        }

        setSelectedEncontroId(pos.encontro_id);
        setSelectedPosId(pos.id);
        setPosEncontros((current) => current.some((item) => item.id === pos.id) ? current : [pos, ...current]);
      } catch (error) {
        console.error('Erro ao carregar pós-encontro:', error);
        toast.error('Não foi possível carregar o pós-encontro.');
      }
    }

    loadRoutePos();
  }, [navigate, routePosId]);

  useEffect(() => {
    async function loadCirculos() {
      try {
        if (isMediatorOnly) {
          if (!userParticipacao?.id) {
            setCirculos([]);
            setSelectedCirculoId('');
            return;
          }

          const circulosMediador = await posEncontroService.listarCirculosDoMediador(userParticipacao.id);
          setCirculos(circulosMediador.map((circulo) => ({
            id: circulo.id,
            nome: circulo.nome ?? 'Círculo',
            imagem_url: null,
            created_at: '',
            deleted_at: null,
          })));
          setSelectedCirculoId((current) => circulosMediador.some((circulo) => circulo.id === current) ? current : circulosMediador[0]?.id ?? '');
          return;
        }

        setCirculos(await circuloService.listar());
      } catch (error) {
        console.error('Erro ao carregar círculos:', error);
        toast.error('Não foi possível carregar os círculos.');
      }
    }

    loadCirculos();
  }, [isMediatorOnly, userParticipacao?.id]);

  useEffect(() => {
    if (!selectedEncontroId) return;

    async function loadPos() {
      setIsLoadingBase(true);
      try {
        const data = await posEncontroService.listarPorEncontro(selectedEncontroId, true);
        setPosEncontros(data);
        setSelectedPosId((current) => {
          if (routePosId) return data.some((item) => item.id === routePosId) ? routePosId : current;
          return data.some((item) => item.id === current) ? current : '';
        });
      } catch (error) {
        console.error('Erro ao carregar pós-encontros:', error);
        toast.error('Não foi possível carregar os pós-encontros.');
      } finally {
        setIsLoadingBase(false);
      }
    }

    loadPos();
  }, [routePosId, selectedEncontroId]);

  useEffect(() => {
    if (!selectedCirculoId && circulos.length > 0) {
      setSelectedCirculoId(circulos[0].id);
    }
  }, [circulos, selectedCirculoId]);

  useEffect(() => {
    if (!selectedCirculoId || posEncontros.length === 0) {
      setRealizacoesPorPos({});
      return;
    }

    const circuloId = selectedCirculoId;

    async function loadRealizacoes() {
      try {
        const entries = await Promise.all(
          posEncontros.map(async (pos) => [
            pos.id,
            await posEncontroService.obterRealizacao(pos.id, circuloId)
          ] as const)
        );
        setRealizacoesPorPos(Object.fromEntries(entries));
      } catch (error) {
        console.error('Erro ao carregar status dos pós-encontros:', error);
        toast.error('Não foi possível carregar os status dos pós-encontros.');
      }
    }

    loadRealizacoes();
  }, [posEncontros, selectedCirculoId]);

  const selectedPos = useMemo(
    () => posEncontros.find((item) => item.id === selectedPosId) ?? null,
    [posEncontros, selectedPosId]
  );

  const selectedEncontro = useMemo(
    () => encontros.find((encontro) => encontro.id === selectedEncontroId) ?? null,
    [encontros, selectedEncontroId]
  );

  const selectedCirculo = useMemo(
    () => circulos.find((circulo) => circulo.id === selectedCirculoId) ?? null,
    [circulos, selectedCirculoId]
  );

  const participantesOrdenados = useMemo(
    () => [...participantes].sort((a, b) => {
      const nomeA = a.participacao.pessoas?.nome_completo ?? '';
      const nomeB = b.participacao.pessoas?.nome_completo ?? '';
      return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
    }),
    [participantes]
  );

  useEffect(() => {
    if (!isDetailRoute || isMediatorOnly || !routePosId) return;
    if (routeCirculoId) return;

    toast.error('Selecione um círculo antes de abrir o pós-encontro.');
    navigate('/circulos/pos-encontros', { replace: true });
  }, [isDetailRoute, isMediatorOnly, navigate, routeCirculoId, routePosId]);

  const loadOperacional = async () => {
    if (!selectedEncontroId || !selectedPosId || !selectedCirculoId) return;

    setIsLoadingParticipantes(true);
    try {
      const currentRealizacao = await posEncontroService.obterRealizacao(selectedPosId, selectedCirculoId);
      setRealizacoesPorPos((current) => ({ ...current, [selectedPosId]: currentRealizacao }));
      setRealizacaoDraft({
        data_realizada: currentRealizacao?.data_realizada ?? '',
        observacoes: currentRealizacao?.observacoes ?? '',
        status: currentRealizacao?.status ?? 'pendente',
      });

      const data = await posEncontroService.listarParticipantesCirculo(selectedEncontroId, selectedCirculoId, currentRealizacao?.id);
      setParticipantes(data);
      setPresencas(Object.fromEntries(data.map((item) => [item.participacao.id, !!item.presenca?.presente])));
    } catch (error) {
      console.error('Erro ao carregar realização do pós-encontro:', error);
      toast.error('Não foi possível carregar os dados do círculo.');
    } finally {
      setIsLoadingParticipantes(false);
    }
  };

  useEffect(() => {
    loadOperacional();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEncontroId, selectedPosId, selectedCirculoId]);

  const saveRealizacaoCompleta = async () => {
    setIsSavingPresencas(true);
    try {
      const savedRealizacao = await posEncontroService.salvarRealizacao({
        pos_encontro_id: selectedPosId,
        circulo_id: selectedCirculoId as number,
        data_realizada: realizacaoDraft.data_realizada,
        observacoes: realizacaoDraft.observacoes.trim() || null,
        status: 'realizado',
      });

      await posEncontroService.salvarPresencas(
        savedRealizacao.id,
        participantes.map((item) => ({
          participacao_id: item.participacao.id,
          presente: !!presencas[item.participacao.id],
          observacao: item.presenca?.observacao ?? null,
        }))
      );

      toast.success('Pós-Encontro salvo.');
      await loadOperacional();
    } catch (error) {
      console.error('Erro ao salvar pós-encontro:', error);
      toast.error('Não foi possível salvar o Pós-Encontro.');
    } finally {
      setIsSavingPresencas(false);
    }
  };

  const handleSaveRealizacaoCompleta = async () => {
    if (!realizacaoDraft.data_realizada) {
      toast.error('Informe a Data do Pós-Encontro.');
      return;
    }

    if (participantes.length === 0) {
      toast.error('Não há encontristas vinculados a este círculo.');
      return;
    }

    if (presentesCount === 0) {
      setIsNoPresenceDialogOpen(true);
      return;
    }

    await saveRealizacaoCompleta();
  };

  const presentesCount = Object.values(presencas).filter(Boolean).length;
  const saveHint = !realizacaoDraft.data_realizada
    ? 'Informe a Data do Pós-Encontro para salvar.'
    : participantes.length === 0
      ? 'Não há encontristas vinculados a este círculo.'
      : presentesCount === 0
        ? 'Nenhuma presença marcada. Ao salvar, será solicitada uma confirmação.'
        : '';
  const subSteps: ActionStep[] = [0, 1, 2].map((index) => {
    const eqId = fichaDraft.preferencias[index];
    const eq = equipes.find((e) => e.id === eqId);
    const label = `${index + 1}ª Opção`;

    return {
      id: `opt${index + 1}`,
      title: label,
      status: subStep === index + 1 ? 'current' : eqId ? 'completed' : 'pending',
      summary: eq ? <span>{eq.nome}</span> : undefined,
      onEdit: () => setSubStep(index + 1),
      editLabel: 'Alterar',
      children: (
        <div className="equipe-cards-grid">
          {equipes.map(eq => {
            const isSelected = fichaDraft.preferencias[subStep - 1] === eq.id;
            const selectedIndex = fichaDraft.preferencias.indexOf(eq.id);
            const isSelectedElsewhere = selectedIndex !== -1 && selectedIndex !== subStep - 1;
            const initials = getEquipeInitials(eq.nome);
            const bgAcesso = getAcessoColor(eq.acesso_plenario);

            return (
              <button
                key={eq.id}
                type="button"
                disabled={isSelectedElsewhere}
                className={`equipe-card-option ${isSelected ? 'selected' : ''} ${isSelectedElsewhere ? 'disabled' : ''}`}
                onClick={() => handleSelectTeamCard(eq.id)}
              >
                <div className="equipe-card-avatar" style={{ backgroundColor: bgAcesso }}>
                  {initials}
                </div>
                <div className="equipe-card-info">
                  <strong>{eq.nome}</strong>
                  {isSelectedElsewhere && (
                    <span className="equipe-card-badge-elsewhere">
                      Selecionada na {selectedIndex + 1}ª opção
                    </span>
                  )}
                </div>
                {isSelected && (
                  <span className="equipe-card-check">✓</span>
                )}
              </button>
            );
          })}
        </div>
      ),
    };
  });

  const pageTitle = isDetailRoute && selectedPos ? `${selectedPos.ordem}º Pós-Encontro` : 'Pós-Encontro';
  const pageSubtitle = isDetailRoute && selectedPos
    ? selectedPos.tema ?? selectedPos.titulo
    : 'Círculos';

  return (
    <main className="main-content container fade-in" style={{ paddingBottom: '4rem' }}>
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        onBack={() => navigate(isDetailRoute ? '/circulos/pos-encontros' : '/circulos')}
        actions={isDetailRoute ? (
          <div className="pos-encontro-header-context">
            <span>{selectedEncontro?.edicao ? `${selectedEncontro.edicao}º EJC` : selectedEncontro?.nome ?? 'Encontro'}</span>
            <strong>{selectedCirculo?.nome ?? 'Círculo'}</strong>
          </div>
        ) : isMediatorOnly ? (
          <strong className="pos-encontro-header-circle-name">
            {selectedCirculo?.nome ?? 'Nenhum círculo vinculado'}
          </strong>
        ) : undefined}
      />

      <section className="pos-encontro-page">

        {!isDetailRoute && !isMediatorOnly && (
          <div className="card pos-encontro-filters">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Encontro</label>
              <select className="form-input" value={selectedEncontroId} onChange={(event) => setSelectedEncontroId(event.target.value)}>
                {encontros.map((encontro) => (
                  <option key={encontro.id} value={encontro.id}>
                    {formatEncontroOption(encontro)}
                  </option>
                ))}
              </select>
            </div>

            {canChooseCirculo && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Círculo</label>
                <select className="form-input" value={selectedCirculoId} onChange={(event) => setSelectedCirculoId(Number(event.target.value))}>
                  {circulos.map((circulo) => (
                    <option key={circulo.id} value={circulo.id}>{circulo.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {!selectedPos && showFichasView && (
          <section className="pos-encontro-list-section">
            <div className="pos-encontro-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setShowFichasView(false)}
                  style={{ padding: 0, minHeight: 'auto', marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
                >
                  <ChevronLeft size={16} />
                  Voltar para Pós-Encontros
                </button>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-color)' }}>Fichas Pós-Encontro do Círculo</h2>
                <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
                  Preencha as informações pós-encontro de cada encontrista.
                </p>
              </div>
            </div>

            {isLoadingParticipantes ? (
              <div className="text-muted" style={{ padding: '1.25rem' }}>Carregando encontristas...</div>
            ) : participantes.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>Nenhum encontrista vinculado a este círculo.</div>
            ) : (
              <div className="pessoa-grid pos-encontro-list">
                {participantesOrdenados.map((item) => {
                  const pessoa = item.participacao.pessoas;
                  const ficha = item.ficha;
                  const status = ficha ? 'preenchida' : 'pendente';
                  const statusLabel = ficha ? 'Preenchida' : 'Pendente';

                  const hasMusica = ficha?.toca_instrumento;
                  const hasCarro = ficha?.tem_carro;
                  const hasMoto = ficha?.tem_moto;

                  return (
                    <article
                      key={item.participacao.id}
                      className={`pessoa-row pos-encontro-list-item status-ficha-${status}`}
                    >
                      <span className="pessoa-row-main pos-encontro-list-main">
                        <span className="pessoa-avatar small pos-encontro-list-avatar" style={{ background: ficha ? '#10b981' : '#94a3b8' }}>
                          <UserCheck size={16} />
                        </span>
                        <span className="pessoa-row-info">
                          <span className="pessoa-row-name">{pessoa?.nome_completo ?? 'Sem nome'}</span>
                          <span className="pessoa-row-sub">
                            {pessoa?.telefone ? `Telefone: ${pessoa.telefone}` : 'Sem telefone cadastrado'}
                          </span>
                        </span>
                      </span>

                      <span className="pessoa-row-col pos-encontro-list-status-col">
                        <span className={`pos-encontro-status-badge status-ficha-${status}`}>{statusLabel}</span>
                      </span>

                      <span className="pessoa-row-col pos-encontro-list-features-col" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {hasMusica && (
                          <span className="ficha-feature-badge badge-musica" title={ficha.instrumentos ?? 'Música'}>
                            <Music size={12} />
                            Música
                          </span>
                        )}
                        {hasCarro && (
                          <span className="ficha-feature-badge badge-transporte" title="Possui Carro">
                            <Car size={12} />
                            Carro
                          </span>
                        )}
                        {hasMoto && (
                          <span className="ficha-feature-badge badge-transporte" title="Possui Moto">
                            <Car size={12} />
                            Moto
                          </span>
                        )}
                        {!hasMusica && !hasCarro && !hasMoto && (
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Nenhum destaque</span>
                        )}
                      </span>

                      <button
                        className="pos-encontro-list-action"
                        type="button"
                        onClick={() => openFichaStepper(item)}
                      >
                        {ficha ? 'Editar Ficha' : 'Preencher Ficha'}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!selectedPos && !showFichasView && (
          <section className="pos-encontro-list-section">
            <div className="pos-encontro-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <strong>Pós-Encontros cadastrados</strong>
                <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
                  Escolha um pós para registrar data, observações, presenças e fichas.
                </p>
              </div>
              {selectedCirculoId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowFichasView(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <FileText size={18} />
                  Ficha Pós-Encontro
                </button>
              )}
            </div>

            {isLoadingBase ? (
              <div className="text-muted" style={{ padding: '1.25rem' }}>Carregando pós-encontros...</div>
            ) : posEncontros.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>Nenhum pós-encontro cadastrado para este encontro.</div>
            ) : !selectedCirculoId ? (
              <div className="empty-state" style={{ padding: '2rem' }}>Nenhum círculo vinculado para registrar o pós-encontro.</div>
            ) : (
              <div className="pessoa-grid pos-encontro-list">
                {posEncontros.map((pos) => {
                  const status = realizacoesPorPos[pos.id]?.status ?? 'pendente';
                  const statusLabel = status === 'realizado' ? 'Realizado' : status === 'cancelado' ? 'Cancelado' : 'Pendente';
                  const dataRealizada = realizacoesPorPos[pos.id]?.data_realizada;

                  return (
                    <article
                      key={pos.id}
                      className={`pessoa-row pos-encontro-list-item status-${status}`}
                    >
                      <span className="pessoa-row-main pos-encontro-list-main">
                        <span className="pessoa-avatar small pos-encontro-list-avatar">
                          {pos.ordem}
                        </span>
                        <span className="pessoa-row-info">
                          <span className="pessoa-row-name">{pos.ordem}º Pós-Encontro</span>
                          <span className="pessoa-row-sub">{pos.tema ?? pos.titulo}</span>
                        </span>
                      </span>

                      <span className="pessoa-row-col pos-encontro-list-status-col">
                        <span className={`pos-encontro-status-badge status-${status}`}>{statusLabel}</span>
                      </span>

                      <span className="pessoa-row-col pos-encontro-list-date-col">
                        <span className="pessoa-row-label">Data</span>
                        <span className="pessoa-row-value">
                          {dataRealizada
                            ? new Date(`${dataRealizada}T00:00:00`).toLocaleDateString('pt-BR')
                            : 'Ainda não realizada'}
                        </span>
                      </span>

                      <button
                        className="pos-encontro-list-action"
                        type="button"
                        onClick={() => navigate(`/circulos/pos-encontros/${pos.id}?circuloId=${selectedCirculoId}`)}
                      >
                        Abrir
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {selectedPos && (
          <article className="card pos-encontro-detail-card">
            <div className="pos-encontro-simple-card-header">
              <BookOpenCheck size={18} />
              <strong>Roteiro do encontro</strong>
            </div>
            {htmlToText(selectedPos.conteudo) && (
              <div
                className="pos-encontro-rich-content pos-encontro-rich-panel"
                dangerouslySetInnerHTML={{ __html: selectedPos.conteudo ?? '' }}
              />
            )}

            {selectedPos.arquivo_path && (
              <div className="pos-encontro-file-box">
                <Paperclip size={18} />
                <div>
                  <strong>{selectedPos.arquivo_nome ?? 'Roteiro anexado'}</strong>
                  {selectedPos.arquivo_tamanho ? (
                    <p className="text-muted" style={{ margin: '0.15rem 0 0' }}>{formatFileSize(selectedPos.arquivo_tamanho)}</p>
                  ) : null}
                </div>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => posEncontroService.abrirArquivoRoteiro(selectedPos)}
                >
                  Abrir roteiro
                </button>
              </div>
            )}
          </article>
        )}

        {selectedPos && (
          <div className="card pos-encontro-realizacao-card">
            <div className="pos-encontro-section-header">
              <div>
                <span className="pos-encontro-section-eyebrow">Realização do pós-encontro</span>
                <h2>Registro da reunião e presenças</h2>
              </div>
              <span className="text-muted">{presentesCount} presente(s) de {participantes.length}</span>
            </div>
            <div className="pos-encontro-participantes-panel">
              <div className="pos-encontro-participantes-header">
                <div>
                  <strong>Encontristas do círculo</strong>
                  <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>Marque quem participou deste pós-encontro.</p>
                </div>
              </div>

              {isLoadingParticipantes ? (
                <div className="text-muted" style={{ padding: '1.25rem' }}>Carregando encontristas...</div>
              ) : participantes.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>Nenhum encontrista vinculado a este círculo.</div>
              ) : (
                <div className="pos-encontro-presenca-grid">
                  {participantesOrdenados.map((item) => {
                    const participacaoId = item.participacao.id;
                    const pessoa = item.participacao.pessoas;
                    const isPresente = !!presencas[participacaoId];

                    return (
                      <button
                        key={participacaoId}
                        type="button"
                        className={`pos-encontro-presenca-card ${isPresente ? 'is-present' : ''}`}
                        onClick={() => setPresencas((current) => ({ ...current, [participacaoId]: !current[participacaoId] }))}
                        aria-pressed={isPresente}
                      >
                        <span className="pos-encontro-presenca-check">
                          {isPresente ? <CheckSquare size={21} /> : <Square size={21} />}
                        </span>
                        <span className="pos-encontro-presenca-info">
                          <strong>{pessoa?.nome_completo ?? 'Sem nome'}</strong>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="pos-encontro-realizacao-grid">
              <div className="form-group pos-encontro-date-field" style={{ margin: 0 }}>
                <label className="form-label">Data do Pós-Encontro</label>
                <input className="form-input" type="date" value={realizacaoDraft.data_realizada} onChange={(event) => setRealizacaoDraft((prev) => ({ ...prev, data_realizada: event.target.value }))} />
              </div>
              <div className="form-group pos-encontro-observacao-field" style={{ margin: 0 }}>
                <label className="form-label">Observações do círculo</label>
                <textarea className="form-input" rows={5} value={realizacaoDraft.observacoes} onChange={(event) => setRealizacaoDraft((prev) => ({ ...prev, observacoes: event.target.value }))} placeholder="Como foi a reunião?" />
              </div>
            </div>

            <div className="pos-encontro-actions">
              <div className="pos-encontro-save-group">
                {saveHint && <p className="pos-encontro-save-hint">{saveHint}</p>}
                <button className="btn btn-primary pos-encontro-save-btn" type="button" onClick={handleSaveRealizacaoCompleta} disabled={isSavingPresencas}>
                  <CalendarCheck size={18} />
                  {isSavingPresencas ? 'Salvando...' : 'Salvar Pós-Encontro'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={isNoPresenceDialogOpen}
        title="Salvar sem presenças?"
        message="A data do Pós-Encontro foi preenchida, mas nenhuma presença foi marcada. Deseja salvar mesmo assim?"
        confirmText="Salvar sem presenças"
        cancelText="Cancelar"
        onCancel={() => setIsNoPresenceDialogOpen(false)}
        onConfirm={async () => {
          setIsNoPresenceDialogOpen(false);
          await saveRealizacaoCompleta();
        }}
        isLoading={isSavingPresencas}
      />

      {selectedParticipantForFicha && (
        <div className="ficha-modal-overlay">
          <div className="ficha-modal-container">
            <header className="ficha-modal-header">
              <div>
                <span className="ficha-modal-eyebrow">Ficha Pós-Encontro</span>
                <h3>{selectedParticipantForFicha.participacao.pessoas?.nome_completo}</h3>
              </div>
              <button
                type="button"
                className="ficha-modal-close"
                onClick={() => setSelectedParticipantForFicha(null)}
              >
                <X size={20} />
              </button>
            </header>

            {/* Stepper progress indicator */}
            <div className="ficha-stepper-header">
              <div className={`ficha-stepper-step ${stepperStep === 1 ? 'active' : stepperStep > 1 ? 'completed' : ''}`}>
                <span className="step-number">{stepperStep > 1 ? '✓' : '1'}</span>
                <span className="step-label">Música</span>
              </div>
              <div className="ficha-stepper-line"></div>
              <div className={`ficha-stepper-step ${stepperStep === 2 ? 'active' : stepperStep > 2 ? 'completed' : ''}`}>
                <span className="step-number">{stepperStep > 2 ? '✓' : '2'}</span>
                <span className="step-label">Transporte</span>
              </div>
              <div className="ficha-stepper-line"></div>
              <div className={`ficha-stepper-step ${stepperStep === 3 ? 'active' : stepperStep > 3 ? 'completed' : ''}`}>
                <span className="step-number">{stepperStep > 3 ? '✓' : '3'}</span>
                <span className="step-label">Preferências</span>
              </div>
              <div className="ficha-stepper-line"></div>
              <div className={`ficha-stepper-step ${stepperStep === 4 ? 'active' : stepperStep > 4 ? 'completed' : ''}`}>
                <span className="step-number">{stepperStep > 4 ? '✓' : '4'}</span>
                <span className="step-label">Observações</span>
              </div>
            </div>

            {/* Stepper content area */}
            <div className="ficha-stepper-content">
              {stepperStep === 1 && (
                <div className="ficha-step-panel fade-in">
                  <div className="step-intro">
                    <div className="step-icon-wrapper">
                      <Music size={24} />
                    </div>
                    <div>
                      <h4>Habilidades Musicais</h4>
                      <p className="text-muted">Informe se toca algum instrumento musical.</p>
                    </div>
                  </div>

                  <div className="instrumento-toggle-box">
                    <span className="instrumento-toggle-label">Toca algum instrumento musical?</span>
                    <div className="sim-nao-toggle" style={{ margin: 0 }}>
                      <button
                        type="button"
                        className={`toggle-btn ${fichaDraft.toca_instrumento === false ? 'active-nao' : ''}`}
                        onClick={() => setFichaDraft(prev => ({ ...prev, toca_instrumento: false }))}
                      >
                        Não
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${fichaDraft.toca_instrumento === true ? 'active-sim' : ''}`}
                        onClick={() => setFichaDraft(prev => ({ ...prev, toca_instrumento: true }))}
                      >
                        Sim
                      </button>
                    </div>
                  </div>

                  {fichaDraft.toca_instrumento === null && (
                    <p style={{ color: 'var(--accent-color)', fontSize: '0.82rem', marginTop: '0.25rem', fontWeight: 600 }}>
                      * Por favor, selecione Sim ou Não para prosseguir.
                    </p>
                  )}

                  {fichaDraft.toca_instrumento === true && !fichaDraft.instrumentos.trim() && (
                    <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.25rem', fontWeight: 600 }}>
                      * Por favor, informe quais instrumentos.
                    </p>
                  )}

                  {fichaDraft.toca_instrumento && (
                    <div className="form-group fade-in">
                      <label className="form-label">Quais instrumentos?</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ex: Violão, Teclado, Bateria..."
                        value={fichaDraft.instrumentos}
                        onChange={(e) => setFichaDraft(prev => ({ ...prev, instrumentos: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              )}

              {stepperStep === 2 && (
                <div className="ficha-step-panel fade-in">
                  <div className="step-intro">
                    <div>
                      <h4>Tenho:</h4>
                      <p className="text-muted">Informe se carro ou moto.</p>
                    </div>
                  </div>

                  <div className="transport-options-grid">
                    <label className="transport-checkbox-card">
                      <input
                        type="checkbox"
                        checked={fichaDraft.tem_carro}
                        onChange={(e) => setFichaDraft(prev => ({ ...prev, tem_carro: e.target.checked }))}
                      />
                      <div className="card-content">
                        <span className="card-checkbox-indicator">
                          {fichaDraft.tem_carro ? <CheckSquare size={18} /> : <Square size={18} />}
                        </span>
                        <Car size={24} className="icon" />
                        <strong>Carro</strong>
                      </div>
                    </label>

                    <label className="transport-checkbox-card">
                      <input
                        type="checkbox"
                        checked={fichaDraft.tem_moto}
                        onChange={(e) => setFichaDraft(prev => ({ ...prev, tem_moto: e.target.checked }))}
                      />
                      <div className="card-content">
                        <span className="card-checkbox-indicator">
                          {fichaDraft.tem_moto ? <CheckSquare size={18} /> : <Square size={18} />}
                        </span>
                        <Bike size={24} className="icon" />
                        <strong>Moto</strong>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {stepperStep === 3 && (
                <div className="ficha-step-panel fade-in">
                  <div className="step-intro" style={{ marginBottom: '1rem' }}>
                    <div className="step-icon-wrapper">
                      <UserCheck size={24} />
                    </div>
                    <div>
                      <h4>Preferências de Equipe</h4>
                      <p className="text-muted">Selecione as 3 opções de equipe.</p>
                    </div>
                  </div>

                  <div className="ficha-substepper-container" style={{ marginBottom: '1.25rem' }}>
                    <ActionStepper steps={subSteps} orientation="vertical" />
                  </div>

                  {subStep <= 3 && !fichaDraft.preferencias[subStep - 1] && (
                    <p style={{ color: 'var(--accent-color)', fontSize: '0.82rem', marginTop: '0.25rem', fontWeight: 600 }}>
                      * Por favor, selecione uma equipe na grade acima para avançar.
                    </p>
                  )}
                </div>
              )}

              {stepperStep === 4 && (
                <div className="ficha-step-panel fade-in">
                  <div className="step-intro">
                    <div className="step-icon-wrapper">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4>Observações Finais</h4>
                      <p className="text-muted">Adicione um comentário ou observação.</p>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Observações</label>
                    <textarea
                      className="form-input"
                      rows={5}
                      placeholder="Comentário ou observação..."
                      value={fichaDraft.observacoes}
                      onChange={(e) => setFichaDraft(prev => ({ ...prev, observacoes: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stepper footer actions */}
            <footer className="ficha-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (stepperStep > 1) {
                    setStepperStep(prev => prev - 1);
                  } else {
                    setSelectedParticipantForFicha(null);
                  }
                }}
              >
                <ChevronLeft size={16} />
                {stepperStep === 1 ? 'Cancelar' : 'Anterior'}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={(() => {
                  if (isSavingFicha) return true;
                  if (stepperStep === 1) {
                    if (fichaDraft.toca_instrumento === null) return true;
                    if (fichaDraft.toca_instrumento === true && !fichaDraft.instrumentos.trim()) return true;
                  }
                  if (stepperStep === 3) {
                    const active = fichaDraft.preferencias.filter(Boolean);
                    return active.length !== 3;
                  }
                  return false;
                })()}
                onClick={() => {
                  if (stepperStep < 4) {
                    setStepperStep(prev => prev + 1);
                  } else {
                    handleSaveFicha();
                  }
                }}
              >
                {stepperStep === 4 ? (isSavingFicha ? 'Salvando...' : 'Salvar Ficha') : 'Próximo'}
                <ChevronRight size={16} />
              </button>
            </footer>
          </div>
        </div>
      )}

      <style>{`
        .pos-encontro-filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          align-items: end;
        }

        .pos-encontro-header-circle-name {
          align-self: flex-start;
          margin-top: 1.15rem;
          padding: 0.45rem 1.1rem;
          border: 1px solid var(--primary-color);
          border-radius: 999px;
          background: var(--primary-color);
          color: white;
          font-size: 0.9rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pos-encontro-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .pos-encontro-header-context {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
          align-self: flex-start;
          margin-top: 1.15rem;
          padding: 0.45rem 1.1rem;
          border: 1px solid var(--primary-color);
          border-radius: 999px;
          background: var(--primary-color);
          color: white;
          font-size: 0.9rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .pos-encontro-header-context strong {
          color: white;
        }

        .pos-encontro-header-context span::after {
          content: "•";
          margin-left: 0.6rem;
          opacity: 0.75;
        }

        .pos-encontro-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .pos-encontro-subtitle {
          margin: 0.35rem 0 0;
        }

        .pos-encontro-detail-card,
        .pos-encontro-realizacao-card {
          display: grid;
          gap: 1.25rem;
        }

        .pos-encontro-simple-card-header {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--primary-color);
          font-size: 0.95rem;
        }

        .pos-encontro-simple-card-header svg {
          color: #10b981;
        }

        .pos-encontro-detail-heading,
        .pos-encontro-section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .pos-encontro-detail-heading {
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .pos-encontro-detail-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: color-mix(in srgb, #10b981 14%, var(--surface-2));
          color: #10b981;
          flex-shrink: 0;
        }

        .pos-encontro-detail-heading > div:nth-child(2),
        .pos-encontro-section-header > div {
          min-width: 0;
          flex: 1;
        }

        .pos-encontro-detail-heading h2,
        .pos-encontro-section-header h2 {
          margin: 0.15rem 0 0;
          font-size: 1.15rem;
          line-height: 1.25;
          color: var(--text-color);
        }

        .pos-encontro-section-eyebrow {
          color: var(--primary-color);
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .pos-encontro-detail-badge {
          flex-shrink: 0;
        }

        .pos-encontro-list-section {
          display: grid;
          gap: 1rem;
        }

        .pos-encontro-participantes-card {
          padding: 0;
          overflow: hidden;
        }

        .pos-encontro-participantes-panel {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--surface-1);
          overflow: hidden;
        }

        .pos-encontro-card-header,
        .pos-encontro-participantes-header {
          padding: 0;
        }

        .pos-encontro-participantes-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .pos-encontro-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 0;
          margin-top: 0;
        }

        .pos-encontro-list-item {
          position: relative;
          grid-template-columns: minmax(260px, 1.4fr) minmax(120px, 0.55fr) minmax(160px, 0.75fr) auto;
          text-align: left;
          width: 100%;
          color: inherit;
        }

        .pos-encontro-list-item.status-realizado {
          border-left: 4px solid #22c55e;
        }

        .pos-encontro-list-item.status-pendente {
          border-left: 4px solid #94a3b8;
        }

        .pos-encontro-list-item.status-cancelado {
          border-left: 4px solid #ef4444;
        }

        .pos-encontro-list-item.status-realizado:hover {
          border-left-color: #22c55e;
          box-shadow: 0 2px 8px color-mix(in srgb, #22c55e 16%, transparent);
        }

        .pos-encontro-list-item.status-pendente:hover {
          border-left-color: #94a3b8;
          box-shadow: 0 2px 8px color-mix(in srgb, #94a3b8 14%, transparent);
        }

        .pos-encontro-list-item.status-cancelado:hover {
          border-left-color: #ef4444;
          box-shadow: 0 2px 8px color-mix(in srgb, #ef4444 14%, transparent);
        }

        .pos-encontro-list-main {
          min-width: 0;
        }

        .pos-encontro-list-avatar {
          background: var(--primary-color);
          color: white;
          font-weight: 800;
        }

        .pos-encontro-list-status-col {
          justify-content: center;
        }

        .pos-encontro-status-badge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          border-radius: 999px;
          padding: 0.25rem 0.65rem;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .pos-encontro-status-badge.status-realizado {
          background: color-mix(in srgb, #22c55e 18%, transparent);
          border: 1px solid color-mix(in srgb, #22c55e 45%, transparent);
          color: #22c55e;
        }

        .pos-encontro-status-badge.status-pendente {
          background: color-mix(in srgb, #94a3b8 18%, transparent);
          border: 1px solid color-mix(in srgb, #94a3b8 45%, transparent);
          color: #94a3b8;
        }

        .pos-encontro-status-badge.status-cancelado {
          background: color-mix(in srgb, #ef4444 14%, transparent);
          border: 1px solid color-mix(in srgb, #ef4444 42%, transparent);
          color: #ef4444;
        }

        .pos-encontro-list-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0.45rem 0.85rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--primary-color);
          font-size: 0.8rem;
          font-weight: 800;
          background: var(--surface-2);
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }

        .pos-encontro-list-action:hover {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: white;
        }

        .pos-encontro-inline-actions,
        .pos-encontro-actions {
          display: flex;
          justify-content: flex-end;
        }

        .pos-encontro-save-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          line-height: 1;
        }

        .pos-encontro-save-btn svg {
          flex-shrink: 0;
          display: block;
        }

        .pos-encontro-save-group {
          display: grid;
          justify-items: end;
          gap: 0.5rem;
        }

        .pos-encontro-save-hint {
          margin: 0;
          color: var(--muted-text);
          font-size: 0.85rem;
          text-align: right;
        }

        .pos-encontro-realizacao-grid {
          display: grid;
          gap: 1rem;
          align-items: start;
        }

        .pos-encontro-realizacao-grid {
          grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
        }

        .pos-encontro-date-field input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.85;
          cursor: pointer;
        }

        .pos-encontro-presenca-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 0.75rem;
          padding: 1rem;
        }

        .pos-encontro-presenca-card {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 0.75rem;
          min-height: 2rem;
          padding: 0.5rem;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: var(--card-bg);
          color: var(--text-color);
          text-align: left;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }

        .pos-encontro-presenca-card:hover {
          border-color: var(--primary-color);
          box-shadow: var(--shadow-sm);
        }

        .pos-encontro-presenca-card.is-present {
          border-color: color-mix(in srgb, #22c55e 55%, var(--border-color));
          background: color-mix(in srgb, #22c55e 10%, var(--card-bg));
        }

        .pos-encontro-presenca-check {
          display: inline-flex;
          color: var(--muted-text);
        }

        .pos-encontro-presenca-card.is-present .pos-encontro-presenca-check {
          color: #22c55e;
        }

        .pos-encontro-presenca-info {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
        }

        .pos-encontro-presenca-info strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pos-encontro-presenca-info small {
          color: var(--muted-text);
          font-weight: 700;
        }

        .pos-encontro-rich-content {
          color: var(--muted-text);
          line-height: 1.65;
        }

        .pos-encontro-rich-panel {
          padding: 1rem;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--surface-1);
        }

        .pos-encontro-rich-content p {
          margin: 0 0 0.75rem;
        }

        .pos-encontro-rich-content ul,
        .pos-encontro-rich-content ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }

        .pos-encontro-rich-content ul {
          list-style: disc;
        }

        .pos-encontro-rich-content ol {
          list-style: decimal;
        }

        .pos-encontro-rich-content h1,
        .pos-encontro-rich-content h2,
        .pos-encontro-rich-content h3 {
          color: var(--text-color);
          margin: 1rem 0 0.5rem;
          line-height: 1.2;
        }

        .pos-encontro-file-box {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--surface-1);
        }

        .pos-encontro-file-box strong {
          word-break: break-word;
        }

        /* Ficha Pós-Encontro Styles */
        .pos-encontro-list-item.status-ficha-preenchida {
          border-left: 4px solid #22c55e;
        }

        .pos-encontro-list-item.status-ficha-pendente {
          border-left: 4px solid #94a3b8;
        }

        .pos-encontro-list-item.status-ficha-preenchida:hover {
          border-left-color: #22c55e;
          box-shadow: 0 2px 8px color-mix(in srgb, #22c55e 16%, transparent);
        }

        .pos-encontro-list-item.status-ficha-pendente:hover {
          border-left-color: #94a3b8;
          box-shadow: 0 2px 8px color-mix(in srgb, #94a3b8 14%, transparent);
        }

        .pos-encontro-status-badge.status-ficha-preenchida {
          background: color-mix(in srgb, #22c55e 18%, transparent);
          border: 1px solid color-mix(in srgb, #22c55e 45%, transparent);
          color: #22c55e;
        }

        .pos-encontro-status-badge.status-ficha-pendente {
          background: color-mix(in srgb, #94a3b8 18%, transparent);
          border: 1px solid color-mix(in srgb, #94a3b8 45%, transparent);
          color: #94a3b8;
        }

        .ficha-feature-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.15rem 0.45rem;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .ficha-feature-badge.badge-musica {
          background: color-mix(in srgb, #a855f7 15%, transparent);
          border: 1px solid color-mix(in srgb, #a855f7 40%, transparent);
          color: #a855f7;
        }

        .ficha-feature-badge.badge-transporte {
          background: color-mix(in srgb, #3b82f6 15%, transparent);
          border: 1px solid color-mix(in srgb, #3b82f6 40%, transparent);
          color: #3b82f6;
        }

        .instrumento-toggle-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: var(--surface-2);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .instrumento-toggle-label {
          font-weight: 700;
          color: var(--text-color);
          font-size: 0.95rem;
        }

        .sim-nao-toggle {
          display: flex;
          background: rgba(0, 0, 0, 0.1);
          padding: 3px;
          border-radius: 8px;
          width: fit-content;
          border: 1px solid var(--border-color);
        }

        .toggle-btn {
          padding: 0.35rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          color: var(--text-color);
          opacity: 0.5;
        }

        .toggle-btn.active-sim {
          background: var(--primary-color);
          color: white;
          opacity: 1;
          box-shadow: 0 4px 12px var(--primary-color)40;
        }

        .toggle-btn.active-nao {
          background: #ef4444;
          color: white;
          opacity: 1;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .toggle-btn:hover:not(.active-sim):not(.active-nao) {
          opacity: 0.8;
          background: rgba(255, 255, 255, 0.05);
        }

        .ficha-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        .ficha-modal-container {
          background: var(--surface-1);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          width: 100%;
          max-width: 600px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .ficha-modal-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ficha-modal-eyebrow {
          color: var(--primary-color);
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .ficha-modal-header h3 {
          margin: 0.25rem 0 0;
          font-size: 1.25rem;
          color: var(--text-color);
        }

        .ficha-modal-close {
          background: transparent;
          border: none;
          color: var(--muted-text);
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, color 0.2s;
        }

        .ficha-modal-close:hover {
          background: var(--surface-2);
          color: var(--text-color);
        }

        /* Stepper Header */
        .ficha-stepper-header {
          display: flex;
          align-items: center;
          padding: 1.25rem 1.5rem;
          background: var(--surface-2);
          border-bottom: 1px solid var(--border-color);
        }

        .ficha-stepper-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          flex: 1;
          position: relative;
        }

        .ficha-stepper-step .step-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--surface-1);
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--muted-text);
          transition: all 0.25s ease;
        }

        .ficha-stepper-step .step-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--muted-text);
          transition: all 0.25s ease;
        }

        .ficha-stepper-step.active .step-number {
          border-color: var(--primary-color);
          background: var(--primary-color);
          color: white;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 25%, transparent);
        }

        .ficha-stepper-step.active .step-label {
          color: var(--primary-color);
          font-weight: 800;
        }

        .ficha-stepper-step.completed .step-number {
          border-color: #10b981;
          background: #10b981;
          color: white;
        }

        .ficha-stepper-step.completed .step-label {
          color: #10b981;
        }

        .ficha-stepper-line {
          height: 2px;
          background: var(--border-color);
          flex: 1;
          margin-top: -16px; /* align with numbers */
        }

        /* Stepper Content */
        .ficha-stepper-content {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .ficha-step-panel {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .step-intro {
          display: flex;
          gap: 1rem;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .step-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: color-mix(in srgb, var(--primary-color) 10%, var(--surface-2));
          color: var(--primary-color);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .step-intro h4 {
          margin: 0;
          font-size: 1.1rem;
          color: var(--text-color);
        }

        .step-intro p {
          margin: 0.15rem 0 0;
          font-size: 0.85rem;
        }

        /* Form modifications for Stepper */
        .form-label-checkbox {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-color);
          cursor: pointer;
          user-select: none;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: var(--surface-2);
          transition: border-color 0.2s, background 0.2s;
          width: 100%;
        }

        .form-label-checkbox:hover {
          border-color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 4%, var(--surface-2));
        }

        .form-label-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--primary-color);
          cursor: pointer;
        }

        /* Transport Grid */
        .transport-options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .transport-checkbox-card {
          cursor: pointer;
          position: relative;
        }

        .transport-checkbox-card input[type="checkbox"] {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .transport-checkbox-card .card-content {
          border: 2px solid var(--border-color);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.5rem;
          background: var(--surface-2);
          transition: all 0.2s ease;
          position: relative;
        }

        .card-checkbox-indicator {
          position: absolute;
          top: 10px;
          right: 10px;
          color: var(--muted-text);
          transition: color 0.2s;
          display: inline-flex;
        }

        .transport-checkbox-card .card-content .icon {
          color: var(--muted-text);
          transition: color 0.2s;
        }

        .transport-checkbox-card:hover .card-content {
          border-color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 4%, var(--surface-2));
        }

        .transport-checkbox-card input[type="checkbox"]:checked + .card-content {
          border-color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 10%, var(--surface-2));
          box-shadow: 0 0 0 1px var(--primary-color);
        }

        .transport-checkbox-card input[type="checkbox"]:checked + .card-content .card-checkbox-indicator {
          color: var(--primary-color);
        }

        .transport-checkbox-card input[type="checkbox"]:checked + .card-content .icon {
          color: var(--primary-color);
        }

        .transport-checkbox-card .card-content strong {
          color: var(--text-color);
          font-size: 0.95rem;
        }

        .transport-checkbox-card .card-content span {
          font-size: 0.75rem;
          color: var(--muted-text);
        }

        /* Preference selects stack */
        .preference-selects-stack {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* Equipe Card Stepper Styles */
        .equipe-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 0.75rem;
          margin-top: 0.5rem;
          margin-bottom: 1rem;
        }

        .equipe-card-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--surface-2);
          color: var(--text-color);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          position: relative;
          width: 100%;
        }

        .equipe-card-option:hover:not(.disabled) {
          border-color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 4%, var(--surface-2));
          transform: translateY(-2px);
        }

        .equipe-card-option.selected {
          border-color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 10%, var(--surface-2));
          box-shadow: 0 0 0 1px var(--primary-color);
        }

        .equipe-card-option.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: rgba(0, 0, 0, 0.05);
        }

        .equipe-card-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.8rem;
          color: white;
          flex-shrink: 0;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .equipe-card-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }

        .equipe-card-info strong {
          font-size: 0.85rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .equipe-card-badge-elsewhere {
          font-size: 0.68rem;
          color: var(--muted-text);
          font-weight: 600;
          margin-top: 0.15rem;
        }

        .equipe-card-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--primary-color);
          color: white;
          font-size: 0.7rem;
          font-weight: bold;
          flex-shrink: 0;
        }

        /* Stepper Modal Footer */
        .ficha-modal-footer {
          padding: 1.25rem 1.5rem;
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--surface-2);
        }

        .ficha-modal-footer .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 640px) {
          .pos-encontro-filters {
            grid-template-columns: 1fr;
          }

          .pos-encontro-page {
            gap: 1rem;
          }

          .pos-encontro-header-context {
            align-items: flex-start;
            flex-direction: column;
            gap: 0.2rem;
          }

          .pos-encontro-header-context span::after {
            content: "";
            margin: 0;
          }

          .pos-encontro-card-header,
          .pos-encontro-participantes-header {
            padding: 0;
          }

          .pos-encontro-detail-heading,
          .pos-encontro-section-header {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            align-items: start;
          }

          .pos-encontro-detail-badge,
          .pos-encontro-section-header .pos-encontro-status-badge {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .pos-encontro-rich-panel {
            padding: 0.85rem;
          }

          .pos-encontro-participantes-header {
            padding: 1rem;
          }

          .pos-encontro-participantes-header {
            align-items: stretch;
            flex-direction: column;
          }

          .pos-encontro-realizacao-grid {
            grid-template-columns: 1fr;
          }

          .pos-encontro-inline-actions,
          .pos-encontro-actions {
            justify-content: stretch;
          }

          .pos-encontro-inline-actions .btn,
          .pos-encontro-actions .btn,
          .pos-encontro-participantes-header .btn {
            width: 100%;
            justify-content: center;
          }

          .pos-encontro-save-group {
            justify-items: stretch;
            width: 100%;
          }

          .pos-encontro-save-hint {
            text-align: left;
          }

          .pos-encontro-list {
            padding: 0;
          }

          .pos-encontro-list-item {
            grid-template-columns: 1fr;
            gap: 0.75rem;
            padding: 0.9rem;
            padding-top: 1rem;
          }

          .pos-encontro-list-main {
            border-bottom: 1px solid var(--border-color);
            padding-right: 6.5rem;
            padding-bottom: 0.75rem;
          }

          .pos-encontro-list-status-col {
            position: absolute;
            top: 0.9rem;
            right: 0.9rem;
            min-width: 0;
          }

          .pos-encontro-list-action {
            width: 100%;
          }

          .pos-encontro-presenca-grid {
            grid-template-columns: 1fr;
            padding: 0.85rem;
          }

          .pos-encontro-file-box {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .pos-encontro-file-box .btn {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: center;
          }

          .transport-options-grid {
            grid-template-columns: 1fr;
          }

          .ficha-stepper-header {
            padding: 1rem 0.5rem;
          }

          .ficha-modal-container {
            max-height: 95vh;
          }
        }
      `}</style>
    </main>
  );
}
