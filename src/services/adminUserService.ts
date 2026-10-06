import { supabase } from '../lib/supabase';
import type { Pessoa } from '../types/pessoa';

export interface UserGrupoVinculo {
    grupo_id: string;
    encontro_id: string | null;
}

export interface AdminUserListItem {
    id: string;
    email: string;
    pessoaId?: string | null;
    pessoaVinculo?: 'explicit' | 'email_fallback' | 'none';
    temporary_password: boolean;
    created_at: string;
    grupos: UserGrupoVinculo[];
    nome?: string;
    encontrosIds?: string[];
    equipesNomes?: Record<string, string>;
}

export interface AdminUsersQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    grupoId?: string;
    encontroId?: string;
    tempPassword?: 'all' | 'sim' | 'nao';
    targetEncontroId?: string | null;
    accessScope?: 'with' | 'without' | 'all';
    personLinkScope?: 'linked' | 'unlinked' | 'all';
}

export interface AdminUsersSummary {
    totalUsers: number;
    totalTemporaryPassword: number;
    totalWithoutPerson: number;
    totalWithTargetAccess: number;
    filteredTotal: number;
}

export interface AdminUsersListResponse {
    users: AdminUserListItem[];
    total: number;
    page: number;
    pageSize: number;
    summary: AdminUsersSummary;
}

export interface CoordenadorPastaAccessItem {
    participacao_id: string;
    pessoa_id: string;
    nome_completo: string;
    email: string | null;
    equipe_id: string | null;
    equipe_nome: string | null;
    user_id: string | null;
    possui_usuario: boolean;
    possui_perfil: boolean;
    temporary_password: boolean | null;
}

export interface CoordenadorPastaPrepareResult {
    participacao_id: string;
    pessoa_id: string;
    nome_completo: string;
    email: string | null;
    user_id: string | null;
    created: boolean;
    granted: boolean;
    success: boolean;
    message?: string;
}

export interface CoordenadorPastaAccessResponse {
    coordenadores: CoordenadorPastaAccessItem[];
    total: number;
    semEmail: number;
    semUsuario: number;
    semPerfil: number;
}

interface CreateAdminUserPayload {
    email: string;
    pessoaId: string;
    gruposIds: string[];
    encontroId: string | null;
}

interface CreateAdminUserResponse {
    user: AdminUserListItem;
    invitationSent: boolean;
    accessesGranted?: boolean;
}

interface ResetPasswordResponse {
    user: AdminUserListItem;
    recoveryEmailSent: boolean;
}

export interface SecurePendingPasswordsResponse {
    total: number;
    invalidated: number;
    recoveryEmailsSent: number;
    failed: number;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Sessão expirada. Faça login novamente.');
    return { Authorization: `Bearer ${token}` };
}

async function edgeFunctionErrorMessage(error: unknown): Promise<string | null> {
    const context = error && typeof error === 'object' && 'context' in error
        ? (error as { context?: Response }).context
        : undefined;
    if (!context) return null;

    try {
        const payload = await context.clone().json() as { error?: unknown };
        return typeof payload.error === 'string' ? payload.error : null;
    } catch {
        return null;
    }
}

async function throwEdgeFunctionError(error: unknown): Promise<never> {
    const message = await edgeFunctionErrorMessage(error);
    if (message) throw new Error(message);
    throw error;
}

