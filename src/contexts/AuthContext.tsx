import React, { useCallback, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types/auth';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async (userId: string) => {
        setProfileLoading(true);

        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, temporary_password, created_at, updated_at')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Erro ao buscar perfil do usuário', error);
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        setProfile((data as UserProfile | null) ?? null);
        setProfileLoading(false);
    }, []);

    const refreshProfile = useCallback(async () => {
        if (!user) return;
        await loadProfile(user.id);
    }, [loadProfile, user]);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                loadProfile(session.user.id).finally(() => setLoading(false));
                return;
            }

            setProfile(null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                loadProfile(session.user.id);
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [loadProfile]);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                signOut,
                profile,
                refreshProfile,
                mustChangePassword: !!profile?.temporary_password,
                profileLoading,
                loading
            }}
        >
            {!loading && children}
        </AuthContext.Provider>
    );
}
