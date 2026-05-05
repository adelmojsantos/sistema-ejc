export interface Palestra {
    id: string;
    encontro_id: string;
    pessoa_id: string | null;
    titulo: string;
    palestrante_nome: string | null;
    palestrante_foto_url: string | null;
    resumo: string | null;
    ordem: number;
    created_at?: string;
    updated_at?: string;
}

export interface PalestraFormData {
    encontro_id: string;
    pessoa_id?: string | null;
    titulo: string;
    palestrante_nome?: string | null;
    palestrante_foto_url?: string | null;
    resumo?: string | null;
    ordem?: number;
}

export const palestraFormDataVazio = (encontroId: string): PalestraFormData => ({
    encontro_id: encontroId,
    pessoa_id: null,
    titulo: '',
    palestrante_nome: '',
    palestrante_foto_url: null,
    resumo: '',
    ordem: 0,
});
