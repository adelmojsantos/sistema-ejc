export interface Galeria {
    id: string; // uuid
    encontro_id: string; // uuid
    url_imagem: string;
    descricao: string | null;
    created_at: string;
}
