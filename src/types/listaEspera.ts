export interface ListaEsperaEntry {
    id: string; // uuid
    encontro_id: string; // uuid
    origem: string;
    status: 'pendente' | 'convertido';
    created_at: string;
    
    // Dados da ficha cadastral
    nome_completo: string;
    cpf: string | null;
    email: string | null;
    telefone: string;
    data_nascimento: string | null;
    comunidade: string;
    nome_pai: string | null;
    nome_mae: string | null;
    endereco: string | null;
    numero: string | null;
    cep: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    telefone_pai: string | null;
    telefone_mae: string | null;
    outros_contatos: string | null;
    fez_ejc_outra_paroquia: boolean | null;
    qual_paroquia_ejc: string | null;
}

export type ListaEsperaFormData = Omit<ListaEsperaEntry, 'id' | 'created_at' | 'encontro_id' | 'origem' | 'status'>;

export const listaEsperaFormDataVazia = (): ListaEsperaFormData => ({
    nome_completo: '',
    cpf: null,
    email: null,
    telefone: '',
    data_nascimento: '',
    comunidade: '',
    nome_pai: null,
    nome_mae: null,
    endereco: null,
    numero: null,
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