export const adminUserService = {
    async listUsers(query: AdminUsersQuery = {}): Promise<AdminUsersListResponse> {
        const headers = await getAuthHeaders();

        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
            body: {
                action: 'list',
                page: query.page ?? 0,
                pageSize: query.pageSize ?? 20,
                search: query.search ?? '',
                grupoId: query.grupoId ?? 'all',
                encontroId: query.encontroId ?? 'all',
                tempPassword: query.tempPassword ?? 'all',
                targetEncontroId: query.targetEncontroId ?? null,
                accessScope: query.accessScope ?? 'with',
                personLinkScope: query.personLinkScope ?? 'all',
            },
            headers,
        });

        if (edgeError) {
            console.error('[adminUserService] Error invoking admin-users edge function:', edgeError);
            throw edgeError;
        }
        if (edgeData?.error) {
            console.error('[adminUserService] edgeData returned error:', edgeData.error);
            throw new Error(edgeData.error);
        }

        return {
            users: edgeData?.users || [],
            total: edgeData?.total || 0,
            page: edgeData?.page || 0,
            pageSize: edgeData?.pageSize || query.pageSize || 20,
            summary: edgeData?.summary || {
                totalUsers: 0,
                totalTemporaryPassword: 0,
                totalWithoutPerson: 0,
                totalWithTargetAccess: 0,
                filteredTotal: 0,
            },
        };
    },

    async listCoordenadoresPasta(encontroId: string, grupoId?: string): Promise<CoordenadorPastaAccessResponse> {
        const headers = await getAuthHeaders();

        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: {
                action: 'list-folder-coordinators',
                encontroId,
                grupoId: grupoId || null,
            },
            headers,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data as CoordenadorPastaAccessResponse;
    },

    async prepareCoordenadoresPasta(encontroId: string, grupoId: string): Promise<{
        results: CoordenadorPastaPrepareResult[];
        created: number;
        granted: number;
        skipped: number;
    }> {
        const headers = await getAuthHeaders();

        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: {
                action: 'prepare-folder-coordinators',
                encontroId,
                grupoId,
            },
            headers,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    },

    async updatePersonEmail(pessoaId: string, email: string): Promise<{ id: string; nome_completo: string; email: string }> {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'update-person-email', pessoaId, email },
            headers,
        });

        if (error) {
            const context = (error as { context?: Response }).context;
            let contextMessage: string | undefined;
            if (context) {
                try {
                    const payload = await context.clone().json() as { error?: string };
                    contextMessage = payload.error;
                } catch { /* mantém o erro original quando a resposta não contém JSON */ }
            }
            if (contextMessage) throw new Error(contextMessage);
            throw error;
        }
        if (data?.error) throw new Error(data.error);
        return data.person;
    },

    async searchPeople(search: string, page: number = 0, pageSize: number = 20): Promise<Pessoa[]> {
        const headers = await getAuthHeaders();

        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: {
                action: 'search-people',
                search,
                page,
                pageSize,
            },
            headers,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        return (data?.people || []) as Pessoa[];
    },

    async createUser(payload: CreateAdminUserPayload): Promise<CreateAdminUserResponse> {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: {
                action: 'create',
                email: payload.email,
                pessoaId: payload.pessoaId,
                role: 'viewer',
                gruposIds: payload.gruposIds,
                encontroId: payload.encontroId,
            },
            headers,
        });

        if (error) await throwEdgeFunctionError(error);
        if (data?.error) throw new Error(data.error);

        const response = data as CreateAdminUserResponse;

        // Compatibilidade temporária caso o frontend seja publicado antes da Edge Function nova.
        if (response.accessesGranted !== true && payload.gruposIds.length > 0) {
            const ugPayload = payload.gruposIds.map(gId => ({ 
                usuario_id: response.user.id, 
                grupo_id: gId,
                encontro_id: payload.encontroId
            }));
            const { error: grantError } = await supabase.from('usuario_grupos').insert(ugPayload);
            if (grantError) {
                const { error: cleanupError } = await supabase.functions.invoke('admin-users', {
                    body: { action: 'delete', userId: response.user.id },
                    headers,
                });
                if (cleanupError) {
                    throw new Error('A conta foi criada, mas os acessos não foram concedidos. Localize a conta pelo e-mail antes de tentar novamente.');
                }
                throw new Error('Não foi possível conceder os perfis selecionados. Nenhuma conta foi mantida; tente novamente.');
            }
        }

        return response;
    },

    async linkUserToPerson(userId: string, pessoaId: string): Promise<void> {
        const { error } = await supabase.rpc('vincular_profile_pessoa', {
            p_profile_id: userId,
            p_pessoa_id: pessoaId,
        });

        if (error) throw error;
    },

    async updateGrupos(userId: string, currentVinculos: UserGrupoVinculo[], action: 'add' | 'remove', gId: string, encontroId: string | null): Promise<UserGrupoVinculo[]> {
        if (action === 'remove') {
            let query = supabase
                .from('usuario_grupos')
                .delete()
                .eq('usuario_id', userId)
                .eq('grupo_id', gId);
            
            if (encontroId === null) {
                query = query.is('encontro_id', null);
            } else {
                query = query.eq('encontro_id', encontroId);
            }

            const { error } = await query;
            if (error) throw error;
                
            return currentVinculos.filter(v => !(v.grupo_id === gId && v.encontro_id === encontroId));
        } else {
            const { error } = await supabase
                .from('usuario_grupos')
                .insert([{ usuario_id: userId, grupo_id: gId, encontro_id: encontroId }]);
            
            if (error) throw error;
                
            return [...currentVinculos, { grupo_id: gId, encontro_id: encontroId }];
        }
    },

    async sendPasswordRecovery(userId: string): Promise<ResetPasswordResponse> {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'reset-password', userId },
            headers,
        });

        if (error) throw error;
        return data as ResetPasswordResponse;
    },

    async securePendingPasswords(): Promise<SecurePendingPasswordsResponse> {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'secure-pending-passwords' },
            headers,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data as SecurePendingPasswordsResponse;
    },

    async deleteUser(userId: string): Promise<void> {
        const headers = await getAuthHeaders();
        const { error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'delete', userId },
            headers,
        });

        if (error) throw error;
    },

    async listGrupos(): Promise<{ id: string, nome: string }[]> {
        const { data, error } = await supabase.from('grupos').select('id, nome').order('nome');
        if (error) throw error;
        return data || [];
    },

    async listTeamMembers(encontroId: string, equipeId: string) {
        const { data, error } = await supabase
            .from('participacoes')
            .select('id, pessoa_id, equipe_id, encontro_id, coordenador, participante, dados_confirmados, confirmado_em, pessoas(id, nome_completo, email)')
            .eq('encontro_id', encontroId)
            .eq('equipe_id', equipeId)
            .order('pessoas(nome_completo)', { ascending: true });

        if (error) throw error;
        return data || [];
    }
};
