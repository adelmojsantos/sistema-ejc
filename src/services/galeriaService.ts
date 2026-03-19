import { supabase } from '../lib/supabase';
import type { Galeria } from '../types/galeria';

const TABLE = 'galeria';

export const galeriaService = {
    async listar(): Promise<Galeria[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async adicionar(encontro_id: string, url_imagem: string, descricao?: string): Promise<Galeria> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([{ encontro_id, url_imagem, descricao }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
