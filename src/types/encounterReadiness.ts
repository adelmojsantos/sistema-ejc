export interface EncounterReadinessMetrics {
  basic_configured: boolean;
  basic_missing_fields?: string[];
  fee_configured: boolean;
  fee_missing_fields?: string[];
  public_forms_published: boolean;
  quadrante_published: boolean;
  active_shirt_models: number;
  teams_total: number;
  teams_confirmation_pending: number;
  waitlist_pending: number;
  encontristas_total: number;
  encontristas_without_location: number;
  encontristas_without_photo: number;
  encontristas_without_visitation_group: number;
  encontristas_without_circle: number;
  schedule_items: number;
  team_evaluation_published: boolean;
  encontrista_evaluation_published: boolean;
  material_requests_open: number;
  purchases_open: number;
  post_encounter_items: number;
}

export interface EncounterReadinessSummary {
  encontro_id: string;
  encontro_nome: string;
  metrics: EncounterReadinessMetrics;
}

export type ReadinessStatus = 'ready' | 'attention' | 'not_configured';
export type ReadinessSectionId = 'configuration' | 'people' | 'operation';
