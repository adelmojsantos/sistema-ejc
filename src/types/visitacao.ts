export type VisitaStatus = 'pendente' | 'realizada' | 'ausente' | 'cancelada';

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
    // Novos campos para a visita
    status: VisitaStatus;
    observacoes: string | null;
    foto_url: string | null;
    taxa_paga: boolean;
    data_visita: string | null;
}

export interface VisitaParticipacaoEnriched extends VisitaParticipacao {
    participacoes?: {
        id: string;
        encontro_id: string;
        pessoas: {
            nome_completo: string;
            cpf?: string | null;
        };
    };
    visita_grupos?: {
        nome: string;
    };
}

export type VisitaGrupoFormData = Omit<VisitaGrupo, 'id' | 'created_at'>;
export type VisitaParticipacaoFormData = {
    grupo_id: string;
    participacao_id: string;
    visitante: boolean;
    status?: VisitaStatus;
};

