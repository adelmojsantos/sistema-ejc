import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { READINESS_ITEMS, READINESS_SECTIONS, resolveReadinessItemPath } from '../../config/encounterReadiness';
import { useEncontros } from '../../contexts/EncontroContext';
import { encounterReadinessService } from '../../services/encounterReadinessService';
import type { EncounterReadinessSummary, ReadinessStatus } from '../../types/encounterReadiness';
import { buildPublicFormUrl } from '../../utils/publicFormUrl';
import './PreparacaoEncontroPage.css';

const STATUS_LABELS: Record<ReadinessStatus, string> = {
  ready: 'Pronto',
  attention: 'Atenção',
  not_configured: 'Não configurado',
};

const STATUS_ICONS = {
  ready: CheckCircle2,
  attention: AlertTriangle,
  not_configured: CircleDashed,
} as const;

export function PreparacaoEncontroPage() {
  const navigate = useNavigate();
  const { encontroSelecionado, isLoading: encontroLoading } = useEncontros();
  const [summary, setSummary] = useState<EncounterReadinessSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!encontroSelecionado?.id || !encontroSelecionado.ativo) {
      setSummary(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setSummary(await encounterReadinessService.getSummary(encontroSelecionado.id));
    } catch (loadError) {
      console.error('[Preparação do encontro] Erro ao carregar indicadores:', loadError);
      setSummary(null);
      setError('Não foi possível carregar os indicadores de preparação.');
    } finally {
      setIsLoading(false);
    }
  }, [encontroSelecionado?.ativo, encontroSelecionado?.id]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const items = useMemo(() => {
    if (!summary) return [];
    return READINESS_ITEMS.map((definition) => ({
      ...definition,
      currentStatus: definition.status(summary.metrics),
      currentStatusLabel: definition.statusLabel?.(summary.metrics),
      currentDetail: definition.detail(summary.metrics),
      currentChecklist: definition.checklist?.(summary.metrics),
    }));
  }, [summary]);

  const totals = useMemo(() => items.reduce(
    (accumulator, item) => {
      accumulator[item.currentStatus] += 1;
      return accumulator;
    },
    { ready: 0, attention: 0, not_configured: 0 } as Record<ReadinessStatus, number>
  ), [items]);

  const handleCopyPublicForm = async (itemId: string) => {
    if (!encontroSelecionado?.id) return;
    const url = buildPublicFormUrl(encontroSelecionado.id);

    try {
      await navigator.clipboard.writeText(url);
      setCopiedItem(itemId);
      toast.success('Link dos formulários copiado.');
      window.setTimeout(() => setCopiedItem((current) => current === itemId ? null : current), 2000);
    } catch (copyError) {
      console.error('[Preparação do encontro] Erro ao copiar link:', copyError);
      toast.error('Não foi possível copiar o link.');
    }
  };

  const isWaiting = encontroLoading || isLoading;

  return (
    <main className="container encounter-readiness-page">
      <PageHeader
        title="Preparação do encontro"
        subtitle="Dashboard"
        backPath="/dashboard"
        actions={encontroSelecionado?.ativo && (
          <button
            type="button"
            className="btn-secondary encounter-readiness-refresh"
            onClick={() => void loadSummary()}
            disabled={isWaiting}
          >
            <RefreshCw size={17} className={isWaiting ? 'is-spinning' : undefined} />
            <span>Atualizar</span>
          </button>
        )}
      />

      {!encontroSelecionado?.ativo && !encontroLoading && (
        <section className="card encounter-readiness-message">
          <CircleDashed size={34} />
          <div>
            <h2>Selecione o encontro ativo</h2>
            <p>O painel de preparação não avalia encontros históricos ou futuros.</p>
          </div>
        </section>
      )}

      {encontroSelecionado?.ativo && (
        <>
          <section className="card encounter-readiness-summary" aria-labelledby="readiness-summary-title">
            <div className="encounter-readiness-summary__copy">
              <span>Encontro em preparação</span>
              <h2 id="readiness-summary-title">{encontroSelecionado.nome}</h2>
              <p>Uma visão consolidada. As correções continuam sendo feitas nos módulos responsáveis.</p>
            </div>

            {summary && (
              <div className="encounter-readiness-totals" aria-label="Resumo dos indicadores">
                <div className="is-ready"><strong>{totals.ready}</strong><span>Prontos</span></div>
                <div className="is-attention"><strong>{totals.attention}</strong><span>Atenção</span></div>
                <div className="is-missing"><strong>{totals.not_configured}</strong><span>Não configurados</span></div>
              </div>
            )}
          </section>

          {isWaiting && !summary && (
            <div className="encounter-readiness-loading" role="status">
              <span />
              <span />
              <span />
            </div>
          )}

          {error && (
            <section className="card encounter-readiness-error" role="alert">
              <AlertTriangle size={21} />
              <span>{error}</span>
              <button type="button" onClick={() => void loadSummary()}>Tentar novamente</button>
            </section>
          )}

          {summary && READINESS_SECTIONS.map((section) => {
            const sectionItems = items.filter((item) => item.section === section.id);
            return (
              <section className="encounter-readiness-section" key={section.id}>
                <div className="encounter-readiness-section__heading">
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>
                </div>

                <div className="encounter-readiness-grid">
                  {sectionItems.map((item) => {
                    const ItemIcon = item.icon;
                    const StatusIcon = STATUS_ICONS[item.currentStatus];
                    const canShare = item.sharesPublicForm && summary.metrics.public_forms_published;

                    return (
                      <article className={`card encounter-readiness-card is-${item.currentStatus}`} key={item.id}>
                        <div className="encounter-readiness-card__top">
                          <span className="encounter-readiness-card__icon"><ItemIcon size={20} /></span>
                          <span className={`encounter-readiness-status is-${item.currentStatus}`}>
                            <StatusIcon size={15} />
                            {item.currentStatusLabel ?? STATUS_LABELS[item.currentStatus]}
                          </span>
                        </div>

                        <div className="encounter-readiness-card__body">
                          <h3>{item.title}</h3>
                          <p>{item.description}</p>
                          <strong>{item.currentDetail}</strong>
                          {item.currentChecklist && (
                            <ul className="encounter-readiness-checklist" aria-label={`Checklist de ${item.title}`}>
                              {item.currentChecklist.map((checklistItem) => (
                                <li
                                  className={
                                    checklistItem.complete === null
                                      ? 'is-unknown'
                                      : checklistItem.complete
                                        ? 'is-complete'
                                        : 'is-incomplete'
                                  }
                                  key={checklistItem.label}
                                >
                                  <span aria-hidden="true">
                                    {checklistItem.complete ? <Check size={14} /> : <CircleDashed size={14} />}
                                  </span>
                                  {checklistItem.label}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="encounter-readiness-card__actions">
                          {canShare && (
                            <button
                              type="button"
                              className="encounter-readiness-share"
                              onClick={() => void handleCopyPublicForm(item.id)}
                            >
                              {copiedItem === item.id ? <Check size={16} /> : <Copy size={16} />}
                              <span>{copiedItem === item.id ? 'Copiado' : 'Copiar link'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(resolveReadinessItemPath(item, encontroSelecionado.id))}
                          >
                            <span>Abrir módulo</span>
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
