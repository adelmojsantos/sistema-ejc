export interface CirculoParticipacao {
    id: string;
    participacao: string;
    circulo_id: number;
    mediador: boolean;
}

export interface CirculoParticipacaoEnriched extends CirculoParticipacao {
    participacoes?: {
        id: string;
        encontro_id: string;
        pessoas: {
            nome_completo: string;
        };
    };
    circulos?: {
        nome: string;
    };
}
