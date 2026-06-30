import { supabase } from '../lib/supabase';
import { getFileExtension, IMMUTABLE_PUBLIC_UPLOAD_OPTIONS, optimizeImageForUpload } from '../utils/imageOptimization';

const TABLE = 'circulo_mediadores_fotos';

export interface CirculoMediadoresFoto {
    id: string;
    encontro_id: string;
    circulo_id: number;
    foto_url: string | null;
    foto_posicao_y: number;
}

export const circuloMediadoresFotoService = {
    async listarPorEncontro(encontroId: string): Promise<CirculoMediadoresFoto[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('encontro_id', encontroId);

        if (error) throw error;
        return (data || []) as CirculoMediadoresFoto[];
    },

    async salvarFoto(encontroId: string, circuloId: number, fotoUrl: string, fotoPosicaoY = 50): Promise<CirculoMediadoresFoto> {
        const { data, error } = await supabase
            .from(TABLE)
            .upsert({
                encontro_id: encontroId,
                circulo_id: circuloId,
                foto_url: fotoUrl,
                foto_posicao_y: fotoPosicaoY
            }, {
                onConflict: 'encontro_id,circulo_id'
            })
            .select()
            .single();

        if (error) throw error;
        return data as CirculoMediadoresFoto;
    },

    async removerFoto(encontroId: string, circuloId: number): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('encontro_id', encontroId)
            .eq('circulo_id', circuloId);

        if (error) throw error;
    },

    async uploadFoto(file: File): Promise<string> {
        const optimizedFile = await optimizeImageForUpload(file);
        const extension = getFileExtension(optimizedFile, 'webp');
        const randomId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
        const filePath = `fotos/circulos-mediadores/mediadores_${randomId}_${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from('galeria')
            .upload(filePath, optimizedFile, IMMUTABLE_PUBLIC_UPLOAD_OPTIONS);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('galeria')
            .getPublicUrl(filePath);

        return data.publicUrl;
    }
};
