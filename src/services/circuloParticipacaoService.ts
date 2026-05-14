import { supabase } from '../lib/supabase';
import type { CirculoParticipacao, CirculoParticipacaoEnriched } from '../types/circuloParticipacao';

const TABLE = 'circulo_participacao';

export const circuloParticipacaoService = {
    /**
     * Busca todos os vínculos de círculo para um encontro.
     * CORREÇÃO: query em dois passos para evitar bug do PostgREST
     * onde o .filter() em join retorna rows pai com join nulo
     * em vez de filtrar as próprias rows.
     */
    async listarPorEncontro(encontroId: string): Promise<CirculoParticipacaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select(`
                *,
                participacoes!inner (
                    id,
                    encontro_id,
                    pessoas (nome_completo)
                ),
                circulos (nome)
            `)
            .eq('participacoes.encontro_id', encontroId);

        if (error) throw error;
        return (data || []) as CirculoParticipacaoEnriched[];
    },

    async listarPorCirculo(circulo_id: number): Promise<CirculoParticipacaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, participacoes!participacao(pessoas(nome_completo))')
            .eq('circulo_id', circulo_id);

        if (error) throw error;
        return data;
    },

    async vincular(participacao_id: string, circulo_id: number, mediador: boolean = false): Promise<CirculoParticipacao> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([{ participacao: participacao_id, circulo_id, mediador }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async vincularMuitos(vinculos: Partial<CirculoParticipacao>[]): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .insert(vinculos);

        if (error) throw error;
    },

    async desvincular(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Remove todos os vínculos de um círculo num encontro específico.
     * O círculo global e os participantes do encontro não são afetados.
     */
    async removerPorCirculoEEncontro(circuloId: number, encontroId: string): Promise<void> {
        const { data: parts, error: partsError } = await supabase
            .from('participacoes')
            .select('id')
            .eq('encontro_id', encontroId);

        if (partsError) throw partsError;
        if (!parts || parts.length === 0) return;

        const participacaoIds = parts.map((p: { id: string }) => p.id);

        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('circulo_id', circuloId)
            .in('participacao', participacaoIds);

        if (error) throw error;
    }
};
