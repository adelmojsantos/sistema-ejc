export type DashboardMetricId =
  | 'waitlist_pending'
  | 'teams_confirmation_pending'
  | 'unpaired_encontristas'
  | 'open_purchases'
  | 'team_members_pending'
  | 'team_finalize_pending'
  | 'team_fees_pending'
  | 'team_shirts_pending'
  | 'team_evaluations_pending'
  | 'visits_pending'
  | 'visits_absent'
  | 'visits_without_location'
  | 'duo_visits_pending'
  | 'duo_visits_absent'
  | 'duo_fees_pending'
  | 'kitchen_present_today';

export interface DashboardSummary {
  encontro_id: string;
  mode: 'admin' | 'operational';
  metrics: Partial<Record<DashboardMetricId, number>>;
}
