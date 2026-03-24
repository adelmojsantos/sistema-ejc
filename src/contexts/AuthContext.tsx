import React, { useCallback, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types/auth';
import { AuthContext } from './auth-context';
import type { InscricaoEnriched } from '../types/inscricao';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userParticipacao, setUserParticipacao] = useState<InscricaoEnriched | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async (userId: string, isInitialLoad = false) => {
        if (isInitialLoad) setProfileLoading(true);

        try {
            // 1. Fetch Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, email, role, temporary_password, created_at, updated_at')
                .eq('id', userId)
                .maybeSingle();

            if (profileError) throw profileError;
            setProfile((profileData as UserProfile | null) ?? null);

            // 2. Fetch Latest Participation for the active/latest encounter
            // First, get the latest encounter
            const { data: encounterData, error: encounterError } = await supabase
                .from('encontros')
                .select('id')
                .order('edicao', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!encounterError && encounterData) {
                const { data: partData, error: partError } = await supabase
                    .from('participacoes')
                    .select('*, pessoas(nome_completo, cpf, email), equipes(nome)')
                    .eq('pessoa_id', userId)
                    .eq('encontro_id', encounterData.id)
                    .maybeSingle();

                if (!partError) {
                    setUserParticipacao(partData as InscricaoEnriched | null);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar perfil/participação:', error);
            if (isInitialLoad) setProfile(null);
        } finally {
            if (isInitialLoad) setProfileLoading(false);
        }
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
                setUserParticipacao(null);
            }

            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [loadProfile]);
 
    useEffect(() => {
        if (!user) return;
 
        // Real-time sync for profile changes (role, temporary_password, etc.)
        const profileSubscription = supabase
            .channel(`profile-updates-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                () => {
                    refreshProfile();
                }
            )
            .subscribe();
 
        return () => {
            profileSubscription.unsubscribe();
        };
    }, [user, refreshProfile]);

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
                userParticipacao,
                mustChangePassword: !!profile?.temporary_password,
                profileLoading,
                loading
            }}
        >
            {!loading && children}
        </AuthContext.Provider>
    );
}
