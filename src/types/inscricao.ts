export interface Inscricao {
    id: string; // uuid
    pessoa_id: string;
    encontro_id: string;
    data_inscricao: string | null;
    participante: boolean | null;
    equipe_id: string | null;
    coordenador: boolean | null;
}

export type InscricaoFormData = Omit<Inscricao, 'id' | 'data_inscricao'>;

export const inscricaoFormDataVazia = (): InscricaoFormData => ({
    pessoa_id: '',
    encontro_id: '',
    participante: false,
    equipe_id: null,
    coordenador: false,
});
