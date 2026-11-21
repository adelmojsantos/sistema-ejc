// Regras da liberação de acessos feita pelo coordenador da equipe.
// O coordenador só libera integrantes da própria equipe, no encontro ativo,
// em equipes marcadas com "Libera acesso de integrantes", e somente os casos
// que não envolvem vínculo de contas existentes.

export type CoordinatorScopeFailure = 'encontro_inativo' | 'nao_coordenador' | 'equipe_nao_habilitada';

export interface CoordinatorScopeInput {
  encontro: { id: string; nome: string | null } | null;
  participacao: { equipe_id: string | null; coordenador: boolean | null } | null;
  equipe: { id: string; nome: string | null; libera_acesso_integrantes: boolean | null; deleted_at: string | null } | null;
}

export type CoordinatorScope =
  | { ok: true; encontroId: string; encontroNome: string; equipeId: string; equipeNome: string }
  | { ok: false; reason: CoordinatorScopeFailure; message: string };

export const COORDINATOR_SCOPE_MESSAGES: Record<CoordinatorScopeFailure, string> = {
  encontro_inativo: 'A liberação de acessos só é possível durante o encontro ativo.',
  nao_coordenador: 'Somente o coordenador da equipe no encontro ativo pode liberar acessos.',
  equipe_nao_habilitada: 'Sua equipe não está habilitada para liberar acessos de integrantes.',
};

export function evaluateCoordinatorScope({ encontro, participacao, equipe }: CoordinatorScopeInput): CoordinatorScope {
  if (!encontro) {
    return { ok: false, reason: 'encontro_inativo', message: COORDINATOR_SCOPE_MESSAGES.encontro_inativo };
  }
  if (!participacao?.coordenador || !participacao.equipe_id) {
    return { ok: false, reason: 'nao_coordenador', message: COORDINATOR_SCOPE_MESSAGES.nao_coordenador };
  }
  if (!equipe || equipe.id !== participacao.equipe_id || equipe.deleted_at || equipe.libera_acesso_integrantes !== true) {
    return { ok: false, reason: 'equipe_nao_habilitada', message: COORDINATOR_SCOPE_MESSAGES.equipe_nao_habilitada };
  }

  return {
    ok: true,
    encontroId: encontro.id,
    encontroNome: encontro.nome ?? 'Encontro ativo',
    equipeId: equipe.id,
    equipeNome: equipe.nome ?? 'Sua equipe',
  };
}

/** Status que o coordenador pode processar: criar conta (convite) ou conceder perfis pendentes. */
export const COORDINATOR_RELEASABLE_STATUSES = ['sem_usuario', 'perfis_pendentes'] as const;

export function isCoordinatorReleasable(status: string): boolean {
  return (COORDINATOR_RELEASABLE_STATUSES as readonly string[]).includes(status);
}

interface ScopedCandidate {
  participacao_id: string;
  equipe_id: string;
  papel: 'coordenador' | 'integrante';
  status: string;
}

export function filterCoordinatorTeamCandidates<T extends ScopedCandidate>(candidates: T[], equipeId: string): T[] {
  return candidates.filter((candidate) => candidate.equipe_id === equipeId && candidate.papel === 'integrante');
}

export function selectCoordinatorCandidates<T extends ScopedCandidate>(
  teamCandidates: T[],
  participacaoIds: string[],
): { ok: true; selected: T[] } | { ok: false; message: string } {
  const uniqueIds = [...new Set(participacaoIds)];
  if (uniqueIds.length === 0) {
    return { ok: false, message: 'Selecione ao menos um integrante para liberar o acesso.' };
  }

  const byId = new Map(teamCandidates.map((candidate) => [candidate.participacao_id, candidate]));
  const selected: T[] = [];
  for (const id of uniqueIds) {
    const candidate = byId.get(id);
    if (!candidate) {
      return { ok: false, message: 'A seleção contém uma pessoa que não é integrante da sua equipe com acesso configurado.' };
    }
    if (!isCoordinatorReleasable(candidate.status)) {
      return { ok: false, message: 'A seleção contém uma pessoa que não pode ser liberada pela coordenação. Atualize a lista.' };
    }
    selected.push(candidate);
  }

  return { ok: true, selected };
}
