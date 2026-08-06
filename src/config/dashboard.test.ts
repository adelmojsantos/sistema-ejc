import { describe, expect, it } from 'vitest';
import { getDashboardMetrics } from './dashboard';

describe('getDashboardMetrics', () => {
  it('oculta indicadores zerados e preserva a ordem operacional', () => {
    const metrics = getDashboardMetrics({
      encontro_id: 'encontro-1',
      mode: 'operational',
      metrics: {
        team_members_pending: 2,
        team_finalize_pending: 0,
        team_fees_pending: 1,
      },
    });

    expect(metrics.map((metric) => metric.id)).toEqual([
      'team_members_pending',
      'team_fees_pending',
    ]);
  });

  it('não cria indicadores que o backend não retornou', () => {
    const metrics = getDashboardMetrics({
      encontro_id: 'encontro-1',
      mode: 'admin',
      metrics: {
        waitlist_pending: 3,
        teams_confirmation_pending: 4,
        unpaired_encontristas: 5,
        open_purchases: 1,
      },
    });

    expect(metrics).toHaveLength(4);
    expect(metrics.every((metric) => metric.count > 0)).toBe(true);
    expect(metrics.some((metric) => metric.id === 'team_fees_pending')).toBe(false);
  });

  it('considera rascunhos dentro do indicador de avaliações não enviadas', () => {
    const [metric] = getDashboardMetrics({
      encontro_id: 'encontro-1',
      mode: 'operational',
      metrics: { team_evaluations_pending: 2 },
    });

    expect(metric.label(metric.count)).toContain('ainda não enviaram');
    expect(metric.description).toContain('rascunhos');
  });
});
