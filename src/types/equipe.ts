export interface Equipe {
    id: string; // uuid
    created_at: string;
    nome: string | null;
    foto_url: string | null;
    acesso_plenario: 'verde' | 'amarela' | 'vermelha';
    deleted_at: string | null;
}

export interface EquipeFormData {
    nome: string;
    foto_url?: string | null;
    acesso_plenario: 'verde' | 'amarela' | 'vermelha';
}

export const equipeFormDataVazio = (): EquipeFormData => ({
    nome: '',
    foto_url: null,
    acesso_plenario: 'verde',
});
