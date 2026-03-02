export interface VisitaDupla {
    id: string;
    encontro_id: string;
    pessoa1_id: string;
    pessoa2_id: string;
    created_at: string;
    // Helper fields for UI
    pessoa1?: { nome_completo: string };
    pessoa2?: { nome_completo: string };
}

export interface VisitaVinculo {
    id: string;
    dupla_id: string;
    participante_id: string;
    created_at: string;
    // Helper fields for UI
    participante?: { nome_completo: string };
}

export type VisitaDuplaFormData = Omit<VisitaDupla, 'id' | 'created_at' | 'pessoa1' | 'pessoa2'>;
export type VisitaVinculoFormData = Omit<VisitaVinculo, 'id' | 'created_at' | 'participante'>;
