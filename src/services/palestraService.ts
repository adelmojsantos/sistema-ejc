import { supabase } from '../lib/supabase';
import { getFileExtension, optimizeImageForUpload } from '../utils/imageOptimization';
import { uploadPublicImage } from './publicImageStorageService';
import type { Palestra, PalestraFormData } from '../types/palestra';

const TABLE = 'palestras';

/** Erro de regra da cópia de palestras, com mensagem própria para o usuário. */
export class PalestraCopiaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PalestraCopiaError';
    }
}

export const palestraService = {
    async listarPorEncontro(encontroId: string): Promise<Palestra[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, pessoas(*)')
            .eq('encontro_id', encontroId)
            .order('ordem', { ascending: true });

        if (error) {
            console.error('Erro ao buscar palestras:', error);
            throw error;
        }
        return data as Palestra[];
    },

    async buscarPorId(id: string): Promise<Palestra | null> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, pessoas(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Palestra;
    },

    async criar(formData: PalestraFormData): Promise<Palestra> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as Palestra;
    },

    async atualizar(id: string, formData: Partial<PalestraFormData>): Promise<Palestra> {
        const { data, error } = await supabase
            .from(TABLE)
            .update(formData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Palestra;
    },

    async excluir(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async atualizarOrdem(palestras: { id: string, ordem: number }[]): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .upsert(palestras);

        if (error) throw error;
    },

    /**
     * Copia título e ordem das palestras de um encontro para outro que ainda não
     * tem palestras. Palestrante, resumo e foto ficam em branco para preenchimento.
     * Retorna a quantidade de palestras criadas.
     */
    async copiarDoEncontro(encontroOrigemId: string, encontroDestinoId: string): Promise<number> {
        if (encontroOrigemId === encontroDestinoId) {
            throw new PalestraCopiaError('Escolha um encontro diferente do atual.');
        }

        const { count, error: countError } = await supabase
            .from(TABLE)
            .select('id', { count: 'exact', head: true })
            .eq('encontro_id', encontroDestinoId);

        if (countError) throw countError;
        if ((count ?? 0) > 0) {
            throw new PalestraCopiaError('O encontro atual já possui palestras cadastradas.');
        }

        const { data: origem, error: origemError } = await supabase
            .from(TABLE)
            .select('titulo, ordem')
            .eq('encontro_id', encontroOrigemId)
            .order('ordem', { ascending: true });

        if (origemError) throw origemError;
        if (!origem || origem.length === 0) {
            throw new PalestraCopiaError('O encontro escolhido não possui palestras para copiar.');
        }

        const novasPalestras = origem.map((palestra) => ({
            encontro_id: encontroDestinoId,
            titulo: palestra.titulo,
            ordem: palestra.ordem,
            pessoa_id: null,
            palestrante_nome: null,
            palestrante_foto_url: null,
            palestrante_foto_posicao_y: 50,
            resumo: null,
        }));

        const { error: insertError } = await supabase.from(TABLE).insert(novasPalestras);
        if (insertError) throw insertError;

        return novasPalestras.length;
    },

    async uploadFoto(file: File): Promise<string> {
        const optimizedFile = await optimizeImageForUpload(file);
        const fileExt = getFileExtension(optimizedFile, 'webp');
        const fileName = `palestrante_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `fotos/palestrantes/${fileName}`;

        return uploadPublicImage(filePath, optimizedFile);
    }
};
