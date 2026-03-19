import { supabase } from '../lib/supabase';
import type { Checkin, CheckinEnriched } from '../types/checkin';

const TABLE = 'checkins';

export const checkinService = {
    async listar(): Promise<CheckinEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, pessoas(nome_completo), encontros(nome)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async registrar(pessoa_id: string, encontro_id: string): Promise<Checkin> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([{ pessoa_id, encontro_id }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
