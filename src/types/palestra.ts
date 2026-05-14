<<<<<<< HEAD
import type { Pessoa } from './pessoa';

=======
>>>>>>> master
export interface Palestra {
    id: string;
    encontro_id: string;
    pessoa_id: string | null;
    titulo: string;
    palestrante_nome: string | null;
    palestrante_foto_url: string | null;
    resumo: string | null;
    ordem: number;
<<<<<<< HEAD
    created_at: string;
    updated_at: string;
    pessoas?: Pessoa; // Join opcional para quando linkado
}

export type PalestraFormData = Omit<Palestra, 'id' | 'created_at' | 'updated_at' | 'pessoas'>;

export const palestraFormDataVazio = (encontro_id: string): PalestraFormData => ({
    encontro_id,
=======
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
>>>>>>> master
    pessoa_id: null,
    titulo: '',
    palestrante_nome: '',
    palestrante_foto_url: null,
    resumo: '',
    ordem: 0,
});
