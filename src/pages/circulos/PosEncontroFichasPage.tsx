import { Bike, Camera, Car, Check, CheckSquare, ChevronLeft, ChevronRight, Copy, FileText, ImagePlus, Loader, Music, Share2, Sparkles, Square, UserCheck, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionStepper, type ActionStep } from '../../components/ui/ActionStepper';
import { GroupedDropdown } from '../../components/ui/GroupedDropdown';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { circuloService } from '../../services/circuloService';
import { equipeService } from '../../services/equipeService';
import { posEncontroService } from '../../services/posEncontroService';
import type { Circulo } from '../../types/circulo';
import type { Equipe } from '../../types/equipe';
import type { PosEncontroParticipanteCirculo } from '../../types/posEncontro';
import { compressImage } from '../../utils/imageHelper';
import { findBestTeamMatch } from '../../utils/stringSimilarity';

export function PosEncontroFichasPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeCirculoId = searchParams.get('circuloId');
  const routeEncontroId = searchParams.get('encontroId');
  const { encontros, encontroAtivo } = useEncontros();
  const { hasPermission, userParticipacao } = useAuth();
  const [selectedEncontroId, setSelectedEncontroId] = useState(routeEncontroId ?? '');
  const [circulos, setCirculos] = useState<Circulo[]>([]);
  const [selectedCirculoId, setSelectedCirculoId] = useState<number | ''>(
    routeCirculoId && Number.isFinite(Number(routeCirculoId)) ? Number(routeCirculoId) : ''
  );
  const [participantes, setParticipantes] = useState<PosEncontroParticipanteCirculo[]>([]);
  const [isLoadingParticipantes, setIsLoadingParticipantes] = useState(false);
  const canChooseCirculo = hasPermission('modulo_circulos_coordenador') || hasPermission('modulo_admin');
  const isMediatorOnly = hasPermission('modulo_circulos_mediador') && !canChooseCirculo;

  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [selectedParticipantForFicha, setSelectedParticipantForFicha] = useState<PosEncontroParticipanteCirculo | null>(null);

  // Modal de compartilhamento de link
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const shareUrl = selectedCirculoId && selectedEncontroId
    ? `${window.location.origin}/pos-encontro/circulo/${selectedCirculoId}?encontro=${selectedEncontroId}`
    : '';

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  };

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
  const [isScanningFoto, setIsScanningFoto] = useState(false);
  const [isPhotoActionSheetOpen, setIsPhotoActionSheetOpen] = useState(false);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const scanCameraInputRef = useRef<HTMLInputElement>(null);


  const handleSelectTeamDropdown = (teamId: string, index: number) => {
    const newPrefs = [...fichaDraft.preferencias];
    newPrefs[index] = teamId;

    setFichaDraft(prev => ({ ...prev, preferencias: newPrefs }));

    // Avança de forma inteligente
    if (newPrefs.every(p => p !== '')) {
      setSubStep(4);
    } else {
      const firstEmptyIndex = newPrefs.findIndex(p => p === '');
      setSubStep(firstEmptyIndex !== -1 ? firstEmptyIndex + 1 : 4);
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

  // Lógica para carregar os participantes e suas fichas
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
    loadFichasParticipantes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEncontroId, selectedCirculoId]);

  const openFichaStepper = async (participant: PosEncontroParticipanteCirculo) => {
    let currentParticipant = participant;

    if (!participant.ficha) {
      try {
        const data = await posEncontroService.listarParticipantesCirculo(selectedEncontroId, selectedCirculoId as number);
        setParticipantes(data);
        const fresh = data.find(p => p.participacao.id === participant.participacao.id);
        if (fresh) {
          currentParticipant = fresh;
          if (fresh.ficha) {
            toast.success('Esta ficha já foi preenchida no banco de dados e foi carregada para visualização.');
          }
        }
      } catch (err) {
        console.error('Erro ao verificar preenchimento recente da ficha:', err);
      }
    }

    setSelectedParticipantForFicha(currentParticipant);
    setStepperStep(1);

    if (currentParticipant.ficha) {
      const pEquipes = currentParticipant.ficha.pos_encontro_ficha_equipes || [];
      const sortedPref = [...pEquipes].sort((a, b) => a.ordem_preferencia - b.ordem_preferencia);
      const prefIds = [
        sortedPref.find(p => p.ordem_preferencia === 1)?.equipe_id ?? '',
        sortedPref.find(p => p.ordem_preferencia === 2)?.equipe_id ?? '',
        sortedPref.find(p => p.ordem_preferencia === 3)?.equipe_id ?? '',
      ];

      setFichaDraft({
        toca_instrumento: currentParticipant.ficha.toca_instrumento,
        instrumentos: currentParticipant.ficha.instrumentos ?? '',
        tem_carro: currentParticipant.ficha.tem_carro,
        tem_moto: currentParticipant.ficha.tem_moto,
        observacoes: currentParticipant.ficha.observacoes ?? '',
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

  const handleScanFoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsPhotoActionSheetOpen(false);
    const file = event.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Lendo ficha física com IA...');
    setIsScanningFoto(true);

    try {
      // 1. Comprime a imagem no navegador usando Canvas para alta velocidade
      const base64Image = await compressImage(file);

      // 2. Envia para a Supabase Edge Function
      const data = await posEncontroService.processarFotoFicha(base64Image);

      if (!data) {
        throw new Error('A inteligência artificial não retornou dados estruturados.');
      }

      // 3. Mapeia as equipes extraídas pela IA para os IDs das equipes cadastradas no banco
      const mappedPrefs = ['', '', ''];
      if (Array.isArray(data.preferencias)) {
        data.preferencias.forEach((prefName, index) => {
          if (index < 3 && prefName) {
            const matchedId = findBestTeamMatch(prefName, equipes);
            if (matchedId) {
              mappedPrefs[index] = matchedId;
            }
          }
        });
      }

      // 4. Atualiza o estado da ficha com os dados extraídos
      setFichaDraft({
        toca_instrumento: data.toca_instrumento ?? false,
        instrumentos: data.instrumentos ?? '',
        tem_carro: data.tem_carro ?? false,
        tem_moto: data.tem_moto ?? false,
        observacoes: data.observacoes ?? '',
        preferencias: mappedPrefs,
      });

      // Se as 3 preferências foram preenchidas com sucesso, avança o subStep do Stepper para 4 (pronto para salvar)
      const filledCount = mappedPrefs.filter(Boolean).length;
      setSubStep(filledCount === 3 ? 4 : filledCount + 1);
      
      // Abre a primeira aba do stepper para revisão
      setStepperStep(1);

      toast.success('Ficha lida com sucesso! Revise os dados e salve.', { id: loadingToast });
    } catch (err: unknown) {
      console.error('Erro ao escanear foto da ficha:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error(errorMessage || 'Erro ao processar imagem da ficha física.', { id: loadingToast });
    } finally {
      setIsScanningFoto(false);
      // Limpa o input do arquivo para permitir nova seleção do mesmo arquivo se necessário
      event.target.value = '';
    }
  };

  const handlePhotoAreaClick = () => {
    if (isScanningFoto) return;
    if (window.innerWidth <= 768) {
      setIsPhotoActionSheetOpen(true);
    } else {
      scanFileInputRef.current?.click();
    }
  };


  useEffect(() => {
    if (routeEncontroId) {
      setSelectedEncontroId(routeEncontroId);
    } else if (!selectedEncontroId) {
      setSelectedEncontroId(encontroAtivo?.id ?? encontros[encontros.length - 1]?.id ?? '');
    }
  }, [encontroAtivo, encontros, routeEncontroId, selectedEncontroId]);

  useEffect(() => {
    if (routeCirculoId) {
      const parsed = Number(routeCirculoId);
      if (Number.isFinite(parsed)) setSelectedCirculoId(parsed);
    }
  }, [routeCirculoId]);

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
    if (!selectedCirculoId && circulos.length > 0) {
      setSelectedCirculoId(circulos[0].id);
    }
  }, [circulos, selectedCirculoId]);

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

  const getDropdownOptions = (currentIndex: number) => {
    return equipes.map((eq) => {
      const isSelectedElsewhere = fichaDraft.preferencias.some(
        (prefId, idx) => prefId === eq.id && idx !== currentIndex
      );
      return {
        value: eq.id,
        label: eq.nome ?? '',
        disabled: isSelectedElsewhere,
      };
    });
  };

  const subSteps: ActionStep[] = [0, 1, 2].map((index) => {
    const eqId = fichaDraft.preferencias[index];
    const eq = equipes.find((e) => e.id === eqId);
    const label = `${index + 1}ª Opção`;

    return {
      id: `opt${index + 1}`,
      title: label,
      status: subStep === index + 1 ? 'current' : eqId ? 'completed' : 'pending',
      summary: eq ? <span>{eq.nome}</span> : undefined,
      onEdit: () => {
        setFichaDraft(prev => {
          const prefs = [...prev.preferencias];
          prefs[index] = '';
          return { ...prev, preferencias: prefs };
        });
        setSubStep(index + 1);
      },
      editLabel: 'Alterar',
      children: (
        <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <GroupedDropdown
            value={fichaDraft.preferencias[index]}
            onChange={(val) => handleSelectTeamDropdown(val, index)}
            items={getDropdownOptions(index)}
            placeholder="Selecione uma equipe..."
          />
        </div>
      ),
    };
  });

  return (
    <main className="main-content container fade-in" style={{ paddingBottom: '4rem' }}>
      <PageHeader
        title="Ficha Pós-Encontro"
        subtitle="Círculos"
        onBack={() => navigate('/circulos/pos-encontros')}
        actions={(
          <div className="pos-encontro-header-context">
            <span>{selectedEncontro?.edicao ? `${selectedEncontro.edicao}º EJC` : selectedEncontro?.nome ?? 'Encontro'}</span>
            <strong>{selectedCirculo?.nome ?? 'Círculo'}</strong>
          </div>
        )}
      />

      <section className="pos-encontro-page">


        <section className="pos-encontro-list-section">
          <div className="pos-encontro-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-color)' }}>Fichas Pós-Encontro do Círculo</h2>
              <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
                Preencha as informações pós-encontro de cada encontrista.
              </p>
            </div>
            {selectedCirculoId && selectedEncontroId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowShareModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}
              >
                <Share2 size={15} />
                Compartilhar Ficha
              </button>
            )}
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
      </section>

      {/* Modal de Compartilhar Link */}
      {showShareModal && (
        <div className="ficha-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="ficha-modal-container" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <header className="ficha-modal-header">
              <div>
                <span className="ficha-modal-eyebrow">Link de Acesso Público</span>
                <h3>Compartilhar Ficha do Círculo</h3>
              </div>
              <button type="button" className="ficha-modal-close" onClick={() => setShowShareModal(false)}>
                <X size={20} />
              </button>
            </header>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
              <p style={{ fontSize: '0.875rem', opacity: 0.7, textAlign: 'center', margin: 0 }}>
                Envie este link ou QR Code no grupo do círculo. Cada encontrista acessa com seu próprio nome + data de nascimento + últimos 4 dígitos do telefone.
              </p>

              {/* QR Code */}
              <div style={{ padding: '1rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
                <QRCodeSVG
                  value={shareUrl}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#1e293b"
                  level="M"
                />
              </div>

              {/* Link copiável */}
              <div className="share-link-wrapper">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{ flex: 1, padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', fontSize: '0.75rem', color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  {linkCopiado ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                </button>
              </div>

              <p style={{ fontSize: '0.72rem', opacity: 0.5, textAlign: 'center', margin: 0 }}>
                ⏱ O token de acesso do encontrista expira em 24 horas após o login.
              </p>
            </div>
          </div>
        </div>
      )}

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
 
            {/* Banner de escaneamento com Inteligência Artificial */}
            <div className="ficha-scan-banner">
              <div className="scan-banner-info">
                <Sparkles size={16} className="scan-icon-sparkles" />
                <span>Preencha mais rápido tirando foto da ficha física de papel</span>
              </div>
              <button
                type="button"
                className="btn-scan-ia"
                disabled={isScanningFoto}
                onClick={handlePhotoAreaClick}
              >
                {isScanningFoto ? (
                  <>
                    <Loader className="animate-spin" size={14} style={{ marginRight: '4px' }} />
                    Lendo...
                  </>
                ) : (
                  <>
                    <Camera size={14} style={{ marginRight: '4px' }} />
                    Escanear Ficha
                  </>
                )}
              </button>
              <input
                ref={scanFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleScanFoto}
                hidden
              />
              <input
                ref={scanCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScanFoto}
                hidden
              />
            </div>

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
                      <p className="text-muted">Selecione as 3 opções de equipe de sua preferência.</p>
                    </div>
                  </div>

                  <div className="ficha-substepper-container" style={{ marginBottom: '1.25rem' }}>
                    <ActionStepper steps={subSteps} orientation="vertical" />
                  </div>

                  {subStep <= 3 && !fichaDraft.preferencias[subStep - 1] && (
                    <p style={{ color: 'var(--accent-color)', fontSize: '0.82rem', marginTop: '0.25rem', fontWeight: 600 }}>
                      * Por favor, selecione uma equipe acima para avançar.
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

      {isPhotoActionSheetOpen && (
        <div className="photo-actions-modal-overlay" onClick={() => setIsPhotoActionSheetOpen(false)}>
          <div className="photo-actions-modal" onClick={(event) => event.stopPropagation()}>
            <div className="photo-actions-header">
              <h3>Ler ficha física</h3>
              <p>Como você deseja enviar a imagem?</p>
            </div>
            <div className="photo-actions-buttons">
              <button
                type="button"
                className="photo-action-btn"
                onClick={() => {
                  setIsPhotoActionSheetOpen(false);
                  scanCameraInputRef.current?.click();
                }}
              >
                <Camera size={20} />
                Tirar Foto (Câmera)
              </button>
              <button
                type="button"
                className="photo-action-btn"
                onClick={() => {
                  setIsPhotoActionSheetOpen(false);
                  scanFileInputRef.current?.click();
                }}
              >
                <ImagePlus size={20} />
                Escolher da Galeria
              </button>
            </div>
            <button type="button" className="photo-actions-cancel" onClick={() => setIsPhotoActionSheetOpen(false)}>
              Cancelar
            </button>
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

        .pos-encontro-list-section {
          display: grid;
          gap: 1rem;
        }

        .photo-actions-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 99999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: fadeIn 0.2s ease-out;
        }

        .photo-actions-modal {
          background: var(--card-bg, #ffffff);
          width: 100%;
          max-width: 500px;
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          padding: 1.5rem;
          box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .photo-actions-header {
          text-align: center;
        }

        .photo-actions-header h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-color);
        }

        .photo-actions-header p {
          margin: 0.25rem 0 0;
          font-size: 0.85rem;
          color: var(--text-color);
          opacity: 0.7;
        }

        .photo-actions-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .photo-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: var(--secondary-bg, #f8f9fa);
          color: var(--text-color);
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .photo-action-btn:hover {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
        }

        .photo-actions-cancel {
          padding: 0.75rem;
          border-radius: 12px;
          border: none;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .photo-actions-cancel:hover {
          background: #ef4444;
          color: white;
        }

        @media (min-width: 640px) {
          .photo-actions-modal-overlay {
            align-items: center;
          }

          .photo-actions-modal {
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
            animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
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
          margin-top: -16px;
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

        /* Stepper Modal Footer */
        .ficha-modal-footer {
          padding: 1rem;
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

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
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

          .pos-encontro-card-header {
            padding: 0;
          }

          .pos-encontro-list {
            padding: 0;
          }

          .pos-encontro-list-item {
            grid-template-columns: minmax(0, 1fr);
            gap: 0.75rem;
            padding: 0.9rem;
            padding-top: 1rem;
          }

          .pos-encontro-list-main {
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 0.75rem;
            min-width: 0;
          }

          .pos-encontro-list-main .pessoa-row-info {
            padding-right: 5rem;
            min-width: 0;
            flex: 1;
            display: block;
            width: 100%;
          }

          .pos-encontro-status-badge {
            padding: 0.15rem 0.45rem;
            font-size: 0.6rem;
            font-weight: 700;
          }

          .pos-encontro-list-main .pessoa-row-name {
            display: block;
            width: 100%;
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: break-word;
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

          .transport-options-grid {
            grid-template-columns: 1fr;
          }

          .ficha-stepper-header {
            padding: 1rem 0.5rem;
          }

          .ficha-modal-container {
            max-height: 95vh;
          }

          .ficha-modal-footer .btn {
            font-size: 80%;
          }
        }
      `}</style>
    </main>
  );
}
