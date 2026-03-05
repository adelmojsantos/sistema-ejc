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

export const adminUserService = {
    async listUsers(): Promise<AdminUserListItem[]> {
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'list' }
        });

        if (error) throw error;
        return (data?.users ?? []) as AdminUserListItem[];
    },

    async createUser(payload: CreateAdminUserPayload): Promise<CreateAdminUserResponse> {
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'create', ...payload }
        });

        if (error) throw error;
        return data as CreateAdminUserResponse;
    },

    async updateRole(userId: string, role: UserRole): Promise<void> {
        const { error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'update-role', userId, role }
        });

        if (error) throw error;
    },

    async resetTemporaryPassword(userId: string): Promise<ResetPasswordResponse> {
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'reset-password', userId }
        });

        if (error) throw error;
        return data as ResetPasswordResponse;
    }
};

