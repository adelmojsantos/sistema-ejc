import { supabase } from '../lib/supabase';
import type { Equipe, EquipeFormData } from '../types/equipe';

const TABLE = 'equipes';

export const equipeService = {
    async listar(): Promise<Equipe[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .is('deleted_at', null)
            .order('nome', { ascending: true });

        if (error) throw error;
        return data as Equipe[];
    },

    async buscarComPaginacao(busca: string = '', pagina: number = 0, limite: number = 5): Promise<Equipe[]> {
        let query = supabase
            .from(TABLE)
            .select('*')
            .is('deleted_at', null)
            .order('nome', { ascending: true });

        if (busca.trim() !== '') {
            query = query.ilike('nome', `%${busca}%`);
        }

        const from = pagina * limite;
        const to = from + limite - 1;

        const { data, error } = await query.range(from, to);

        if (error) throw error;
        return data as Equipe[];
    },

    async criar(formData: EquipeFormData): Promise<Equipe> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as Equipe;
    },

    async atualizar(id: string, formData: Partial<EquipeFormData>): Promise<Equipe> {
        const { data, error } = await supabase
            .from(TABLE)
            .update(formData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Equipe;
    },

    async excluir(id: string): Promise<void> {
        // Soft delete if preferred, but schema has deleted_at so let's use it
        const { error } = await supabase
            .from(TABLE)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    },
};
