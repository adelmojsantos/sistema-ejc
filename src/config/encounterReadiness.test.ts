import { describe, expect, it } from 'vitest';
import { READINESS_ITEMS, resolveReadinessItemPath } from './encounterReadiness';
import type { EncounterReadinessMetrics } from '../types/encounterReadiness';

const baseMetrics: EncounterReadinessMetrics = {
  basic_configured: false,
  basic_missing_fields: ['Tema'],
  fee_configured: false,
  fee_missing_fields: ['Chave PIX'],
  public_forms_published: false,
  quadrante_published: false,
  active_shirt_models: 0,
  teams_total: 0,
  teams_confirmation_pending: 0,
  waitlist_pending: 0,
  encontristas_total: 0,
  encontristas_without_location: 0,
  encontristas_without_photo: 0,
  encontristas_without_visitation_group: 0,
  encontristas_without_circle: 0,
  schedule_items: 0,
  team_evaluation_published: false,
  encontrista_evaluation_published: false,
  material_requests_open: 0,
  purchases_open: 0,
  post_encounter_items: 0,
};

function item(id: string) {
  const definition = READINESS_ITEMS.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Indicador ${id} não encontrado`);
  return definition;
}

describe('encounter readiness indicators', () => {
  it('representa Recepção e Recreação em um único indicador', () => {
    expect(item('public-forms').status(baseMetrics)).toBe('not_configured');
    expect(READINESS_ITEMS.filter((candidate) => candidate.sharesPublicForm)).toHaveLength(1);
  });

  it('libera o compartilhamento único quando o link está publicado', () => {
    const metrics = { ...baseMetrics, public_forms_published: true };

    expect(item('public-forms').status(metrics)).toBe('ready');
    expect(item('public-forms').sharesPublicForm).toBe(true);
  });

  it('informa os campos ausentes e abre diretamente a edição selecionada', () => {
    expect(item('basic').status(baseMetrics)).toBe('not_configured');
    expect(item('basic').statusLabel?.(baseMetrics)).toBe('Incompleto');
    expect(item('basic').detail(baseMetrics)).toBe('Faltam 1 de 6 campos');
    expect(item('basic').checklist?.(baseMetrics)).toContainEqual({ label: 'Tema', complete: false });
    expect(item('fee').detail(baseMetrics)).toBe('Faltam 1 de 3 campos');
    expect(item('fee').checklist?.(baseMetrics)).toContainEqual({ label: 'Chave PIX', complete: false });
    expect(resolveReadinessItemPath(item('basic'), 'encontro-52'))
      .toBe('/cadastros/encontros/encontro-52/editar');
  });

  it('mantém o painel utilizável durante a aplicação da migration corretiva', () => {
    const previousRpcMetrics = {
      ...baseMetrics,
      basic_missing_fields: undefined,
      fee_missing_fields: undefined,
    };

    expect(item('basic').status(previousRpcMetrics)).toBe('attention');
    expect(item('basic').statusLabel?.(previousRpcMetrics)).toBe('Não verificado');
    expect(item('basic').detail(previousRpcMetrics)).toBe('Campos ainda não verificados');
    expect(item('fee').status(previousRpcMetrics)).toBe('attention');
    expect(item('fee').statusLabel?.(previousRpcMetrics)).toBe('Não verificado');
  });

  it('não trata ausência de encontristas como uma preparação concluída', () => {
    expect(item('photos').status(baseMetrics)).toBe('not_configured');
    expect(item('visitation').status(baseMetrics)).toBe('not_configured');
    expect(item('circles').status(baseMetrics)).toBe('not_configured');
  });

  it('sinaliza pendências das equipes quando já existe montagem', () => {
    const metrics = { ...baseMetrics, teams_total: 17, teams_confirmation_pending: 3 };

    expect(item('confirmations').status(metrics)).toBe('attention');
    expect(item('confirmations').detail(metrics)).toContain('3 equipe(s) pendente(s)');
  });
});
