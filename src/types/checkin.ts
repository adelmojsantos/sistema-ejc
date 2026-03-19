export interface Checkin {
    id: string; // uuid
    pessoa_id: string; // uuid
    encontro_id: string; // uuid
    created_at: string;
}

export interface CheckinEnriched extends Checkin {
    pessoas?: {
        nome_completo: string;
    };
    encontros?: {
        nome: string;
    };
}
