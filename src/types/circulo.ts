export interface Circulo {
    id: number; // bigint
    created_at: string;
    nome: string | null;
    imagem_url: string | null;
    deleted_at: string | null;
}

export type CirculoFormData = Pick<Circulo, 'nome' | 'imagem_url'>;

export interface CirculoParticipacao {
    id: string; // uuid
    participacao: string; // uuid from participacoes table
    circulo_id: number;
    mediador: boolean;
    created_at: string;
    participacoes?: {
        id: string;
        encontro_id: string;
        pessoas: {
            nome_completo: string;
        };
    };
    circulos?: {
        nome: string;
    };
}

export const circuloFormDataVazio = (): CirculoFormData => ({
    nome: '',
    imagem_url: null,
});
