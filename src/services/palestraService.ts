import { supabase } from '../lib/supabase';
import type { Palestra, PalestraFormData } from '../types/palestra';

const TABLE = 'palestras';

export const palestraService = {
    async listarPorEncontro(encontroId: string): Promise<Palestra[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('encontro_id', encontroId)
            .order('ordem', { ascending: true });

        if (error) throw error;
        return data as Palestra[];
    },

    async buscarPorId(id: string): Promise<Palestra | null> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
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

    async uploadFoto(file: File): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `palestrante_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `fotos/palestrantes/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('galeria')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('galeria')
            .getPublicUrl(filePath);

        return data.publicUrl;
    }
};
