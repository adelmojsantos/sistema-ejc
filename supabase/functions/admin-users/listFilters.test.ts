import { describe, expect, it } from 'vitest';
import {
  matchesContextMembershipFilters,
  matchesPersonLinkScope,
  matchesUserSearch,
} from './listFilters';

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

describe('admin user person link filter', () => {
  it('separa contas vinculadas das contas sem pessoa', () => {
    expect(matchesPersonLinkScope({ pessoaVinculo: 'explicit' }, 'linked')).toBe(true);
    expect(matchesPersonLinkScope({ pessoaVinculo: 'email_fallback' }, 'linked')).toBe(true);
    expect(matchesPersonLinkScope({ pessoaVinculo: 'none' }, 'linked')).toBe(false);
    expect(matchesPersonLinkScope({ pessoaVinculo: 'none' }, 'unlinked')).toBe(true);
  });

  it('não restringe resultados quando o filtro está neutro', () => {
    expect(matchesPersonLinkScope({ pessoaVinculo: 'none' }, 'all')).toBe(true);
  });
});

describe('admin user search', () => {
  const searchableUser = {
    email: 'maria@example.com',
    nome: 'Maria da Silva',
    equipesNomes: {
      atual: 'Acolhida',
      anterior: 'Cozinha',
    },
  };

  it('busca por nome e e-mail independentemente do encontro', () => {
    expect(matchesUserSearch(searchableUser, 'maria da', 'atual')).toBe(true);
    expect(matchesUserSearch(searchableUser, 'EXAMPLE.COM', 'atual')).toBe(true);
  });

  it('considera somente a equipe do encontro relevante', () => {
    expect(matchesUserSearch(searchableUser, 'acolhida', 'atual')).toBe(true);
    expect(matchesUserSearch(searchableUser, 'cozinha', 'atual')).toBe(false);
    expect(matchesUserSearch(searchableUser, 'cozinha', 'anterior')).toBe(true);
  });

  it('considera todas as equipes apenas no contexto global', () => {
    expect(matchesUserSearch(searchableUser, 'cozinha', null)).toBe(true);
  });
});
