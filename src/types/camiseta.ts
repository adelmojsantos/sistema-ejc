export interface CamisetaModelo {
    id: string;
    nome: string;
    ativo: boolean;
    created_at: string;
}

export interface CamisetaTamanho {
    id: string;
    sigla: string;
    modelo_id: string | null;
    ordem: number;
    ativo: boolean;
    created_at: string;
}

export interface CamisetaPedido {
    id: string;
    participacao_id: string;
    modelo_id: string;
    tamanho: string;
    quantidade: number;
    created_at: string;
    updated_at: string;
    // Enriched fields
    camiseta_modelos?: {
        id: string;
        nome: string;
    };
}

export interface CamisetaPedidoFormData {
    participacao_id: string;
    modelo_id: string;
    tamanho: string;
    quantidade: number;
}
