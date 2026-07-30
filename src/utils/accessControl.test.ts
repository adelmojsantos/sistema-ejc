import { describe, expect, it } from 'vitest';
import {
  ALMOXARIFADO_ROUTE_PERMISSIONS,
  ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS,
  ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS,
  ALMOXARIFADO_PURCHASE_OPERATION_ROUTE_PERMISSIONS,
  ALMOXARIFADO_STOCK_ROUTE_PERMISSIONS,
  FINANCE_ROUTE_PERMISSIONS,
  PURCHASES_ROUTE_PERMISSIONS,
  SHIRT_ROUTE_PERMISSIONS,
  canAccessKitchenArea,
  hasAnyPermission,
  syncBackendAdminPermission,
} from './accessControl';

const checkerFor = (...permissions: string[]) =>
  (permission: string) => permissions.includes(permission);

describe('accessControl', () => {
  it('libera compras para qualquer permissão funcional prevista', () => {
    expect(hasAnyPermission(
      checkerFor('almoxarifado_consultar'),
      PURCHASES_ROUTE_PERMISSIONS
    )).toBe(true);
    expect(hasAnyPermission(
      checkerFor('financeiro_gerenciar'),
      PURCHASES_ROUTE_PERMISSIONS
    )).toBe(true);
  });

  it('nega compras para usuário apenas autenticado', () => {
    expect(hasAnyPermission(checkerFor(), PURCHASES_ROUTE_PERMISSIONS)).toBe(false);
  });

  it('impede usuário apenas financeiro de abrir as rotas de camisetas', () => {
    const hasPermission = checkerFor('modulo_financeiro');

    expect(hasAnyPermission(hasPermission, FINANCE_ROUTE_PERMISSIONS)).toBe(true);
    expect(hasAnyPermission(hasPermission, SHIRT_ROUTE_PERMISSIONS)).toBe(false);
  });

  it('limita usuário de estoque às rotas do almoxarifado', () => {
    const hasPermission = checkerFor('almoxarifado_consultar');

    expect(hasAnyPermission(hasPermission, ALMOXARIFADO_ROUTE_PERMISSIONS)).toBe(true);
    expect(hasAnyPermission(hasPermission, SHIRT_ROUTE_PERMISSIONS)).toBe(false);
  });

  it('libera o operador de compras específico no hub e no almoxarifado', () => {
    const hasPermission = checkerFor('almoxarifado_compras_operar');

    expect(hasAnyPermission(hasPermission, PURCHASES_ROUTE_PERMISSIONS)).toBe(true);
    expect(hasAnyPermission(hasPermission, ALMOXARIFADO_ROUTE_PERMISSIONS)).toBe(true);
    expect(hasAnyPermission(
      hasPermission,
      ALMOXARIFADO_PURCHASE_OPERATION_ROUTE_PERMISSIONS
    )).toBe(true);
    expect(hasAnyPermission(
      hasPermission,
      ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS
    )).toBe(true);
    expect(hasAnyPermission(hasPermission, ALMOXARIFADO_STOCK_ROUTE_PERMISSIONS))
      .toBe(false);
    expect(hasAnyPermission(hasPermission, ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS))
      .toBe(false);
    expect(hasAnyPermission(hasPermission, FINANCE_ROUTE_PERMISSIONS)).toBe(false);
    expect(hasAnyPermission(hasPermission, SHIRT_ROUTE_PERMISSIONS)).toBe(false);
  });

  it('libera a criação de pedidos sem ampliar acesso ao financeiro', () => {
    const hasPermission = checkerFor('almoxarifado_pedidos_criar');

    expect(hasAnyPermission(hasPermission, PURCHASES_ROUTE_PERMISSIONS)).toBe(true);
    expect(hasAnyPermission(hasPermission, ALMOXARIFADO_ROUTE_PERMISSIONS)).toBe(true);
    expect(hasAnyPermission(hasPermission, ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS))
      .toBe(true);
    expect(hasAnyPermission(hasPermission, ALMOXARIFADO_STOCK_ROUTE_PERMISSIONS))
      .toBe(false);
    expect(hasAnyPermission(
      hasPermission,
      ALMOXARIFADO_PURCHASE_OPERATION_ROUTE_PERMISSIONS
    )).toBe(false);
    expect(hasAnyPermission(hasPermission, FINANCE_ROUTE_PERMISSIONS)).toBe(false);
  });

  it('reflete no frontend a decisão administrativa calculada pelo backend', () => {
    expect(syncBackendAdminPermission(['modulo_dashboard'], true)).toEqual([
      'modulo_dashboard',
      'modulo_admin',
    ]);
    expect(syncBackendAdminPermission(['modulo_admin'], true)).toEqual([
      'modulo_admin',
    ]);
    expect(
      syncBackendAdminPermission(
        ['modulo_dashboard', 'modulo_admin'],
        false
      )
    ).toEqual(['modulo_dashboard']);
  });

  it('restringe a cozinha ao coordenador da equipe correta', () => {
    const hasPermission = checkerFor('modulo_coordenador');

    expect(canAccessKitchenArea({
      hasPermission,
      isCoordinator: true,
      teamName: 'Equipe Cozinha',
    })).toBe(true);
    expect(canAccessKitchenArea({
      hasPermission,
      isCoordinator: true,
      teamName: 'Recepção',
    })).toBe(false);
    expect(canAccessKitchenArea({
      hasPermission,
      isCoordinator: false,
      teamName: 'Cozinha',
    })).toBe(false);
  });

  it('mantém o acesso da administração à cozinha', () => {
    expect(canAccessKitchenArea({
      hasPermission: checkerFor('modulo_admin'),
      isCoordinator: false,
      teamName: null,
    })).toBe(true);
  });
});
