import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  CalendarClock,
  Camera,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  LayoutGrid,
  Link2,
  MapPinned,
  Route,
  Settings2,
  Shirt,
  ShoppingCart,
  UsersRound,
} from 'lucide-react';
import type {
  EncounterReadinessMetrics,
  ReadinessSectionId,
  ReadinessStatus,
} from '../types/encounterReadiness';

export interface ReadinessItemDefinition {
  id: string;
  section: ReadinessSectionId;
  title: string;
  description: string;
  path: string | ((encontroId: string) => string);
  icon: LucideIcon;
  status: (metrics: EncounterReadinessMetrics) => ReadinessStatus;
  statusLabel?: (metrics: EncounterReadinessMetrics) => string;
  detail: (metrics: EncounterReadinessMetrics) => string;
  checklist?: (metrics: EncounterReadinessMetrics) => ReadinessChecklistItem[];
  sharesPublicForm?: boolean;
}

export interface ReadinessChecklistItem {
  label: string;
  complete: boolean | null;
}

export function resolveReadinessItemPath(
  item: ReadinessItemDefinition,
  encontroId: string
): string {
  return typeof item.path === 'function' ? item.path(encontroId) : item.path;
}

function missingFieldsStatus(fields: string[] | undefined): ReadinessStatus {
  if (!fields) return 'attention';
  return fields.length === 0 ? 'ready' : 'not_configured';
}

function missingFieldsStatusLabel(fields: string[] | undefined): string {
  if (!fields) return 'Não verificado';
  return fields.length === 0 ? 'Completo' : 'Incompleto';
}

function missingFieldsDetail(fields: string[] | undefined, total: number): string {
  if (!fields) return 'Campos ainda não verificados';
  if (fields.length === 0) return `${total} de ${total} campos preenchidos`;
  return `Faltam ${fields.length} de ${total} campos`;
}

function checklistItem(
  label: string,
  fields: string[] | undefined,
  fieldNames: readonly string[]
): ReadinessChecklistItem {
  return {
    label,
    complete: fields ? fieldNames.every((field) => !fields.includes(field)) : null,
  };
}

const booleanStatus = (value: boolean): ReadinessStatus => value ? 'ready' : 'not_configured';
const countStatus = (count: number): ReadinessStatus => count > 0 ? 'ready' : 'not_configured';
const pendingStatus = (count: number): ReadinessStatus => count > 0 ? 'attention' : 'ready';
const encontristaStatus = (metrics: EncounterReadinessMetrics, pending: number): ReadinessStatus => {
  if (metrics.encontristas_total === 0) return 'not_configured';
  return pendingStatus(pending);
};

export const READINESS_SECTIONS: ReadonlyArray<{
  id: ReadinessSectionId;
  title: string;
  description: string;
}> = [
  {
    id: 'configuration',
    title: 'Configuração geral',
    description: 'Definições que precisam estar disponíveis antes da mobilização das equipes.',
  },
  {
    id: 'people',
    title: 'Pessoas e equipes',
    description: 'Cadastros e vínculos necessários para organizar encontristas e equipes de trabalho.',
  },
  {
    id: 'operation',
    title: 'Conteúdo e operação',
    description: 'Preparação dos materiais, avaliações, cronograma e recursos de apoio.',
  },
] as const;

