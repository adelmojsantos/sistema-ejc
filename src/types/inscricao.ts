export interface Inscricao {
    id: string; // uuid
    pessoa_id: string;
    encontro_id: string;
    data_inscricao: string | null;
    participante: boolean | null;
    equipe_id: string | null;
    coordenador: boolean | null;
    dados_confirmados: boolean | null;
    confirmado_em: string | null;
}

export interface InscricaoEnriched extends Inscricao {
    pessoas?: {
        nome_completo: string;
        cpf: string | null;
        email?: string | null;
        telefone?: string | null;
        comunidade?: string | null;
        data_nascimento?: string | null;
        endereco?: string | null;
        bairro?: string | null;
        cidade?: string | null;
    };
    encontros?: {
        nome: string;
    };
    equipes?: {
        nome: string | null;
    };
}

export type InscricaoFormData = Omit<Inscricao, 'id' | 'data_inscricao'>;

export const inscricaoFormDataVazia = (): InscricaoFormData => ({
    pessoa_id: '',
    encontro_id: '',
    participante: false,
    equipe_id: null,
    coordenador: false,
    dados_confirmados: false,
    confirmado_em: null,
});
