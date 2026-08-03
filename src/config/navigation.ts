import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Baby,
  Calendar,
  ChefHat,
  Crown,
  FileText,
  Folder,
  HeartPulse,
  Home,
  ListChecks,
  Mail,
  MapPin,
  Mic2,
  Shield,
  ShoppingBag,
  UserPlus,
  Users,
  Users2,
  UsersRound,
  Car,
} from 'lucide-react';
import {
  PURCHASES_ROUTE_PERMISSIONS,
  canAccessKitchenArea,
} from '../utils/accessControl';

export type NavigationSurface = 'sidebar' | 'dashboard';
export type NavigationAccent = 'primary' | 'success' | 'violet' | 'amber';

export const VISITATION_ACCESS_PERMISSIONS = [
  'modulo_visitacao_coordenar',
  'modulo_visitacao_duplas',
  'modulo_admin',
] as const;

export const VISITATION_COORDINATION_PERMISSIONS = [
  'modulo_visitacao_coordenar',
  'modulo_admin',
] as const;

type NavigationAccessRule = 'coordinator-team' | 'kitchen-team';

export interface NavigationModule {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  accent: NavigationAccent;
  surfaces: readonly NavigationSurface[];
  permissions?: readonly string[];
  exactPermissions?: readonly string[];
  accessRule?: NavigationAccessRule;
}

export interface NavigationAccessContext {
  hasPermission: (permission: string) => boolean;
  hasExactPermission: (permission: string) => boolean;
  isCoordinator: boolean;
  teamName?: string | null;
}

export const NAVIGATION_MODULES: readonly NavigationModule[] = [
  {
    id: 'inicio',
    label: 'Início',
    description: 'Acesso rápido às suas principais tarefas no sistema.',
    path: '/dashboard',
    icon: Home,
    accent: 'primary',
    surfaces: ['sidebar'],
  },
  {
    id: 'inscricoes',
    label: 'Inscrições',
    description: 'Cadastre participantes para o encontro.',
    path: '/inscricao',
    icon: UserPlus,
    accent: 'primary',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_inscricao', 'modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'secretaria',
    label: 'Secretaria',
    description: 'Gestão de documentos e informações gerais do encontro.',
    path: '/secretaria',
    icon: FileText,
    accent: 'primary',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'inscricoes-online',
    label: 'Inscrições Online',
    description: 'Gestão de pré-inscrições recebidas pelo site.',
    path: '/secretaria/lista-espera',
    icon: ListChecks,
    accent: 'violet',
    surfaces: ['dashboard'],
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    description: 'Pessoas, encontros, equipes e configurações operacionais.',
    path: '/cadastros',
    icon: Calendar,
    accent: 'amber',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_cadastros', 'modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'palestras',
    label: 'Palestras',
    description: 'Cadastro das palestras e palestrantes do encontro.',
    path: '/palestras',
    icon: Mic2,
    accent: 'violet',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'circulos',
    label: 'Círculos',
    description: 'Divisão dos participantes em grupos de estudo e partilha.',
    path: '/circulos',
    icon: UsersRound,
    accent: 'violet',
    surfaces: ['sidebar', 'dashboard'],
    permissions: [
      'modulo_circulos',
      'modulo_circulos_cadastros',
      'modulo_circulos_coordenador',
      'modulo_circulos_mediador',
      'modulo_admin',
    ],
  },
  {
    id: 'usuarios',
    label: 'Usuários',
    description: 'Gestão de contas, senhas e permissões do sistema.',
    path: '/admin/usuarios',
    icon: Users,
    accent: 'amber',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_admin'],
  },
  {
    id: 'acessos',
    label: 'Acessos',
    description: 'Configure os módulos disponíveis para cada grupo.',
    path: '/admin/acessos',
    icon: Shield,
    accent: 'success',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_admin'],
  },
  {
    id: 'dirigencia',
    label: 'Dirigência',
    description: 'Gerencie indicações e a sucessão das gestões.',
    path: '/admin/dirigencia',
    icon: Crown,
    accent: 'violet',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_admin'],
  },
  {
    id: 'diagnosticos',
    label: 'Diagnósticos',
    description: 'Consulte falhas técnicas registradas pela aplicação.',
    path: '/admin/diagnosticos',
    icon: Activity,
    accent: 'amber',
    surfaces: ['sidebar', 'dashboard'],
    exactPermissions: ['modulo_diagnosticos'],
  },
  {
    id: 'biblioteca',
    label: 'Biblioteca',
    description: 'Documentos, manuais e arquivos globais do EJC.',
    path: '/admin/biblioteca',
    icon: Folder,
    accent: 'violet',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_biblioteca', 'modulo_admin'],
  },
  {
    id: 'compras',
    label: 'Compras',
    description: 'Gestão financeira, taxas, camisetas e almoxarifado.',
    path: '/compras',
    icon: ShoppingBag,
    accent: 'primary',
    surfaces: ['sidebar', 'dashboard'],
    permissions: PURCHASES_ROUTE_PERMISSIONS,
  },
  {
    id: 'cuidados',
    label: 'Cuidados',
    description: 'Restrições alimentares e informações de saúde autorizadas.',
    path: '/cuidados',
    icon: HeartPulse,
    accent: 'success',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_cuidados', 'modulo_admin'],
  },
  {
    id: 'ligacao',
    label: 'Ligação',
    description: 'Localização de pessoas para entrega de cartas e recados.',
    path: '/ligacao',
    icon: Mail,
    accent: 'amber',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_ligacao', 'modulo_admin'],
  },
  {
    id: 'minha-equipe',
    label: 'Minha Equipe',
    description: 'Informações, confirmações e tarefas da sua equipe.',
    path: '/coordenador/minha-equipe',
    icon: Users2,
    accent: 'primary',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_coordenador'],
    accessRule: 'coordinator-team',
  },
  {
    id: 'cozinha',
    label: 'Cozinha',
    description: 'Mapa de pessoas e apoio ao planejamento das refeições.',
    path: '/coordenador/cozinha',
    icon: ChefHat,
    accent: 'success',
    surfaces: ['sidebar', 'dashboard'],
    accessRule: 'kitchen-team',
  },
  {
    id: 'visitacao',
    label: 'Visitação',
    description: 'Controle de visitas às famílias e acompanhamento.',
    path: '/visitacao',
    icon: MapPin,
    accent: 'success',
    surfaces: ['sidebar', 'dashboard'],
    permissions: VISITATION_ACCESS_PERMISSIONS,
  },
  {
    id: 'recepcao',
    label: 'Recepção',
    description: 'Consulte veículos e informações necessárias à recepção.',
    path: '/recepcao',
    icon: Car,
    accent: 'primary',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_recepcao', 'modulo_admin'],
  },
  {
    id: 'recreacao',
    label: 'Recreação Infantil',
    description: 'Gestão das crianças e de seus responsáveis no encontro.',
    path: '/recreacao',
    icon: Baby,
    accent: 'violet',
    surfaces: ['sidebar', 'dashboard'],
    permissions: ['modulo_recreacao', 'modulo_admin'],
  },
] as const;

