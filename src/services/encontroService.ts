import { supabase } from '../lib/supabase';
import type { Encontro, EncontroFormData } from '../types/encontro';

const TABLE = 'encontros';

export const encontroService = {
    async listar(): Promise<Encontro[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .order('edicao', { ascending: true });
        if (error) {
            console.error('Erro ao buscar encontros:', error);
            throw error;
        }
        return data as Encontro[];
    },

    async buscarComPaginacao(busca: string = '', pagina: number = 0, limite: number = 5): Promise<Encontro[]> {
        let query = supabase
            .from(TABLE)
            .select('*')
            .order('edicao', { ascending: false });

        if (busca.trim() !== '') {
            query = query.ilike('nome', `%${busca}%`);
        }

        const from = pagina * limite;
        const to = from + limite - 1;

        const { data, error } = await query.range(from, to);

        if (error) throw error;
        return data as Encontro[];
    },

    async criar(formData: EncontroFormData): Promise<Encontro> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as Encontro;
    },

    async atualizar(id: string, formData: Partial<EncontroFormData>): Promise<Encontro> {
        const { data, error } = await supabase
            .from(TABLE)
            .update(formData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Encontro;
    },

    async excluir(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};
