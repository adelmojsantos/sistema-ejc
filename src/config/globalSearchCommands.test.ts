import { describe, expect, it } from 'vitest';
import type { NavigationAccessContext } from './navigation';
import { getGlobalSearchCommands, normalizeGlobalSearchText } from './globalSearchCommands';

function context(
  permissions: string[],
  options: { hasSharedLibraryItems?: boolean } = {}
): NavigationAccessContext {
  const allowed = new Set(permissions);
  return {
    hasPermission: (permission) => allowed.has('modulo_admin') || allowed.has(permission),
    hasExactPermission: (permission) => allowed.has(permission),
    isCoordinator: false,
    hasSharedLibraryItems: options.hasSharedLibraryItems ?? false,
  };
}

describe('comandos da busca global', () => {
  it('normaliza acentos, caixa e espaços para a pesquisa', () => {
    expect(normalizeGlobalSearchText('  Confirmação de DADOS  ')).toBe('confirmacao de dados');
  });

  it('oferece confirmação e fotos por palavras-chave à Secretaria', () => {
    const commands = getGlobalSearchCommands(context(['modulo_secretaria']));
    const search = (term: string) => commands.filter((command) =>
      normalizeGlobalSearchText(`${command.label} ${command.description} ${command.keywords}`)
        .includes(normalizeGlobalSearchText(term))
    );

    expect(search('dados').map(({ id }) => id)).toContain('secretaria-confirmacoes');
    expect(search('foto').map(({ id }) => id)).toContain('secretaria-fotos-familias');
  });

  it('não expõe atalhos internos sem a permissão correspondente', () => {
    const commands = getGlobalSearchCommands(context(['modulo_recepcao']));

    expect(commands.map(({ id }) => id)).not.toContain('secretaria-confirmacoes');
    expect(commands.map(({ id }) => id)).not.toContain('secretaria-fotos-familias');
  });

  it('não concede Diagnósticos apenas por possuir administração geral', () => {
    const adminCommands = getGlobalSearchCommands(context(['modulo_admin']));
    const developerCommands = getGlobalSearchCommands(context(['modulo_diagnosticos']));

    expect(adminCommands.map(({ id }) => id)).not.toContain('root-diagnosticos');
    expect(developerCommands.map(({ id }) => id)).toContain('root-diagnosticos');
  });

  it('oferece uma única Biblioteca quando há gestão ou itens compartilhados', () => {
    const withoutAccess = getGlobalSearchCommands(context(['modulo_recepcao']));
    const sharedAccess = getGlobalSearchCommands(context(
      ['modulo_recepcao'],
      { hasSharedLibraryItems: true }
    ));
    const managerAccess = getGlobalSearchCommands(context(['modulo_biblioteca']));

    expect(withoutAccess.map(({ id }) => id)).not.toContain('root-biblioteca');
    expect(sharedAccess.filter(({ id }) => id === 'root-biblioteca')).toHaveLength(1);
    expect(managerAccess.filter(({ id }) => id === 'root-biblioteca')).toHaveLength(1);
    expect(sharedAccess.find(({ id }) => id === 'root-biblioteca')?.path).toBe('/biblioteca');
  });
});
