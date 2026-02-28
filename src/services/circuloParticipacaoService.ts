import { supabase } from '../lib/supabase';

const TABLE = 'circulo_participacao';

export const circuloParticipacaoService = {
    async listar(circulo_id: string): Promise<any[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, pessoas(nome_completo)')
            .eq('circulo_id', circulo_id);

        if (error) throw error;
        return data;
    },

    async vincular(pessoa_id: string, circulo_id: string): Promise<any> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([{ pessoa_id, circulo_id }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
