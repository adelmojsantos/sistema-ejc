import { supabase } from '../lib/supabase';
import type { Palestra, PalestraFormData } from '../types/palestra';

const TABLE = 'palestras';

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

    async buscarPorId(id: string): Promise<Palestra> {
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
    }
};
