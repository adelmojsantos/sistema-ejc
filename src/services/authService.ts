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
        const normalizedEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
            redirectTo: `${window.location.origin}/redefinir-senha`
        });

        if (error) throw error;
    }
};

