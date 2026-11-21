export interface Equipe {
    id: string; // uuid
    created_at: string;
    nome: string | null;
    foto_url: string | null;
    acesso_plenario: 'verde' | 'amarela' | 'vermelha';
    aparece_pos_encontro: boolean;
    libera_acesso_integrantes?: boolean;
    deleted_at: string | null;
}

export interface EquipeFormData {
    nome: string;
    foto_url?: string | null;
    acesso_plenario: 'verde' | 'amarela' | 'vermelha';
    aparece_pos_encontro?: boolean;
    libera_acesso_integrantes?: boolean;
}

export const equipeFormDataVazio = (): EquipeFormData => ({
    nome: '',
    foto_url: null,
    acesso_plenario: 'verde',
    aparece_pos_encontro: true,
    libera_acesso_integrantes: false,
});
