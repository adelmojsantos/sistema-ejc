export interface VisitaGrupo {
    id: string; // uuid
    encontro_id: string; // uuid
    nome: string | null;
    created_at: string;
}

export interface VisitaParticipacao {
    id: string; // uuid
    grupo_id: string; // uuid
    participacao_id: string; // uuid from participacoes
    visitante: boolean;
    created_at: string;
    // Helper fields for UI
    participacoes?: {
        id: string;
        encontro_id: string;
        pessoas: {
            nome_completo: string;
        };
    };
    visita_grupos?: {
        nome: string;
    };
}

export type VisitaGrupoFormData = Omit<VisitaGrupo, 'id' | 'created_at'>;
export type VisitaParticipacaoFormData = Omit<VisitaParticipacao, 'id' | 'created_at' | 'participacoes' | 'visita_grupos'>;
