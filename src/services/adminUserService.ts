import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/auth';

export interface AdminUserListItem {
    id: string;
    email: string;
    role: UserRole;
    temporary_password: boolean;
    created_at: string;
}

interface CreateAdminUserPayload {
    email: string;
    role: UserRole;
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
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'list' },
            headers,
        });

        if (error) throw error;
        return (data?.users ?? []) as AdminUserListItem[];
    },

    async createUser(payload: CreateAdminUserPayload): Promise<CreateAdminUserResponse> {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'create', ...payload },
            headers,
        });

        if (error) throw error;
        return data as CreateAdminUserResponse;
    },

    async updateRole(userId: string, role: UserRole): Promise<void> {
        const headers = await getAuthHeaders();
        const { error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'update-role', userId, role },
            headers,
        });

        if (error) throw error;
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
};