export const READINESS_ITEMS: readonly ReadinessItemDefinition[] = [
  {
    id: 'basic', section: 'configuration', title: 'Dados do encontro',
    description: 'Nome, edição, datas, local, tema e música-tema.', path: (id) => `/cadastros/encontros/${id}/editar`, icon: Settings2,
    status: (m) => missingFieldsStatus(m.basic_missing_fields),
    statusLabel: (m) => missingFieldsStatusLabel(m.basic_missing_fields),
    detail: (m) => missingFieldsDetail(m.basic_missing_fields, 6),
    checklist: (m) => [
      checklistItem('Nome', m.basic_missing_fields, ['Nome']),
      checklistItem('Edição', m.basic_missing_fields, ['Edição']),
      checklistItem('Datas', m.basic_missing_fields, ['Data de início', 'Data de fim']),
      checklistItem('Local', m.basic_missing_fields, ['Local']),
      checklistItem('Tema', m.basic_missing_fields, ['Tema']),
      checklistItem('Música-tema', m.basic_missing_fields, ['Música-tema']),
    ],
  },
  {
    id: 'fee', section: 'configuration', title: 'Taxa e PIX',
    description: 'Valor da taxa, chave e tipo da chave PIX.', path: (id) => `/cadastros/encontros/${id}/editar`, icon: Banknote,
    status: (m) => missingFieldsStatus(m.fee_missing_fields),
    statusLabel: (m) => missingFieldsStatusLabel(m.fee_missing_fields),
    detail: (m) => missingFieldsDetail(m.fee_missing_fields, 3),
    checklist: (m) => [
      checklistItem('Valor da taxa', m.fee_missing_fields, ['Valor da taxa']),
      checklistItem('Chave PIX', m.fee_missing_fields, ['Chave PIX']),
      checklistItem('Tipo da chave PIX', m.fee_missing_fields, ['Tipo da chave PIX']),
    ],
  },
  {
    id: 'shirts', section: 'configuration', title: 'Modelos de camisetas',
    description: 'Ao menos um modelo ativo com valor para esta edição.', path: '/compras/configuracao', icon: Shirt,
    status: (m) => countStatus(m.active_shirt_models),
    detail: (m) => m.active_shirt_models > 0 ? `${m.active_shirt_models} modelo(s) ativo(s)` : 'Nenhum modelo ativo com valor',
  },
  {
    id: 'public-forms', section: 'configuration', title: 'Formulários de Recepção e Recreação',
    description: 'Um único link para cadastro de veículos e crianças.', path: (id) => `/cadastros/encontros/${id}/editar`, icon: Link2,
    status: (m) => booleanStatus(m.public_forms_published),
    detail: (m) => m.public_forms_published ? 'Link publicado' : 'Link ainda não publicado',
    sharesPublicForm: true,
  },
  {
    id: 'teams', section: 'people', title: 'Equipes do encontro',
    description: 'Equipes com integrantes vinculados à edição.', path: '/cadastros/montagem', icon: UsersRound,
    status: (m) => countStatus(m.teams_total),
    detail: (m) => m.teams_total > 0 ? `${m.teams_total} equipe(s) com integrantes` : 'Nenhuma equipe montada',
  },
  {
    id: 'confirmations', section: 'people', title: 'Confirmação dos dados das equipes',
    description: 'Coordenadores revisam e finalizam os dados dos integrantes.', path: '/secretaria/confirmacoes', icon: ClipboardCheck,
    status: (m) => m.teams_total === 0 ? 'not_configured' : pendingStatus(m.teams_confirmation_pending),
    detail: (m) => m.teams_total === 0 ? 'Aguardando montagem das equipes' : m.teams_confirmation_pending > 0 ? `${m.teams_confirmation_pending} equipe(s) pendente(s)` : 'Todas as equipes finalizaram',
  },
  {
    id: 'waitlist', section: 'people', title: 'Inscrições aguardando análise',
    description: 'Pré-inscrições que ainda precisam de decisão da Secretaria.', path: '/secretaria/lista-espera', icon: ClipboardList,
    status: (m) => pendingStatus(m.waitlist_pending),
    detail: (m) => m.waitlist_pending > 0 ? `${m.waitlist_pending} inscrição(ões) pendente(s)` : 'Nenhuma inscrição pendente',
  },
  {
    id: 'photos', section: 'people', title: 'Fotos dos encontristas',
    description: 'Fotos utilizadas pelos módulos de organização do encontro.', path: '/secretaria/fotos', icon: Camera,
    status: (m) => encontristaStatus(m, m.encontristas_without_photo),
    detail: (m) => m.encontristas_total === 0 ? 'Aguardando encontristas' : m.encontristas_without_photo > 0 ? `${m.encontristas_without_photo} sem foto` : 'Todos possuem foto',
  },
  {
    id: 'locations', section: 'people', title: 'Endereços e localização',
    description: 'Endereços utilizáveis para o planejamento das visitas.', path: '/secretaria/participantes', icon: MapPinned,
    status: (m) => encontristaStatus(m, m.encontristas_without_location),
    detail: (m) => m.encontristas_total === 0 ? 'Aguardando encontristas' : m.encontristas_without_location > 0 ? `${m.encontristas_without_location} sem endereço ou localização` : 'Todos estão localizados',
  },
  {
    id: 'visitation', section: 'people', title: 'Duplas de visitação',
    description: 'Encontristas vinculados às duplas responsáveis pelas visitas.', path: '/visitacao/coordenador', icon: Route,
    status: (m) => encontristaStatus(m, m.encontristas_without_visitation_group),
    detail: (m) => m.encontristas_total === 0 ? 'Aguardando encontristas' : m.encontristas_without_visitation_group > 0 ? `${m.encontristas_without_visitation_group} sem dupla` : 'Todos possuem dupla',
  },
  {
    id: 'circles', section: 'people', title: 'Círculos',
    description: 'Encontristas vinculados aos círculos do encontro.', path: '/cadastros/circulos', icon: CircleDot,
    status: (m) => encontristaStatus(m, m.encontristas_without_circle),
    detail: (m) => m.encontristas_total === 0 ? 'Aguardando encontristas' : m.encontristas_without_circle > 0 ? `${m.encontristas_without_circle} sem círculo` : 'Todos possuem círculo',
  },
  {
    id: 'schedule', section: 'operation', title: 'Cronograma',
    description: 'Atividades e horários previstos para os dias do encontro.', path: '/cadastros/cronograma', icon: CalendarClock,
    status: (m) => countStatus(m.schedule_items),
    detail: (m) => m.schedule_items > 0 ? `${m.schedule_items} atividade(s) cadastrada(s)` : 'Cronograma ainda vazio',
  },
  {
    id: 'team-evaluation', section: 'operation', title: 'Avaliação das equipes',
    description: 'Pesquisa individual destinada aos integrantes das equipes.', path: '/cadastros/avaliacao', icon: ClipboardCheck,
    status: (m) => booleanStatus(m.team_evaluation_published),
    detail: (m) => m.team_evaluation_published ? 'Pesquisa publicada' : 'Pesquisa ainda não publicada',
  },
  {
    id: 'encontrista-evaluation', section: 'operation', title: 'Avaliação dos encontristas',
    description: 'Pesquisa destinada aos encontristas antes da ficha de Pós-Encontro.', path: '/cadastros/avaliacao-encontristas', icon: ClipboardCheck,
    status: (m) => booleanStatus(m.encontrista_evaluation_published),
    detail: (m) => m.encontrista_evaluation_published ? 'Pesquisa publicada' : 'Pesquisa ainda não publicada',
  },
  {
    id: 'materials', section: 'operation', title: 'Pedidos de materiais',
    description: 'Pedidos do Almoxarifado que ainda não foram concluídos.', path: '/compras/almoxarifado/pedidos', icon: ShoppingCart,
    status: (m) => pendingStatus(m.material_requests_open),
    detail: (m) => m.material_requests_open > 0 ? `${m.material_requests_open} pedido(s) em aberto` : 'Nenhum pedido em aberto',
  },
  {
    id: 'purchases', section: 'operation', title: 'Compras em andamento',
    description: 'Processos de compra iniciados e ainda não finalizados.', path: '/compras/almoxarifado/compras', icon: ShoppingCart,
    status: (m) => pendingStatus(m.purchases_open),
    detail: (m) => m.purchases_open > 0 ? `${m.purchases_open} compra(s) aberta(s)` : 'Nenhuma compra aberta',
  },
  {
    id: 'quadrante', section: 'operation', title: 'Quadrante',
    description: 'Painel público configurado e publicado para o encontro.', path: (id) => `/cadastros/encontros/${id}/quadrante`, icon: LayoutGrid,
    status: (m) => booleanStatus(m.quadrante_published),
    detail: (m) => m.quadrante_published ? 'Quadrante publicado' : 'Quadrante ainda não publicado',
  },
  {
    id: 'post-encounter', section: 'operation', title: 'Roteiros de Pós-Encontro',
    description: 'Temas ou roteiros ativos cadastrados para os círculos.', path: '/cadastros/pos-encontros', icon: ClipboardList,
    status: (m) => countStatus(m.post_encounter_items),
    detail: (m) => m.post_encounter_items > 0 ? `${m.post_encounter_items} roteiro(s) ativo(s)` : 'Nenhum roteiro ativo',
  },
] as const;
