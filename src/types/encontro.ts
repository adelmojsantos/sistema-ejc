export interface Encontro {
    id: string; // uuid
    nome: string;
    data_inicio: string; // date
    data_fim: string; // date
    local: string | null;
    descricao: string | null;
    ativo: boolean;
    formulario_publico_ativo: boolean;
    created_at: string; // timestamptz
    edicao: number | null; // bigint
    tema: string | null;
    musica: string | null;
    link_musica: string | null;
    link_youtube: string | null;
    limite_vagas_online: number;
    valor_taxa: number;
    quadrante_token?: string;
    quadrante_pin?: string | null;
    quadrante_ativo?: boolean;
    pix_taxa_chave?: string | null;
    pix_taxa_tipo?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
    pix_taxa_qrcode_url?: string | null;
    pix_camisetas_chave?: string | null;
    pix_camisetas_tipo?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
    pix_camisetas_qrcode_url?: string | null;
}

export type EncontroFormData = Omit<Encontro, 'id' | 'created_at' | 'quadrante_token'>;

export const encontroFormDataVazio = (): EncontroFormData => ({
    nome: '',
    data_inicio: '',
    data_fim: '',
    local: '',
    descricao: '',
    ativo: false,
    formulario_publico_ativo: false,
    edicao: null,
    tema: '',
    musica: '',
    link_musica: '',
    link_youtube: '',
    limite_vagas_online: 0,
    valor_taxa: 0,
    quadrante_pin: '',
    quadrante_ativo: false,
    pix_taxa_chave: '',
    pix_taxa_tipo: null,
    pix_taxa_qrcode_url: '',
    pix_camisetas_chave: '',
    pix_camisetas_tipo: null,
    pix_camisetas_qrcode_url: '',
});
