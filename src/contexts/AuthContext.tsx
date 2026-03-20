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

    const loadProfile = useCallback(async (userId: string, isInitialLoad = false) => {
        // Só exibe o estado de loading na carga inicial (perfil ainda não carregado).
        // Em recargas subsequentes (ex: renovação de token ao voltar de outra aba),
        // atualizamos silenciosamente para não desmontar a árvore de componentes.
        if (isInitialLoad) setProfileLoading(true);

        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, temporary_password, created_at, updated_at')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Erro ao buscar perfil do usuário', error);
            if (isInitialLoad) {
                setProfile(null);
                setProfileLoading(false);
            }
            return;
        }

        setProfile((data as UserProfile | null) ?? null);
        if (isInitialLoad) setProfileLoading(false);
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
                loadProfile(session.user.id, true).finally(() => setLoading(false));
                return;
            }

            setProfile(null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            // TOKEN_REFRESHED apenas renova o JWT em segundo plano — não altera a
            // identidade do usuário, portanto não precisamos recarregar nada.
            if (event === 'TOKEN_REFRESHED') return;

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                // Carga subsequente: silenciosa, sem mostrar loading
                loadProfile(session.user.id, false);
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
