import type { AdminUserListItem, AdminUsersQuery, AdminUsersSummary } from '../../../services/adminUserService';
import type { Encontro } from '../../../types/encontro';

/**
 * Regra da tela: o usuário (conta) é global, mas as permissões são do encontro
 * selecionado. Tudo o que é exibido sobre perfis e pendências considera somente
 * esse contexto. `null` representa os acessos permanentes (administração e dirigência).
 */
export type AccessContextId = string | null;

export interface AdminGroup {
    id: string;
    nome: string;
    descricao: string | null;
}

export type UserListView = 'com_acesso' | 'primeiro_acesso' | 'sem_pessoa' | 'sem_acesso' | 'todas';

type ViewQuery = Pick<AdminUsersQuery, 'accessScope' | 'tempPassword' | 'personLinkScope'>;

const VIEW_QUERIES: Record<UserListView, Required<ViewQuery>> = {
    com_acesso: { accessScope: 'with', tempPassword: 'all', personLinkScope: 'all' },
    primeiro_acesso: { accessScope: 'with', tempPassword: 'sim', personLinkScope: 'all' },
    sem_pessoa: { accessScope: 'with', tempPassword: 'all', personLinkScope: 'unlinked' },
    sem_acesso: { accessScope: 'without', tempPassword: 'all', personLinkScope: 'all' },
    todas: { accessScope: 'all', tempPassword: 'all', personLinkScope: 'all' },
};

export function viewToQuery(view: UserListView): Required<ViewQuery> {
    return VIEW_QUERIES[view];
}

export interface UserListViewOption {
    id: UserListView;
    label: string;
    hint: string;
    count: number | null;
}

export function getUserListViews(summary: AdminUsersSummary, isPermanentContext: boolean): UserListViewOption[] {
    const withAccess = summary.totalWithTargetAccess;
    const accessLabel = isPermanentContext ? 'Com acesso permanente' : 'Com acesso neste encontro';
    const withoutLabel = isPermanentContext ? 'Sem acesso permanente' : 'Sem acesso neste encontro';

    return [
        { id: 'com_acesso', label: accessLabel, hint: 'Contas com ao menos um perfil no contexto.', count: withAccess },
        {
            id: 'primeiro_acesso',
            label: 'Aguardando 1º acesso',
            hint: 'Têm perfil, mas ainda não definiram a senha.',
            count: summary.totalWithTargetAccessPendingFirstLogin ?? null,
        },
        {
            id: 'sem_pessoa',
            label: 'Sem pessoa vinculada',
            hint: 'Têm perfil, mas a conta não está ligada a um cadastro.',
            count: summary.totalWithTargetAccessWithoutPerson ?? null,
        },
        {
            id: 'sem_acesso',
            label: withoutLabel,
            hint: 'Contas existentes sem nenhum perfil no contexto.',
            count: Math.max(summary.totalUsers - withAccess, 0),
        },
        { id: 'todas', label: 'Todas as contas', hint: 'Todas as contas do sistema.', count: summary.totalUsers },
    ];
}

export function getEncontroLabel(encontro: Pick<Encontro, 'nome' | 'edicao' | 'tema'> | null | undefined): string {
    if (!encontro) return 'Encontro';
    return encontro.nome || (encontro.edicao ? `${encontro.edicao}º EJC` : '') || encontro.tema || 'Encontro';
}

export function getContextGroupIds(user: Pick<AdminUserListItem, 'grupos'>, contextId: AccessContextId): string[] {
    return (user.grupos || [])
        .filter(vinculo => vinculo.encontro_id === contextId)
        .map(vinculo => vinculo.grupo_id);
}

export function getContextTeam(user: Pick<AdminUserListItem, 'equipesNomes'>, contextId: AccessContextId): string | null {
    if (!contextId) return null;
    return user.equipesNomes?.[contextId] || null;
}

export type UserSituation = 'sem_acesso' | 'primeiro_acesso' | 'vinculo' | 'ativo';

