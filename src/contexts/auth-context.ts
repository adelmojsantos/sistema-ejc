import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from '../types/auth';
import type { InscricaoEnriched } from '../types/inscricao';

export interface AuthContextType {
    session: Session | null;
    user: User | null;
    signOut: () => Promise<void>;
    profile: UserProfile | null;
    refreshProfile: () => Promise<void>;
    mustChangePassword: boolean;
    profileLoading: boolean;
    loading: boolean;
    userParticipacao: InscricaoEnriched | null;
    hasPermission: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

