import type { Pessoa } from './pessoa';

export type VisitaStatus = 'pendente' | 'realizada' | 'ausente' | 'cancelada';

export interface VisitaGrupo {
    id: string; // uuid
    encontro_id: string; // uuid
    nome: string | null;
    nome_automatico?: boolean;
    foto_url: string | null;
    created_at: string;
}

export interface VisitaParticipacao {
    id: string; // uuid
    grupo_id: string | null; // uuid; null after a group is safely dissolved
    participacao_id: string; // uuid from participacoes
    visitante: boolean;
    created_at: string;
    // Novos campos para a visita
    status: VisitaStatus;
    observacoes: string | null;
    foto_url: string | null;
    foto_familia_url: string | null;
    taxa_paga: boolean;
    data_visita: string | null;
}

export interface VisitaParticipacaoEnriched extends VisitaParticipacao {
    participacoes?: {
        id: string;
        encontro_id: string;
        equipe_id?: string | null;
        participante?: boolean | null;
        coordenador?: boolean | null;
        dados_confirmados?: boolean | null;
        confirmado_em?: string | null;
        pago_taxa?: boolean | null;
        pago_camiseta?: boolean | null;
        foto_url: string | null;
        foto_posicao_y?: number | null;
        pessoas: Pessoa | null;
        equipes?: { nome: string | null } | null;
        recepcao_dados?: {
            id: string;
            participacao_id?: string;
            veiculo_tipo: 'moto' | 'carro';
            veiculo_modelo: string;
            veiculo_cor: string;
            veiculo_placa: string;
        } | null;
    };
    visita_grupos?: {
        nome: string;
    };
}

export type VisitaGrupoFormData = Omit<VisitaGrupo, 'id' | 'created_at' | 'foto_url'>;
export type VisitaParticipacaoFormData = {
    grupo_id: string;
    participacao_id: string;
    visitante: boolean;
    status?: VisitaStatus;
};

export interface VisitaGrupoDeleteImpact {
    grupo_id: string;
    nome: string | null;
    foto_url: string | null;
    visitantes: Array<{
        vinculo_id: string;
        participacao_id: string;
        nome: string;
    }>;
    visitantes_total: number;
    encontristas_total: number;
    pendentes_total: number;
    realizadas_total: number;
    ausentes_total: number;
    fotos_familia_total: number;
    intencoes_camiseta_total: number;
    presencas_total: number;
    desistentes_total: number;
}

