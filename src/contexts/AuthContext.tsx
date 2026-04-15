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
                .select('id, email, temporary_password, created_at, updated_at')
                .eq('id', userId)
                .maybeSingle();

            if (profileError) throw profileError;

            // 2. Fetch Active Encounter
            const { data: encounterData, error: encounterError } = await supabase
                .from('encontros')
                .select('id')
                .eq('ativo', true)
                .limit(1)
                .maybeSingle();

            const activeEncontroId = (!encounterError && encounterData) ? encounterData.id : null;

            if (profileError) throw profileError;

            // 3. Fetch User Groups and Permissions
            const grupos: string[] = [];
            const permissions: string[] = [];

            const { data: ugData, error: ugError } = await supabase
                .from('usuario_grupos')
                .select(`
                    encontro_id,
                    grupos (
                        nome,
                        grupo_permissoes (
                            permissoes (
                                chave
                            )
                        )
                    )
                `)
                .eq('usuario_id', userId);

            if (!ugError && ugData) {
                // Flatten results, only allowing global groups OR groups for the active encounter
                (ugData as any[]).forEach((ug: any) => {
                    const isGlobal = !ug.encontro_id;
                    const isActiveEncounter = activeEncontroId && ug.encontro_id === activeEncontroId;

                    const grupo = Array.isArray(ug.grupos) ? ug.grupos[0] : ug.grupos;

                    if (grupo && (isGlobal || isActiveEncounter)) {
                        grupos.push(grupo.nome);
                        const gps = Array.isArray(grupo.grupo_permissoes) ? grupo.grupo_permissoes : [grupo.grupo_permissoes];
                        
                        gps.forEach((gp: any) => {
                            if (gp?.permissoes) {
                                const perms = Array.isArray(gp.permissoes) ? gp.permissoes : [gp.permissoes];
                                perms.forEach((p: any) => {
                                    if (p?.chave && !permissions.includes(p.chave)) {
                                        permissions.push(p.chave);
                                    }
                                });
                            }
                        });
                    }
                });
            }

            const extendedProfile: UserProfile = {
                ...(profileData as unknown as UserProfile),
                grupos,
                permissions
            };

            setProfile(extendedProfile);

            // 4. Fetch Latest Participation for the active encounter
            if (activeEncontroId && profileData?.email) {
                const { data: partData, error: partError } = await supabase
                    .from('participacoes')
                    .select('*, pessoas!inner(nome_completo, cpf, email), equipes(nome)')
                    .eq('pessoas.email', profileData.email)
                    .eq('encontro_id', activeEncontroId)
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
                // Wait for profile info if it hasn't loaded yet (like during a refresh event)
                const isFirstLoad = !profile;
                loadProfile(session.user.id, isFirstLoad).finally(() => setLoading(false));
            } else {
                setProfile(null);
                setUserParticipacao(null);
                setLoading(false);
            }
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

    const hasPermission = useCallback((permission: string) => {
        if (!profile?.permissions) return false;
        // Admins can be configured to have all permissions by db entry. Or we can hardcode fallback:
        if (profile.permissions.includes('modulo_admin')) return true;
        return profile.permissions.includes(permission);
    }, [profile]);

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
                loading,
                hasPermission
            }}
        >
            {!loading && children}
        </AuthContext.Provider>
    );
}
