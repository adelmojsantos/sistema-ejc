export interface PreCadastroEntry {
    id?: string;
    nome_completo: string;
    email: string | null;
    telefone: string;
    data_nascimento: string | null;
    created_at?: string;
    status: 'pendente' | 'convertido';
}

export type PreCadastroFormData = Omit<PreCadastroEntry, 'id' | 'created_at' | 'status'>;
