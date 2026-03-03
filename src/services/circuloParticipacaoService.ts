import { supabase } from '../lib/supabase';

const TABLE = 'circulo_participacao';

export const circuloParticipacaoService = {
    async listarPorEncontro(encontroId: string): Promise<any[]> {
        // Here we first need to get the "participacoes" for the meeting
        // and then join with "circulo_participacao"
        const { data, error } = await supabase
            .from(TABLE)
            .select(`
                *,
                participacoes!participacao (
                    id,
                    encontro_id,
                    pessoas (nome_completo)
                ),
                circulos (nome)
            `)
            .filter('participacoes.encontro_id', 'eq', encontroId);

        if (error) throw error;
        return data;
    },

    async listarPorCirculo(circulo_id: number): Promise<any[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, participacoes!participacao(pessoas(nome_completo))')
            .eq('circulo_id', circulo_id);

        if (error) throw error;
        return data;
    },

    async vincular(participacao_id: string, circulo_id: number, mediador: boolean = false): Promise<any> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([{ participacao: participacao_id, circulo_id, mediador }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async desvincular(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
