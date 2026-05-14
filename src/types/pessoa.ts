export interface Pessoa {
    id: string;
    nome_completo: string;
    cpf: string | null;
    email: string | null;
    telefone: string;
    comunidade: string;
    data_nascimento: string | null;
    qr_code_token: string;
    created_at: string;
    nome_pai: string | null;
    nome_mae: string | null;
    endereco: string | null;
    numero: string | null;
    complemento: string | null;
    cep: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    telefone_pai: string | null;
    telefone_mae: string | null;
    outros_contatos: string | null;
    fez_ejc_outra_paroquia: boolean | null;
    qual_paroquia_ejc: string | null;
    latitude?: number | null;
    longitude?: number | null;
    origem?: string;
}

export type PessoaFormData = Omit<Pessoa, 'id' | 'qr_code_token' | 'created_at'>;

export const pessoaFormDataVazia = (): PessoaFormData => ({
    nome_completo: '',
    cpf: null,
    email: null,
    telefone: '',
    comunidade: '',
    data_nascimento: '',
    nome_pai: null,
    nome_mae: null,
    endereco: null,
    numero: null,
    complemento: null,
    cep: null,
    bairro: null,
    cidade: null,
    estado: 'SP',
    telefone_pai: null,
    telefone_mae: null,
    outros_contatos: null,
    fez_ejc_outra_paroquia: null,
    qual_paroquia_ejc: null,
});
