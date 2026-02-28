export interface Circulo {
    id: number; // bigint
    created_at: string;
    nome: string | null;
    deleted_at: string | null;
}

export type CirculoFormData = Pick<Circulo, 'nome'>;

export const circuloFormDataVazio = (): CirculoFormData => ({
    nome: '',
});
