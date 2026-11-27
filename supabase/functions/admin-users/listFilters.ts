export type AdminUserAccessScope = 'with' | 'without' | 'all';
export type AdminUserPersonLinkScope = 'linked' | 'unlinked' | 'all';

interface UserMembership {
  grupo_id: string;
  encontro_id: string | null;
}

interface UserWithMemberships {
  grupos: UserMembership[];
}

interface UserWithPersonLink {
  pessoaVinculo: 'explicit' | 'email_fallback' | 'none';
}

interface SearchableUser {
  email: string;
  nome?: string;
  equipesNomes: Record<string, string>;
}

interface ContextMembershipFilter {
  targetEncontroId: string | null;
  accessScope: AdminUserAccessScope;
  grupoId: string;
}

export function hasAccessInContext(
  user: UserWithMemberships,
  targetEncontroId: string | null,
) {
  return user.grupos.some((membership) => membership.encontro_id === targetEncontroId);
}

export function matchesContextMembershipFilters(
  user: UserWithMemberships,
  filter: ContextMembershipFilter,
) {
  const contextMemberships = user.grupos.filter(
    (membership) => membership.encontro_id === filter.targetEncontroId,
  );

  if (filter.accessScope === 'with' && contextMemberships.length === 0) return false;
  if (filter.accessScope === 'without' && contextMemberships.length > 0) return false;
  if (
    filter.grupoId !== 'all'
    && !contextMemberships.some((membership) => membership.grupo_id === filter.grupoId)
  ) return false;

  return true;
}

export function matchesPersonLinkScope(
  user: UserWithPersonLink,
  scope: AdminUserPersonLinkScope,
) {
  if (scope === 'all') return true;
  const hasLinkedPerson = user.pessoaVinculo !== 'none';
  return scope === 'linked' ? hasLinkedPerson : !hasLinkedPerson;
}

export function matchesUserSearch(
  user: SearchableUser,
  rawSearch: string,
  equipeEncontroId: string | null,
) {
  const search = rawSearch.trim().toLowerCase();
  if (!search) return true;

  const equipes = equipeEncontroId
    ? [user.equipesNomes[equipeEncontroId] ?? '']
    : Object.values(user.equipesNomes);
  const searchable = [user.email, user.nome ?? '', ...equipes].join(' ').toLowerCase();

  return searchable.includes(search);
}

interface UserWithAccountStatus extends UserWithMemberships, UserWithPersonLink {
  temporary_password: boolean | null;
}

/**
 * Contadores do contexto selecionado. As permissões valem por encontro, então
 * pendências de primeiro acesso e de vínculo são contadas só entre quem tem
 * perfil no contexto.
 */
export function summarizeContextAccess(
  users: UserWithAccountStatus[],
  targetEncontroId: string | null,
) {
  const withAccess = users.filter((user) => hasAccessInContext(user, targetEncontroId));

  return {
    totalWithTargetAccess: withAccess.length,
    totalWithTargetAccessPendingFirstLogin: withAccess.filter((user) => user.temporary_password === true).length,
    totalWithTargetAccessWithoutPerson: withAccess.filter((user) => user.pessoaVinculo === 'none').length,
  };
}
