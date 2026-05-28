import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types/auth';
import { AuthContext } from './auth-context';
import type { InscricaoEnriched } from '../types/inscricao';

const PROFILE_CACHE_TTL_MS = 3 * 60 * 1000;

interface AuthProfileCacheEntry {
    profile: UserProfile;
    userParticipacao: InscricaoEnriched | null;
    cachedAt: number;
}

const getProfileCacheKey = (userId: string) => `auth-profile:${userId}`;

const readProfileCache = (userId: string): AuthProfileCacheEntry | null => {
    try {
        const raw = sessionStorage.getItem(getProfileCacheKey(userId));
        if (!raw) return null;

        const parsed = JSON.parse(raw) as AuthProfileCacheEntry;
        if (!parsed.profile || Date.now() - parsed.cachedAt > PROFILE_CACHE_TTL_MS) {
            sessionStorage.removeItem(getProfileCacheKey(userId));
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
};

const writeProfileCache = (userId: string, entry: Omit<AuthProfileCacheEntry, 'cachedAt'>) => {
    try {
        sessionStorage.setItem(
            getProfileCacheKey(userId),
            JSON.stringify({ ...entry, cachedAt: Date.now() })
        );
    } catch {
        // Cache is an optimization only; private browsing/storage limits should not break auth.
    }
};

const clearProfileCache = (userId: string) => {
    try {
        sessionStorage.removeItem(getProfileCacheKey(userId));
    } catch {
        // Ignore storage errors.
    }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userParticipacao, setUserParticipacao] = useState<InscricaoEnriched | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const inFlightProfileLoadsRef = useRef(new Map<string, Promise<void>>());

    const loadProfile = useCallback(async (
        userId: string,
        options: { isInitialLoad?: boolean; force?: boolean } = {}
    ) => {
        const { isInitialLoad = false, force = false } = options;
        if (isInitialLoad) setProfileLoading(true);

        if (!force) {
            const cached = readProfileCache(userId);
            if (cached) {
                setProfile(cached.profile);
                setUserParticipacao(cached.userParticipacao);
                if (isInitialLoad) setProfileLoading(false);
                return;
            }

            const inFlightLoad = inFlightProfileLoadsRef.current.get(userId);
            if (inFlightLoad) {
                try {
                    await inFlightLoad;
                } finally {
                    if (isInitialLoad) setProfileLoading(false);
                }
                return;
            }
        }

        const request = (async () => {
            // 1. Fetch Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, email, temporary_password, created_at, updated_at')
                .eq('id', userId)
                .maybeSingle();

            if (profileError) throw profileError;

            // 2. Fetch Personal Data (get full name from 'pessoas' table)
            let pessoaData = null;
            if (profileData) {
                const { data } = await supabase
                    .from('pessoas')
                    .select('nome_completo')
                    .ilike('email', profileData.email)
                    .maybeSingle();
                pessoaData = data;
            }

            // 3. Fetch Active Encounter
            const { data: encounterData, error: encounterError } = await supabase
                .from('encontros')
                .select('id')
                .eq('ativo', true)
                .limit(1)
                .maybeSingle();

            const activeEncontroId = (!encounterError && encounterData) ? encounterData.id : null;

            if (profileError) throw profileError;

            // 4. Fetch User Groups and Permissions
            const grupos: string[] = [];
            const grupoIds: string[] = [];
            const permissions: string[] = [];

            const { data: ugData, error: ugError } = await supabase
                .from('usuario_grupos')
                .select(`
                    encontro_id,
                    grupos (
                        id,
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
                (ugData as Record<string, unknown>[]).forEach((ug: Record<string, unknown>) => {
                    const isGlobal = !ug.encontro_id;
                    const isActiveEncounter = activeEncontroId && ug.encontro_id === activeEncontroId;

                    const grupo = Array.isArray(ug.grupos) ? ug.grupos[0] : ug.grupos;

                    if (grupo && (isGlobal || isActiveEncounter)) {
                        grupos.push(grupo.nome);
                        if (grupo.id) grupoIds.push(grupo.id);
                        const gps = Array.isArray(grupo.grupo_permissoes) ? grupo.grupo_permissoes : [grupo.grupo_permissoes];
                        
                        gps.forEach((gp: Record<string, unknown>) => {
                            if (gp?.permissoes) {
                                const perms = Array.isArray(gp.permissoes) ? gp.permissoes : [gp.permissoes];
                                perms.forEach((p: any) => {
                                    if (p?.chave && typeof p.chave === 'string' && !permissions.includes(p.chave)) {
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
                nome_completo: pessoaData?.nome_completo,
                grupos,
                grupoIds,
                permissions
            };

            setProfile(extendedProfile);

            let nextUserParticipacao: InscricaoEnriched | null = null;

            // 5. Fetch Latest Participation for the active encounter
            if (activeEncontroId && profileData?.email) {
                const { data: partData, error: partError } = await supabase
                    .from('participacoes')
                    .select('*, pessoas!inner(nome_completo, cpf, email), equipes(nome)')
                    .eq('pessoas.email', profileData.email)
                    .eq('encontro_id', activeEncontroId)
                    .maybeSingle();

                if (!partError) {
                    nextUserParticipacao = partData as InscricaoEnriched | null;
                }
            }

            setUserParticipacao(nextUserParticipacao);
            writeProfileCache(userId, {
                profile: extendedProfile,
                userParticipacao: nextUserParticipacao
            });
        })();

        inFlightProfileLoadsRef.current.set(userId, request);

        try {
            await request;
        } catch (error) {
            console.error('Erro ao carregar perfil/participação:', error);
            if (isInitialLoad) setProfile(null);
        } finally {
            if (inFlightProfileLoadsRef.current.get(userId) === request) {
                inFlightProfileLoadsRef.current.delete(userId);
            }
            if (isInitialLoad) setProfileLoading(false);
        }
    }, []);

    const refreshProfile = useCallback(async (options?: { force?: boolean }) => {
        if (!user) return;
        if (options?.force) clearProfileCache(user.id);
        await loadProfile(user.id, { force: options?.force });
    }, [loadProfile, user]);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                loadProfile(session.user.id, { isInitialLoad: true }).finally(() => setLoading(false));
                return;
            }

            setProfile(null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            // getSession() above already handles the initial bootstrap. Processing this
            // event too can duplicate profiles/usuario_grupos reads on page load.
            if (event === 'INITIAL_SESSION') return;

            // TOKEN_REFRESHED apenas renova o JWT em segundo plano — não altera a
            // identidade do usuário, portanto não precisamos recarregar nada.
            if (event === 'TOKEN_REFRESHED') return;

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                loadProfile(session.user.id).finally(() => setLoading(false));
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
                    refreshProfile({ force: true });
                }
            )
            .subscribe();
 
        return () => {
            profileSubscription.unsubscribe();
        };
    }, [user, refreshProfile]);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    const permissionSet = useMemo(() => new Set(profile?.permissions ?? []), [profile?.permissions]);

    const hasPermission = useCallback((permission: string) => {
        if (permissionSet.size === 0) return false;
        // Admins can be configured to have all permissions by db entry. Or we can hardcode fallback:
        if (permissionSet.has('modulo_admin')) return true;
        return permissionSet.has(permission);
    }, [permissionSet]);

    const contextValue = useMemo(() => ({
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
    }), [
        session,
        user,
        signOut,
        profile,
        refreshProfile,
        userParticipacao,
        profile?.temporary_password,
        profileLoading,
        loading,
        hasPermission
    ]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}
