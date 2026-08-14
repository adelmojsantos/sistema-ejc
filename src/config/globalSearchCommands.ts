import {
  Baby,
  CalendarCheck,
  Camera,
  CircleDot,
  ClipboardCheck,
  FileText,
  PackageSearch,
  Presentation,
  Receipt,
  Settings,
  Shirt,
  UserRoundSearch,
  Users,
  UsersRound,
  Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getNavigationModules,
  type NavigationAccessContext,
} from './navigation';
import {
  ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS,
  ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS,
  ALMOXARIFADO_PURCHASE_OPERATION_ROUTE_PERMISSIONS,
  ALMOXARIFADO_ROUTE_PERMISSIONS,
  ALMOXARIFADO_STOCK_ROUTE_PERMISSIONS,
  FINANCE_ROUTE_PERMISSIONS,
  SHIRT_ROUTE_PERMISSIONS,
} from '../utils/accessControl';

export interface GlobalSearchCommand {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  keywords: string;
  permissions?: readonly string[];
}

const internalCommands: readonly GlobalSearchCommand[] = [
  {
    id: 'secretaria-confirmacoes',
    label: 'Confirmação de dados das equipes',
    description: 'Secretaria · revisar a confirmação dos dados dos integrantes.',
    path: '/secretaria/confirmacoes',
    icon: ClipboardCheck,
    keywords: 'secretaria dados confirmação confirmar integrantes equipe',
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'secretaria-encontristas',
    label: 'Encontristas',
    description: 'Secretaria · consultar participantes do encontro.',
    path: '/secretaria/participantes',
    icon: UserRoundSearch,
    keywords: 'secretaria encontristas participantes inscrição cadastro',
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'secretaria-encontreiros',
    label: 'Encontreiros',
    description: 'Secretaria · consultar integrantes das equipes de trabalho.',
    path: '/secretaria/encontreiros',
    icon: Users,
    keywords: 'secretaria encontreiros integrantes equipe',
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'secretaria-fotos-familias',
    label: 'Fotos das famílias',
    description: 'Secretaria · fotos dos encontristas e de suas famílias.',
    path: '/secretaria/participantes?aba=fotos',
    icon: Camera,
    keywords: 'secretaria foto fotos família familias encontristas participantes',
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'secretaria-fotos-equipes',
    label: 'Fotos das equipes',
    description: 'Secretaria · envio e enquadramento das fotos das equipes.',
    path: '/secretaria/fotos-equipes',
    icon: Camera,
    keywords: 'secretaria foto fotos equipe equipes',
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'secretaria-inscricoes-online',
    label: 'Inscrições online',
    description: 'Secretaria · analisar pré-inscrições recebidas pelo site.',
    path: '/secretaria/lista-espera',
    icon: FileText,
    keywords: 'secretaria inscrição inscrições online lista espera aprovação',
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'secretaria-impressos',
    label: 'Impressos',
    description: 'Secretaria · placas, crachás, etiquetas e identificações.',
    path: '/secretaria/impressos',
    icon: FileText,
    keywords: 'secretaria impressos placas crachá crachas etiquetas carros pdf',
    permissions: ['modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'cadastros-pessoas',
    label: 'Cadastro de pessoas',
    description: 'Cadastros · localizar, criar e editar pessoas.',
    path: '/cadastros/pessoas',
    icon: UserRoundSearch,
    keywords: 'cadastros pessoa pessoas criar editar histórico',
    permissions: ['modulo_cadastros', 'modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'cadastros-encontros',
    label: 'Encontros',
    description: 'Cadastros · consultar e configurar encontros.',
    path: '/cadastros/encontros',
    icon: CalendarCheck,
    keywords: 'cadastros encontro encontros edição datas local tema música taxa',
    permissions: ['modulo_cadastros', 'modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'cadastros-equipes',
    label: 'Equipes',
    description: 'Cadastros · equipes de trabalho e suas configurações.',
    path: '/cadastros/equipes',
    icon: Users,
    keywords: 'cadastros equipe equipes trabalho',
    permissions: ['modulo_cadastros', 'modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'cadastros-montagem-equipes',
    label: 'Montagem das equipes',
    description: 'Cadastros · vincular encontreiros às equipes.',
    path: '/cadastros/montagem',
    icon: UsersRound,
    keywords: 'cadastros montagem equipe equipes vínculo vincular encontreiros',
    permissions: ['modulo_cadastros', 'modulo_secretaria', 'modulo_admin'],
  },
  {
    id: 'preparacao-encontro',
    label: 'Preparação do encontro',
    description: 'Acompanhar dados e configurações necessárias ao encontro.',
    path: '/dashboard/preparacao',
    icon: ClipboardCheck,
    keywords: 'preparação checklist dados encontro tema música taxa pix formulários',
    permissions: ['modulo_admin'],
  },
  {
    id: 'visitacao-duplas',
    label: 'Gestão das duplas de visitação',
    description: 'Visitação · montar duplas e vincular encontristas.',
    path: '/visitacao/coordenador',
    icon: UsersRound,
    keywords: 'visitação dupla duplas visitantes montagem encontristas visita',
    permissions: ['modulo_visitacao_coordenar', 'modulo_admin'],
  },
  {
    id: 'visitacao-meus-encontristas',
    label: 'Meus encontristas',
    description: 'Visitação · consultar e preencher as visitas da dupla.',
    path: '/visitacao/meus-participantes',
    icon: UserRoundSearch,
    keywords: 'visitação meus encontristas participantes visita dupla',
    permissions: ['modulo_visitacao_duplas'],
  },
  {
    id: 'circulos-cadastro',
    label: 'Cadastro de círculos',
    description: 'Círculos · cadastrar círculos e mediadores.',
    path: '/circulos/cadastros',
    icon: CircleDot,
    keywords: 'círculo círculos cadastro mediadores fotos',
    permissions: ['modulo_circulos_cadastros', 'modulo_admin'],
  },
  {
    id: 'circulos-montagem',
    label: 'Montagem dos círculos',
    description: 'Círculos · distribuir encontristas entre os grupos.',
    path: '/circulos/montagem',
    icon: UsersRound,
    keywords: 'círculo círculos montagem grupos encontristas mediadores foto fotos',
    permissions: ['modulo_circulos_coordenador', 'modulo_admin'],
  },
  {
    id: 'circulos-palestras',
    label: 'Resumo das palestras',
    description: 'Círculos · temas registrados para os mediadores.',
    path: '/circulos/resumo-palestras',
    icon: Presentation,
    keywords: 'círculo círculos palestra palestras resumo temas mediadores',
    permissions: ['modulo_circulos_coordenador', 'modulo_admin'],
  },
  {
    id: 'circulos-pos-encontro',
    label: 'Pós-Encontro dos círculos',
    description: 'Círculos · registros e fichas do pós-encontro.',
    path: '/circulos/pos-encontros',
    icon: FileText,
    keywords: 'círculo círculos pós encontro fichas histórico',
    permissions: ['modulo_circulos_coordenador', 'modulo_circulos_mediador', 'modulo_admin'],
  },
  {
    id: 'compras-almoxarifado',
    label: 'Almoxarifado',
    description: 'Compras · estoque, itens, pedidos e aquisições.',
    path: '/compras/almoxarifado',
    icon: Warehouse,
    keywords: 'compras almoxarifado estoque itens pedidos aquisições',
    permissions: ALMOXARIFADO_ROUTE_PERMISSIONS,
  },
  {
    id: 'compras-estoque',
    label: 'Estoque do almoxarifado',
    description: 'Compras · consultar estoque e movimentações.',
    path: '/compras/almoxarifado/estoque',
    icon: Warehouse,
    keywords: 'compras almoxarifado estoque movimentação itens',
    permissions: ALMOXARIFADO_STOCK_ROUTE_PERMISSIONS,
  },
  {
    id: 'compras-pedidos',
    label: 'Pedidos do almoxarifado',
    description: 'Compras · pedidos realizados pelas equipes.',
    path: '/compras/almoxarifado/pedidos',
    icon: PackageSearch,
    keywords: 'compras almoxarifado pedido pedidos equipes',
    permissions: ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS,
  },
  {
    id: 'compras-operacao',
    label: 'Operação de compras',
    description: 'Compras · registrar e acompanhar aquisições.',
    path: '/compras/almoxarifado/compras',
    icon: PackageSearch,
    keywords: 'compras aquisição aquisições orçamento fornecedor',
    permissions: ALMOXARIFADO_PURCHASE_OPERATION_ROUTE_PERMISSIONS,
  },
  {
    id: 'compras-historico',
    label: 'Compras realizadas',
    description: 'Compras · consultar o histórico de aquisições.',
    path: '/compras/almoxarifado/compras-realizadas',
    icon: Receipt,
    keywords: 'compras realizadas histórico comprovantes',
    permissions: ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS,
  },
  {
    id: 'compras-financeiro',
    label: 'Financeiro',
    description: 'Compras · lançamentos, conciliação e comprovantes.',
    path: '/compras/financeiro',
    icon: Receipt,
    keywords: 'compras financeiro lançamento conciliação comprovante pagamento taxa camiseta',
    permissions: FINANCE_ROUTE_PERMISSIONS,
  },
  {
    id: 'compras-taxas',
    label: 'Taxas do encontro',
    description: 'Compras · acompanhar pagamentos das taxas.',
    path: '/compras/taxas',
    icon: Receipt,
    keywords: 'compras financeiro taxa taxas pagamento pix',
    permissions: SHIRT_ROUTE_PERMISSIONS,
  },
  {
    id: 'compras-camisetas',
    label: 'Pedidos e separação de camisetas',
    description: 'Compras · conferir pedidos, pagamentos e separação.',
    path: '/compras/camisetas',
    icon: Shirt,
    keywords: 'compras camiseta camisetas pedido pedidos separação pago pagamento dupla equipe encontrista',
    permissions: SHIRT_ROUTE_PERMISSIONS,
  },
  {
    id: 'compras-configuracao-camisetas',
    label: 'Configuração de camisetas',
    description: 'Compras · modelos, tamanhos e preços.',
    path: '/compras/configuracao',
    icon: Settings,
    keywords: 'compras camiseta camisetas configuração modelos tamanhos preços',
    permissions: SHIRT_ROUTE_PERMISSIONS,
  },
  {
    id: 'recreacao-responsaveis',
    label: 'Crianças e responsáveis',
    description: 'Recreação Infantil · consultar crianças e seus responsáveis.',
    path: '/recreacao',
    icon: Baby,
    keywords: 'recreação infantil crianças filhos responsáveis encontreiros',
    permissions: ['modulo_recreacao', 'modulo_admin'],
  },
];

export function normalizeGlobalSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function getGlobalSearchCommands(context: NavigationAccessContext) {
  const roots: GlobalSearchCommand[] = [
    ...getNavigationModules('sidebar', context),
    ...getNavigationModules('dashboard', context),
  ].map((module) => ({
    id: `root-${module.id}`,
    label: module.label,
    description: module.description,
    path: module.path,
    icon: module.icon,
    keywords: `${module.label} ${module.description}`,
  }));

  const allowedInternal = internalCommands.filter((command) =>
    !command.permissions || command.permissions.some(context.hasPermission)
  );
  const unique = new Map<string, GlobalSearchCommand>();
  [...roots, ...allowedInternal].forEach((command) => {
    if (!unique.has(command.id)) unique.set(command.id, command);
  });
  return [...unique.values()];
}
