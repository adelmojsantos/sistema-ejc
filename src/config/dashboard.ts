import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  CheckCheck,
  ClipboardCheck,
  ClipboardList,
  MapPinOff,
  RefreshCcw,
  Shirt,
  ShoppingCart,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from 'lucide-react';
import type { DashboardMetricId, DashboardSummary } from '../types/dashboard';

export type DashboardMetricTone = 'primary' | 'success' | 'violet' | 'amber' | 'danger';

export interface DashboardMetricDefinition {
  id: DashboardMetricId;
  label: (count: number) => string;
  description: string;
  path: string;
  icon: LucideIcon;
  tone: DashboardMetricTone;
  section: 'priority' | 'overview';
}

export interface DashboardMetric extends DashboardMetricDefinition {
  count: number;
}

const plural = (count: number, singular: string, pluralForm: string) => (
  count === 1 ? singular : pluralForm
);

export const DASHBOARD_METRICS: readonly DashboardMetricDefinition[] = [
  {
    id: 'team_members_pending',
    label: (count) => `${count} ${plural(count, 'integrante aguarda', 'integrantes aguardam')} confirmação`,
    description: 'Revise e confirme os dados da sua equipe.',
    path: '/coordenador/minha-equipe',
    icon: UserRoundCheck,
    tone: 'amber',
    section: 'priority',
  },
  {
    id: 'team_finalize_pending',
    label: () => 'Finalizar confirmação da equipe',
    description: 'Todos os integrantes foram confirmados. Falta concluir a confirmação geral.',
    path: '/coordenador/minha-equipe',
    icon: CheckCheck,
    tone: 'success',
    section: 'priority',
  },
  {
    id: 'team_evaluations_pending',
    label: (count) => `${count} ${plural(count, 'integrante ainda não enviou', 'integrantes ainda não enviaram')} a avaliação`,
    description: 'A contagem inclui rascunhos e o próprio coordenador.',
    path: '/coordenador/minha-equipe/avaliacao',
    icon: ClipboardCheck,
    tone: 'violet',
    section: 'priority',
  },
  {
    id: 'waitlist_pending',
    label: (count) => `${count} ${plural(count, 'inscrição aguarda', 'inscrições aguardam')} análise`,
    description: 'Pré-inscrições recebidas e ainda não avaliadas.',
    path: '/secretaria/lista-espera',
    icon: ClipboardList,
    tone: 'amber',
    section: 'priority',
  },
  {
    id: 'teams_confirmation_pending',
    label: (count) => `${count} ${plural(count, 'equipe sem', 'equipes sem')} confirmação`,
    description: 'Equipes que não concluíram a confirmação dos dados.',
    path: '/secretaria/confirmacoes',
    icon: UsersRound,
    tone: 'amber',
    section: 'priority',
  },
  {
    id: 'unpaired_encontristas',
    label: (count) => `${count} ${plural(count, 'encontrista está', 'encontristas estão')} sem dupla`,
    description: 'Encontristas ativos sem vínculo de visitação.',
    path: '/visitacao/coordenador',
    icon: UserRoundX,
    tone: 'danger',
    section: 'priority',
  },
  {
    id: 'visits_absent',
    label: (count) => `${count} ${plural(count, 'ausente aguarda', 'ausentes aguardam')} revisita`,
    description: 'Visitas marcadas como ausentes que precisam ser revisitadas.',
    path: '/visitacao/coordenador',
    icon: RefreshCcw,
    tone: 'amber',
    section: 'priority',
  },
  {
    id: 'duo_visits_absent',
    label: (count) => `${count} ${plural(count, 'ausente aguarda', 'ausentes aguardam')} sua revisita`,
    description: 'Pessoas da sua dupla marcadas como ausentes.',
    path: '/visitacao/meus-participantes',
    icon: RefreshCcw,
    tone: 'amber',
    section: 'priority',
  },
  {
    id: 'visits_pending',
    label: (count) => `${count} ${plural(count, 'visita pendente', 'visitas pendentes')}`,
    description: 'Visitas ainda não concluídas pela coordenação.',
    path: '/visitacao/coordenador',
    icon: ClipboardList,
    tone: 'primary',
    section: 'overview',
  },
  {
    id: 'duo_visits_pending',
    label: (count) => `${count} ${plural(count, 'visita pendente', 'visitas pendentes')}`,
    description: 'Visitas ainda não concluídas pela sua dupla.',
    path: '/visitacao/meus-participantes',
    icon: ClipboardList,
    tone: 'primary',
    section: 'overview',
  },
  {
    id: 'visits_without_location',
    label: (count) => `${count} ${plural(count, 'visita sem', 'visitas sem')} endereço ou localização`,
    description: 'Cadastros que precisam ser localizados antes da visita.',
    path: '/visitacao/coordenador',
    icon: MapPinOff,
    tone: 'danger',
    section: 'overview',
  },
  {
    id: 'team_fees_pending',
    label: (count) => `${count} ${plural(count, 'taxa pendente', 'taxas pendentes')} na equipe`,
    description: 'Integrantes da equipe sem pagamento de taxa registrado.',
    path: '/coordenador/minha-equipe',
    icon: Banknote,
    tone: 'amber',
    section: 'overview',
  },
  {
    id: 'team_shirts_pending',
    label: (count) => `${count} ${plural(count, 'pedido de camiseta pendente', 'pedidos de camiseta pendentes')}`,
    description: 'Somente pedidos de camiseta já cadastrados são considerados.',
    path: '/coordenador/minha-equipe',
    icon: Shirt,
    tone: 'amber',
    section: 'overview',
  },
  {
    id: 'duo_fees_pending',
    label: (count) => `${count} ${plural(count, 'taxa pendente', 'taxas pendentes')} nas suas visitas`,
    description: 'Pagamentos ainda não registrados pela dupla.',
    path: '/visitacao/meus-participantes',
    icon: Banknote,
    tone: 'amber',
    section: 'overview',
  },
  {
    id: 'open_purchases',
    label: (count) => `${count} ${plural(count, 'processo de compra aberto', 'processos de compra abertos')}`,
    description: 'Compras do almoxarifado que ainda não foram finalizadas.',
    path: '/compras/almoxarifado/compras',
    icon: ShoppingCart,
    tone: 'primary',
    section: 'overview',
  },
  {
    id: 'kitchen_present_today',
    label: (count) => `${count} ${plural(count, 'pessoa presente hoje', 'pessoas presentes hoje')}`,
    description: 'Presenças registradas no dia atual para o planejamento da cozinha.',
    path: '/coordenador/cozinha',
    icon: UserRoundCheck,
    tone: 'success',
    section: 'overview',
  },
] as const;

export function getDashboardMetrics(summary: DashboardSummary | null): DashboardMetric[] {
  if (!summary) return [];

  return DASHBOARD_METRICS.flatMap((definition) => {
    const count = summary.metrics[definition.id] ?? 0;
    return count > 0 ? [{ ...definition, count }] : [];
  });
}
