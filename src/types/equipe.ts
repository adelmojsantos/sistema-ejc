export interface Equipe {
    id: string; // uuid
    created_at: string;
    nome: string | null;
    deleted_at: string | null;
}

export type EquipeFormData = Pick<Equipe, 'nome'>;

export const equipeFormDataVazio = (): EquipeFormData => ({
    nome: '',
});
