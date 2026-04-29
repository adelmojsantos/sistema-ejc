export interface UserProfile {
    id: string;
    email: string;
    nome_completo?: string;
    temporary_password: boolean;
    created_at: string;
    updated_at: string;
    grupos: string[];
    grupoIds?: string[];
    permissions: string[];
}