export const USER_SITUATION_LABELS: Record<UserSituation, string> = {
    sem_acesso: 'Sem acesso',
    primeiro_acesso: 'Aguardando 1º acesso',
    vinculo: 'Vínculo pendente',
    ativo: 'Acesso ativo',
};

/** Situação principal da conta no contexto, na ordem do que precisa ser resolvido primeiro. */
export function getUserSituation(user: AdminUserListItem, contextId: AccessContextId): UserSituation {
    if (getContextGroupIds(user, contextId).length === 0) return 'sem_acesso';
    if (user.temporary_password) return 'primeiro_acesso';
    if (user.pessoaVinculo !== 'explicit') return 'vinculo';
    return 'ativo';
}

export type ChecklistState = 'done' | 'warning' | 'pending';

export interface ChecklistItem {
    id: 'conta' | 'pessoa' | 'senha' | 'perfil';
    label: string;
    state: ChecklistState;
    detail: string;
}

export function getUserChecklist(user: AdminUserListItem, contextId: AccessContextId, contextLabel: string): ChecklistItem[] {
    const contextGroups = getContextGroupIds(user, contextId).length;
    const pessoaState: ChecklistState = user.pessoaVinculo === 'explicit'
        ? 'done'
        : user.pessoaVinculo === 'email_fallback' ? 'warning' : 'pending';

    return [
        {
            id: 'conta',
            label: 'Conta criada',
            state: 'done',
            detail: `Desde ${new Date(user.created_at).toLocaleDateString('pt-BR')}`,
        },
        {
            id: 'pessoa',
            label: 'Pessoa vinculada',
            state: pessoaState,
            detail: pessoaState === 'done'
                ? 'Conta ligada ao cadastro da pessoa.'
                : pessoaState === 'warning'
                    ? 'Cadastro encontrado pelo e-mail. Confirme o vínculo.'
                    : 'Nenhum cadastro ligado a esta conta.',
        },
        {
            id: 'senha',
            label: 'Primeiro acesso',
            state: user.temporary_password ? 'pending' : 'done',
            detail: user.temporary_password
                ? 'A pessoa ainda não definiu a senha.'
                : 'Senha definida pela pessoa.',
        },
        {
            id: 'perfil',
            label: contextId ? `Perfil em ${contextLabel}` : 'Perfil permanente',
            state: contextGroups > 0 ? 'done' : 'pending',
            detail: contextGroups > 0
                ? `${contextGroups} perfil(is) concedido(s).`
                : 'Nenhum perfil concedido. Escolha abaixo.',
        },
    ];
}

export type TeamMemberAccessState =
    | { kind: 'sem_email' }
    | { kind: 'criar_conta' }
    | { kind: 'conceder'; userId: string; missingGroupIds: string[] }
    | { kind: 'completo'; userId: string };

/**
 * Situação de um integrante na liberação personalizada por equipe:
 * quem não tem conta recebe convite; quem já tem recebe só os perfis que faltam no encontro.
 */
export function getTeamMemberAccessState(
    member: { pessoa_id: string; email: string | null | undefined },
    users: AdminUserListItem[],
    contextId: AccessContextId,
    selectedGroupIds: string[],
): TeamMemberAccessState {
    const email = member.email?.trim().toLowerCase() || '';
    const account = users.find(user => user.pessoaId === member.pessoa_id)
        || (email ? users.find(user => user.email.trim().toLowerCase() === email) : undefined);

    if (!account) return email ? { kind: 'criar_conta' } : { kind: 'sem_email' };

    const current = new Set(getContextGroupIds(account, contextId));
    const missingGroupIds = selectedGroupIds.filter(id => !current.has(id));
    if (selectedGroupIds.length > 0 && missingGroupIds.length === 0) return { kind: 'completo', userId: account.id };
    return { kind: 'conceder', userId: account.id, missingGroupIds };
}
