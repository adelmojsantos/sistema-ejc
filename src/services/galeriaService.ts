import { supabase } from '../lib/supabase';

const TABLE = 'galeria';

export const galeriaService = {
    async listar(): Promise<any[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async adicionar(encontro_id: string, url_imagem: string, descricao?: string): Promise<any> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([{ encontro_id, url_imagem, descricao }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
