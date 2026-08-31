export type AdminUserAccessScope = 'with' | 'without' | 'all';

interface UserMembership {
  grupo_id: string;
  encontro_id: string | null;
}

interface UserWithMemberships {
  grupos: UserMembership[];
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
