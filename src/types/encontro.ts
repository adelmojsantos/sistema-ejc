export interface Encontro {
    id: string; // uuid
    nome: string;
    data_inicio: string; // date
    data_fim: string; // date
    local: string | null;
    descricao: string | null;
    ativo: boolean;
    created_at: string; // timestamptz
    edicao: number | null; // bigint
    tema: string | null;
    musica: string | null;
    link_musica: string | null;
    link_youtube: string | null;
}

export type EncontroFormData = Omit<Encontro, 'id' | 'created_at'>;

export const encontroFormDataVazio = (): EncontroFormData => ({
    nome: '',
    data_inicio: '',
    data_fim: '',
    local: '',
    descricao: '',
    ativo: false,
    edicao: null,
    tema: '',
    musica: '',
    link_musica: '',
    link_youtube: '',
});
