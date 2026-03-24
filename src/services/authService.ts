import { supabase } from '../lib/supabase';

export const authService = {
    async updatePassword(newPassword: string): Promise<void> {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;
    },

    async clearTemporaryPassword(): Promise<void> {
        const { error } = await supabase.rpc('clear_temporary_password');

        if (error) throw error;
    },

    async resetPassword(email: string): Promise<void> {
        const { error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'public-reset', email }
        });

        if (error) throw error;
    }
};

