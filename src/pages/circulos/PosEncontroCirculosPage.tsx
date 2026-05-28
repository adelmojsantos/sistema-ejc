import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CalendarCheck, CheckSquare, Paperclip, Square } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { circuloService } from '../../services/circuloService';
import { posEncontroService } from '../../services/posEncontroService';
import type { Circulo } from '../../types/circulo';
import type { PosEncontro, PosEncontroParticipanteCirculo, PosEncontroRealizacao, PosEncontroStatus } from '../../types/posEncontro';
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

      {!selectedPos && (
          <section className="pos-encontro-list-section">
            <div className="pos-encontro-card-header">
              <strong>Pós-Encontros cadastrados</strong>
              <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
                Escolha um pós para registrar data, observações, presenças e fichas.
              </p>
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
        }
      `}</style>
    </main>
  );
}
