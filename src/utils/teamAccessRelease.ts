import type { AccessProvisioningCandidate } from '../services/accessProvisioningService';

type CandidateStatus = AccessProvisioningCandidate['status'];

/** Status que a coordenação pode processar; os demais ficam com a administração. */
export const COORDINATOR_RELEASABLE_STATUSES: readonly CandidateStatus[] = ['sem_usuario', 'perfis_pendentes'];

export function isCoordinatorReleasable(status: CandidateStatus): boolean {
  return COORDINATOR_RELEASABLE_STATUSES.includes(status);
}

export interface CoordinatorStatusInfo {
  label: string;
  hint?: string;
  tone: 'pending' | 'success' | 'blocked';
}

export const COORDINATOR_STATUS_INFO: Record<CandidateStatus, CoordinatorStatusInfo> = {
  sem_usuario: { label: 'Criar conta', hint: 'Receberá convite por e-mail', tone: 'pending' },
  perfis_pendentes: { label: 'Conceder perfis', hint: 'Já tem conta; sem e-mail', tone: 'pending' },
  pronto: { label: 'Acesso liberado', tone: 'success' },
  sem_email: { label: 'Sem e-mail', hint: 'Cadastre o e-mail em Minha Equipe', tone: 'blocked' },
  sem_vinculo: { label: 'Procure a administração', hint: 'Conta existente precisa ser vinculada', tone: 'blocked' },
  conflito_vinculo: { label: 'Procure a administração', hint: 'E-mail ligado a outra pessoa', tone: 'blocked' },
};

export interface TeamAccessReleasePlan {
  convites: AccessProvisioningCandidate[];
  perfis: AccessProvisioningCandidate[];
}

/** Separa a seleção entre quem recebe convite por e-mail e quem só recebe os perfis. */
export function buildTeamAccessReleasePlan(
  candidates: AccessProvisioningCandidate[],
  selectedIds: readonly string[],
): TeamAccessReleasePlan {
  const selected = new Set(selectedIds);
  const chosen = candidates.filter(candidate => selected.has(candidate.participacao_id) && isCoordinatorReleasable(candidate.status));
  return {
    convites: chosen.filter(candidate => candidate.status === 'sem_usuario'),
    perfis: chosen.filter(candidate => candidate.status === 'perfis_pendentes'),
  };
}

/** Texto simples com os próximos passos, pronto para colar no grupo da equipe. */
export function buildTeamAccessInstructions(siteUrl: string): string {
  return [
    'Seu acesso ao sistema do EJC foi liberado!',
    '',
    'Se você recebeu um e-mail de convite:',
    '1. Abra o e-mail de convite (confira também a caixa de spam/lixo eletrônico).',
    '2. Clique no link do e-mail e crie a sua senha.',
    `3. Entre em ${siteUrl} com o seu e-mail e a nova senha.`,
    '',
    'Se você já tinha conta no sistema:',
    '• Saia e entre novamente para ver os novos menus.',
  ].join('\n');
}
