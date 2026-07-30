import { describe, expect, it } from 'vitest';
import {
  getNavigationModules,
  getNavigationTitle,
  type NavigationAccessContext,
} from './navigation';

function createContext(
  permissions: string[],
  options: {
    isCoordinator?: boolean;
    teamName?: string;
  } = {}
): NavigationAccessContext {
  const permissionSet = new Set(permissions);
  return {
    hasPermission: (permission) => (
      permissionSet.has('modulo_admin') || permissionSet.has(permission)
    ),
    hasExactPermission: (permission) => permissionSet.has(permission),
    isCoordinator: options.isCoordinator ?? false,
    teamName: options.teamName,
  };
}

function moduleIds(
  surface: 'sidebar' | 'dashboard',
  context: NavigationAccessContext
) {
  return getNavigationModules(surface, context).map((module) => module.id);
}

describe('catálogo central de navegação', () => {
  it.each([
    ['modulo_visitacao_coordenar'],
    ['modulo_visitacao_duplas'],
  ])(
    'mostra Visitação no menu e no dashboard com a permissão específica %s',
    (permission) => {
      const context = createContext([permission]);

      expect(moduleIds('sidebar', context)).toContain('visitacao');
      expect(moduleIds('dashboard', context)).toContain('visitacao');
    }
  );

  it('não usa a permissão legada de Visitação como acesso às telas atuais', () => {
    const context = createContext(['modulo_visitacao']);

    expect(moduleIds('sidebar', context)).not.toContain('visitacao');
    expect(moduleIds('dashboard', context)).not.toContain('visitacao');
  });

  it.each([
    ['modulo_recepcao', 'recepcao'],
    ['modulo_recreacao', 'recreacao'],
    ['modulo_cuidados', 'cuidados'],
    ['modulo_ligacao', 'ligacao'],
    ['modulo_financeiro', 'compras'],
    ['almoxarifado_consultar', 'compras'],
  ])(
    'mantém o módulo %s coerente no menu e no dashboard',
    (permission, moduleId) => {
      const context = createContext([permission]);

      expect(moduleIds('sidebar', context)).toContain(moduleId);
      expect(moduleIds('dashboard', context)).toContain(moduleId);
    }
  );

  it('restringe Minha Equipe ao coordenador vinculado', () => {
    const withoutTeamCoordination = createContext(['modulo_coordenador']);
    const withTeamCoordination = createContext(
      ['modulo_coordenador'],
      { isCoordinator: true, teamName: 'Acolhida' }
    );

    expect(moduleIds('dashboard', withoutTeamCoordination)).not.toContain('minha-equipe');
    expect(moduleIds('dashboard', withTeamCoordination)).toContain('minha-equipe');
  });

  it('restringe Cozinha ao coordenador da equipe correta', () => {
    const otherTeam = createContext(
      ['modulo_coordenador'],
      { isCoordinator: true, teamName: 'Secretaria' }
    );
    const kitchenTeam = createContext(
      ['modulo_coordenador'],
      { isCoordinator: true, teamName: 'Equipe de Cozinha' }
    );

    expect(moduleIds('dashboard', otherTeam)).not.toContain('cozinha');
    expect(moduleIds('dashboard', kitchenTeam)).toContain('cozinha');
  });

  it('não concede Diagnósticos ao administrador sem a permissão exata', () => {
    const admin = createContext(['modulo_admin']);
    const developer = createContext(['modulo_diagnosticos']);

    expect(moduleIds('sidebar', admin)).not.toContain('diagnosticos');
    expect(moduleIds('dashboard', admin)).not.toContain('diagnosticos');
    expect(moduleIds('sidebar', developer)).toContain('diagnosticos');
    expect(moduleIds('dashboard', developer)).toContain('diagnosticos');
  });

  it('mantém títulos específicos antes dos títulos gerais dos módulos', () => {
    expect(getNavigationTitle('/secretaria/lista-espera')).toBe('Lista de Espera');
    expect(getNavigationTitle('/circulos/fichas-pos-encontro')).toBe('Ficha Pós-Encontro');
    expect(getNavigationTitle('/compras/almoxarifado/pedidos')).toBe('Compras');
    expect(getNavigationTitle('/rota-desconhecida')).toBe('EJC Capelinha');
  });
});
