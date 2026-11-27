import type { AccessProvisioningCandidate } from '../../services/accessProvisioningService';

export interface CandidateFilters {
    equipeId: string;
    papel: 'all' | AccessProvisioningCandidate['papel'];
    status: 'all' | 'pendentes' | AccessProvisioningCandidate['status'];
}

export const RELEASE_ACTIONABLE_STATUSES: AccessProvisioningCandidate['status'][] = ['sem_usuario', 'sem_vinculo', 'perfis_pendentes'];

export function isReleaseActionable(candidate: Pick<AccessProvisioningCandidate, 'status'>): boolean {
    return RELEASE_ACTIONABLE_STATUSES.includes(candidate.status);
}

export function filterReleaseCandidates<T extends Pick<AccessProvisioningCandidate, 'equipe_id' | 'papel' | 'status'>>(
    candidates: T[],
    filters: CandidateFilters,
): T[] {
    return candidates.filter(candidate => {
        if (filters.equipeId !== 'all' && candidate.equipe_id !== filters.equipeId) return false;
        if (filters.papel !== 'all' && candidate.papel !== filters.papel) return false;
        if (filters.status === 'pendentes') return isReleaseActionable(candidate);
        if (filters.status !== 'all' && candidate.status !== filters.status) return false;
        return true;
    });
}
