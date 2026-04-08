export const USER_ROLES = ['admin', 'secretaria', 'visitacao', 'coordenador', 'viewer'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface UserProfile {
    id: string;
    email: string;
    role: UserRole;
    temporary_password: boolean;
    created_at: string;
    updated_at: string;
}

