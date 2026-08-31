import { describe, expect, it } from 'vitest';
import {
  getNavigationModules,
  getSidebarNavigationGroups,
  getNavigationTitle,
  NAVIGATION_GROUPS,
  NAVIGATION_MODULES,
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
    hasSharedLibraryItems: false,
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

  it('mostra uma única Biblioteca por permissão de gestão ou por compartilhamento', () => {
    const withoutItems = createContext(['modulo_visitacao_duplas']);
    const withItems: NavigationAccessContext = {
      ...withoutItems,
      hasSharedLibraryItems: true,
    };
    const manager = createContext(['modulo_biblioteca']);

    expect(moduleIds('sidebar', withoutItems)).not.toContain('biblioteca');
    expect(moduleIds('dashboard', withoutItems)).not.toContain('biblioteca');
    expect(moduleIds('sidebar', withItems)).toContain('biblioteca');
    expect(moduleIds('dashboard', withItems)).toContain('biblioteca');
    expect(moduleIds('sidebar', manager)).toContain('biblioteca');
    expect(moduleIds('dashboard', manager)).toContain('biblioteca');

    expect(NAVIGATION_MODULES.filter((module) => module.label === 'Biblioteca')).toHaveLength(1);
    expect(NAVIGATION_MODULES.find((module) => module.id === 'biblioteca')?.path).toBe('/biblioteca');
  });

  it('organiza o menu por processo na ordem definida', () => {
    const context = createContext(
      ['modulo_admin', 'modulo_diagnosticos', 'modulo_coordenador'],
      { isCoordinator: true, teamName: 'Equipe de Cozinha' }
    );

    expect(getSidebarNavigationGroups(context).map((group) => ({
      label: group.label,
      modules: group.modules.map((module) => module.id),
    }))).toEqual([
      { label: 'Meu trabalho', modules: ['minha-equipe'] },
      {
        label: 'Preparação',
        modules: ['cadastros', 'inscricoes', 'secretaria', 'visitacao', 'palestras'],
      },
      {
        label: 'Operação do encontro',
        modules: ['circulos', 'cozinha', 'cuidados', 'recepcao', 'recreacao', 'ligacao'],
      },
      { label: 'Recursos e apoio', modules: ['compras', 'biblioteca'] },
      {
        label: 'Administração',
        modules: ['acessos', 'usuarios', 'dirigencia', 'diagnosticos'],
      },
    ]);
  });

  it('omite grupos sem módulos permitidos', () => {
    const groups = getSidebarNavigationGroups(createContext(['modulo_recepcao']));

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Operação do encontro');
    expect(groups[0].modules.map((module) => module.id)).toEqual(['recepcao']);
  });

  it('mantém todos os módulos laterais mapeados uma única vez', () => {
    const groupedIds = NAVIGATION_GROUPS.flatMap((group) => group.moduleIds);
    const sidebarIds = NAVIGATION_MODULES
      .filter((module) => module.surfaces.includes('sidebar') && module.id !== 'inicio')
      .map((module) => module.id);

    expect(new Set(groupedIds).size).toBe(groupedIds.length);
    expect([...groupedIds].sort()).toEqual([...sidebarIds].sort());
  });

  it('mantém títulos específicos antes dos títulos gerais dos módulos', () => {
    expect(getNavigationTitle('/dashboard/preparacao')).toBe('Preparação do Encontro');
    expect(getNavigationTitle('/secretaria/lista-espera')).toBe('Lista de Espera');
    expect(getNavigationTitle('/circulos/fichas-pos-encontro')).toBe('Ficha Pós-Encontro');
    expect(getNavigationTitle('/compras/almoxarifado/pedidos')).toBe('Compras');
    expect(getNavigationTitle('/rota-desconhecida')).toBe('EJC Capelinha');
  });
});
