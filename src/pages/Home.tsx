import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getDashboardMetrics } from '../config/dashboard';
import { getNavigationModules } from '../config/navigation';
import { useAuth } from '../hooks/useAuth';
import { useEncontros } from '../contexts/EncontroContext';
import { dashboardService } from '../services/dashboardService';
import type { DashboardSummary } from '../types/dashboard';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

export function Home() {
  const navigate = useNavigate();
  const { encontroSelecionado, isLoading: encontroLoading } = useEncontros();
  const {
    hasPermission,
    hasExactPermission,
    userParticipacao,
  } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!encontroSelecionado?.id || !encontroSelecionado.ativo) {
      setSummary(null);
      setSummaryError(null);
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await dashboardService.obterResumo(encontroSelecionado.id);
      setSummary(data);
    } catch (error) {
      console.error('[Dashboard] Erro ao carregar resumo operacional:', error);
      setSummary(null);
      setSummaryError('Não foi possível atualizar o resumo agora.');
    } finally {
      setSummaryLoading(false);
    }
  }, [encontroSelecionado?.id, encontroSelecionado?.ativo]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const dashboardMetrics = useMemo(() => getDashboardMetrics(summary), [summary]);
  const priorityCandidates = dashboardMetrics.filter((metric) => metric.section === 'priority');
  const priorityMetrics = priorityCandidates.slice(0, 3);
  const overviewMetrics = [
    ...priorityCandidates.slice(3),
    ...dashboardMetrics.filter((metric) => metric.section === 'overview'),
  ];

  const dashboardActions = getNavigationModules('dashboard', {
    hasPermission,
    hasExactPermission,
    isCoordinator: Boolean(userParticipacao?.coordenador),
    teamName: userParticipacao?.equipes?.nome,
  }).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="dashboard animate-fade-in">
      <header className="dashboard__header">
        <h1 className="page-title text-gradient">Dashboard</h1>
      </header>

      {encontroSelecionado?.ativo && (
        <section className="dashboard-work" aria-labelledby="dashboard-work-title">
          <div className="dashboard-work__header">
            <div>
              <span className="dashboard-work__eyebrow">
                {encontroSelecionado.nome}
              </span>
              <h2 id="dashboard-work-title">Meu trabalho</h2>
              <p>Prioridades e números essenciais para sua função.</p>
            </div>
            <button
              type="button"
              className="dashboard-work__refresh"
              onClick={loadSummary}
              disabled={summaryLoading}
              aria-label="Atualizar resumo do dashboard"
            >
              <RefreshCw
                size={17}
                strokeWidth={2.25}
                aria-hidden="true"
                className={summaryLoading ? 'is-spinning' : undefined}
                style={{ color: 'var(--text-color)', stroke: 'currentColor', opacity: 1 }}
              />
              Atualizar
            </button>
          </div>

          {(summaryLoading || encontroLoading) && !summary && (
            <div className="dashboard-work__loading" role="status">
              <span className="dashboard-work__skeleton" />
              <span className="dashboard-work__skeleton" />
              <span className="dashboard-work__skeleton" />
            </div>
          )}

          {summaryError && (
            <div className="dashboard-work__error" role="alert">
              <AlertCircle size={19} />
              <span>{summaryError} Os atalhos continuam disponíveis abaixo.</span>
              <button type="button" onClick={loadSummary}>Tentar novamente</button>
            </div>
          )}

          {!summaryLoading && !summaryError && summary && dashboardMetrics.length === 0 && (
            <div className="dashboard-work__empty">
              <CheckCircle2 size={20} />
              <span>Nenhuma pendência ou indicador relevante neste momento.</span>
            </div>
          )}

          {priorityMetrics.length > 0 && (
            <div className="dashboard-work__priorities">
              {priorityMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <button
                    type="button"
                    className={`dashboard-work-card dashboard-work-card--${metric.tone}`}
                    key={metric.id}
                    onClick={() => navigate(metric.path)}
                  >
                    <span className="dashboard-work-card__icon"><Icon size={21} /></span>
                    <span className="dashboard-work-card__content">
                      <strong>{metric.label(metric.count)}</strong>
                      <small>{metric.description}</small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}

          {overviewMetrics.length > 0 && (
            <div className="dashboard-work__overview" aria-label="Visão geral">
              {overviewMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <button
                    type="button"
                    className="dashboard-overview-card"
                    key={metric.id}
                    onClick={() => navigate(metric.path)}
                  >
                    <span className={`dashboard-overview-card__icon dashboard-overview-card__icon--${metric.tone}`}>
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{metric.count}</strong>
                      <small>{metric.label(metric.count).replace(/^\d+\s*/, '')}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="dashboard-modules-title">
        <div className="dashboard-section-heading">
          <h2 id="dashboard-modules-title">Módulos</h2>
          <p>Acesse as áreas disponíveis para o seu perfil.</p>
        </div>
      <motion.div
        className="dashboard__grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {dashboardActions.map((action) => {
          const Icon = action.icon;
          return (
            <motion.article
              key={action.id}
              variants={itemVariants}
              className="dashboard-card"
              onClick={() => navigate(action.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(event: React.KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(action.path);
                }
              }}
            >
              <div className={`dashboard-card__icon dashboard-card__icon--${action.accent}`}>
                <Icon size={36} />
              </div>
              <h2>{action.label}</h2>
              <p>{action.description}</p>
            </motion.article>
          );
        })}
      </motion.div>
      </section>
    </div>
  );
}