export function canViewNavigationModule(
  module: NavigationModule,
  context: NavigationAccessContext
) {
  if (
    module.exactPermissions
    && !module.exactPermissions.some(context.hasExactPermission)
  ) {
    return false;
  }

  if (
    module.permissions
    && !module.permissions.some(context.hasPermission)
  ) {
    return false;
  }

  if (module.accessRule === 'coordinator-team') {
    return context.isCoordinator;
  }

  if (module.accessRule === 'kitchen-team') {
    return canAccessKitchenArea({
      hasPermission: context.hasPermission,
      isCoordinator: context.isCoordinator,
      teamName: context.teamName,
    });
  }

  return true;
}

export function getNavigationModules(
  surface: NavigationSurface,
  context: NavigationAccessContext
) {
  return NAVIGATION_MODULES
    .filter((module) => module.surfaces.includes(surface))
    .filter((module) => canViewNavigationModule(module, context));
}

interface NavigationTitle {
  pathPrefix: string;
  title: string;
}

const NAVIGATION_TITLES: readonly NavigationTitle[] = [
  { pathPrefix: '/admin/usuarios', title: 'Gerenciar Usuários' },
  { pathPrefix: '/admin/acessos', title: 'Controle de Acessos' },
  { pathPrefix: '/admin/dirigencia', title: 'Dirigência' },
  { pathPrefix: '/admin/diagnosticos', title: 'Diagnósticos' },
  { pathPrefix: '/secretaria/configuracoes-exportacao', title: 'Configurações de Exportação' },
  { pathPrefix: '/secretaria/confirmacoes', title: 'Relatório de Confirmações' },
  { pathPrefix: '/secretaria/lista-espera', title: 'Lista de Espera' },
  { pathPrefix: '/secretaria/participantes', title: 'Participantes' },
  { pathPrefix: '/secretaria/encontreiros', title: 'Encontreiros' },
  { pathPrefix: '/secretaria/impressos', title: 'Impressos' },
  { pathPrefix: '/secretaria/placas-equipes', title: 'Impressos' },
  { pathPrefix: '/secretaria/importar', title: 'Importar Dados' },
  { pathPrefix: '/circulos/fichas-pos-encontro', title: 'Ficha Pós-Encontro' },
  { pathPrefix: '/circulos/resumo-palestras', title: 'Resumo das Palestras' },
  { pathPrefix: '/circulos/pos-encontros', title: 'Pós-Encontro' },
  { pathPrefix: '/cadastros/pos-encontros', title: 'Pós-Encontro' },
  { pathPrefix: '/cadastros/encontros', title: 'Encontros' },
  { pathPrefix: '/cadastros/equipes', title: 'Equipes' },
  { pathPrefix: '/cadastros/pessoas', title: 'Pessoas' },
  { pathPrefix: '/coordenador/minha-equipe', title: 'Minha Equipe' },
  { pathPrefix: '/coordenador/cozinha', title: 'Cozinha' },
  { pathPrefix: '/admin/biblioteca', title: 'Biblioteca' },
  { pathPrefix: '/relatorios', title: 'Impressos' },
  { pathPrefix: '/palestras', title: 'Palestras' },
  { pathPrefix: '/recepcao', title: 'Recepção' },
  { pathPrefix: '/recreacao', title: 'Recreação Infantil' },
  { pathPrefix: '/visitacao', title: 'Visitação' },
  { pathPrefix: '/circulos', title: 'Círculos' },
  { pathPrefix: '/secretaria', title: 'Secretaria' },
  { pathPrefix: '/cadastros', title: 'Cadastros' },
  { pathPrefix: '/biblioteca', title: 'Biblioteca' },
  { pathPrefix: '/compras', title: 'Compras' },
  { pathPrefix: '/cuidados', title: 'Cuidados' },
  { pathPrefix: '/ligacao', title: 'Ligação' },
  { pathPrefix: '/inscricao', title: 'Inscrições' },
  { pathPrefix: '/dashboard', title: 'Dashboard' },
];

export function getNavigationTitle(pathname: string) {
  return NAVIGATION_TITLES.find(({ pathPrefix }) => pathname.startsWith(pathPrefix))?.title
    ?? 'EJC Capelinha';
}
