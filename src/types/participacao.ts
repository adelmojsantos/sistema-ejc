import type { Pessoa } from './pessoa';
import type { Equipe } from './equipe';

export interface Participacao {
    id: string; // uuid
    encontro_id: string; // uuid
    pessoa_id: string; // uuid
    equipe_id: string | null; // uuid
    circulo_id: number | null;
    status: string;
    created_at: string;
    foto_url: string | null;
}

export interface ParticipacaoEnriched extends Participacao {
    pessoas?: Pessoa;
    equipes?: Equipe;
}
