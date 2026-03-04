export interface PreCadastroEntry {
    id?: string;
    nome_completo: string;
    email: string | null;
    telefone: string;
    data_nascimento: string | null;
    criado_em?: string;
    status: 'pendente' | 'convertido';
}

export type PreCadastroFormData = Omit<PreCadastroEntry, 'id' | 'criado_em' | 'status'>;
