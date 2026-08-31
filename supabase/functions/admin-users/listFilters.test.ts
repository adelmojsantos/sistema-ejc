import { describe, expect, it } from 'vitest';
import { matchesContextMembershipFilters } from './listFilters';

const user = {
  grupos: [
    { grupo_id: 'coordenador', encontro_id: 'encontro-anterior' },
    { grupo_id: 'secretaria', encontro_id: 'encontro-atual' },
    { grupo_id: 'admin', encontro_id: null },
  ],
};

describe('admin user context membership filters', () => {
  it('lista somente usuários com delegação no contexto por padrão', () => {
    expect(matchesContextMembershipFilters(user, {
      targetEncontroId: 'encontro-atual',
      accessScope: 'with',
      grupoId: 'all',
    })).toBe(true);

    expect(matchesContextMembershipFilters(user, {
      targetEncontroId: 'outro-encontro',
      accessScope: 'with',
      grupoId: 'all',
    })).toBe(false);
  });

  it('não aceita um perfil concedido em outro encontro', () => {
    expect(matchesContextMembershipFilters(user, {
      targetEncontroId: 'encontro-atual',
      accessScope: 'with',
      grupoId: 'coordenador',
    })).toBe(false);
  });

  it('permite localizar contas sem acesso no contexto', () => {
    expect(matchesContextMembershipFilters(user, {
      targetEncontroId: 'outro-encontro',
      accessScope: 'without',
      grupoId: 'all',
    })).toBe(true);
  });

  it('trata o escopo global separadamente dos encontros', () => {
    expect(matchesContextMembershipFilters(user, {
      targetEncontroId: null,
      accessScope: 'with',
      grupoId: 'admin',
    })).toBe(true);
  });
});
