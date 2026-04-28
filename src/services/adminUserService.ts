import { supabase } from '../lib/supabase';

export interface UserGrupoVinculo {
    grupo_id: string;
    encontro_id: string | null;
}

export interface AdminUserListItem {
    id: string;
    email: string;
    temporary_password: boolean;
    created_at: string;
    grupos: UserGrupoVinculo[];
}

interface CreateAdminUserPayload {
    email: string;
    gruposIds: string[];
    encontroId: string | null;
}

interface CreateAdminUserResponse {
    user: AdminUserListItem;
    temporaryPassword: string;
}

interface ResetPasswordResponse {
    user: AdminUserListItem;
    temporaryPassword: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Sessão expirada. Faça login novamente.');
    return { Authorization: `Bearer ${token}` };
}

export const adminUserService = {
    async listUsers(): Promise<AdminUserListItem[]> {
        const headers = await getAuthHeaders();

        // Fetch base users profile data via Edge Function (safe from strict RLS block without service role)
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
            body: { action: 'list' },
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

        const users = edgeData?.users || [];

        // Fetch groups
        const { data: ugData, error: ugError } = await supabase
            .from('usuario_grupos')
            .select('usuario_id, grupo_id, encontro_id');

        if (ugError) {
            console.error('[adminUserService] Error fetching usuario_grupos:', ugError);
            throw ugError;
        }

        const ugMap = new Map<string, UserGrupoVinculo[]>();
        for (const ug of ugData || []) {
            if (!ugMap.has(ug.usuario_id)) ugMap.set(ug.usuario_id, []);
            ugMap.get(ug.usuario_id)!.push({ grupo_id: ug.grupo_id, encontro_id: ug.encontro_id });
        }

        interface RawEdgeUser { id: string; email: string; temporary_password: boolean; created_at: string; }
        return users.map((u: RawEdgeUser) => ({
            id: u.id,
            email: u.email,
            temporary_password: u.temporary_password,
            created_at: u.created_at,
            grupos: ugMap.get(u.id) || []
        })) as AdminUserListItem[];
    },

    async createUser(payload: CreateAdminUserPayload): Promise<CreateAdminUserResponse> {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke('admin-users', {
            // we pass a dummy 'viewer' role to not break the edge function's upsert to profiles, which might still have role fallback
            body: { action: 'create', email: payload.email, role: 'viewer' },
            headers,
        });

        if (error) throw error;

        const response = data as CreateAdminUserResponse;

        // Link groups
        if (payload.gruposIds.length > 0) {
            const ugPayload = payload.gruposIds.map(gId => ({ 
                usuario_id: response.user.id, 
                grupo_id: gId,
                encontro_id: payload.encontroId
            }));
            await supabase.from('usuario_grupos').insert(ugPayload);
        }

        return response;
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

    async resetTemporaryPassword(userId: string): Promise<ResetPasswordResponse> {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'reset-password', userId },
            headers,
        });

        if (error) throw error;
        return data as ResetPasswordResponse;
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
