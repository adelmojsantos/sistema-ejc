export type PermissionChecker = (permission: string) => boolean;

export const PURCHASES_ROUTE_PERMISSIONS: string[] = [
  'modulo_compras',
  'modulo_almoxarifado',
  'almoxarifado_consultar',
  'almoxarifado_gerenciar',
  'almoxarifado_movimentar',
  'modulo_financeiro',
  'financeiro_gerenciar',
  'modulo_coordenador',
  'modulo_admin',
];

export const ALMOXARIFADO_ROUTE_PERMISSIONS: string[] = [
  'modulo_compras',
  'modulo_almoxarifado',
  'almoxarifado_consultar',
  'almoxarifado_gerenciar',
  'almoxarifado_movimentar',
  'modulo_coordenador',
  'modulo_admin',
];

export const FINANCE_ROUTE_PERMISSIONS: string[] = [
  'modulo_compras',
  'modulo_financeiro',
  'financeiro_gerenciar',
  'modulo_admin',
];

export const SHIRT_ROUTE_PERMISSIONS: string[] = [
  'modulo_compras',
  'modulo_admin',
];

const normalizeTeamName = (teamName?: string | null) =>
  teamName
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase() ?? '';

export function hasAnyPermission(
  hasPermission: PermissionChecker,
  permissions: readonly string[]
) {
  return permissions.some((permission) => hasPermission(permission));
}

export function syncBackendAdminPermission(
  permissions: readonly string[],
  isAdmin: boolean
) {
  const effectivePermissions = new Set(permissions);
  if (isAdmin) {
    effectivePermissions.add('modulo_admin');
  } else {
    effectivePermissions.delete('modulo_admin');
  }
  return [...effectivePermissions];
}

export function canAccessKitchenArea({
  hasPermission,
  isCoordinator,
  teamName,
}: {
  hasPermission: PermissionChecker;
  isCoordinator: boolean;
  teamName?: string | null;
}) {
  if (hasPermission('modulo_admin')) return true;

  return (
    hasPermission('modulo_coordenador')
    && isCoordinator
    && normalizeTeamName(teamName).includes('cozinha')
  );
}
