export interface UserProfile {
    id: string;
    email: string;
    temporary_password: boolean;
    created_at: string;
    updated_at: string;
    grupos: string[];
    permissions: string[];
}

