export interface Equipe {
    id: string; // uuid
    created_at: string;
    nome: string | null;
    foto_url: string | null;
    deleted_at: string | null;
}

export interface EquipeFormData {
    nome: string;
    foto_url?: string | null;
}

export const equipeFormDataVazio = (): EquipeFormData => ({
    nome: '',
    foto_url: null,
});
