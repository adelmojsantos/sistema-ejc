export interface Pessoa {
    id: string;
    nome_completo: string;
    cpf: string | null;
    email: string | null;
    telefone: string;
    comunidade: string;
    data_nascimento: string;
    qr_code_token: string;
    created_at: string;
    nome_pai: string | null;
    nome_mae: string | null;
    endereco: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
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
    bairro: null,
    cidade: null,
});
