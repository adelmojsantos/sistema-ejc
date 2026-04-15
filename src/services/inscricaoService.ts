import { supabase } from '../lib/supabase';
import type { Inscricao, InscricaoFormData, InscricaoEnriched } from '../types/inscricao';

const TABLE = 'participacoes';

export const inscricaoService = {
    async listar(): Promise<InscricaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, pessoas(nome_completo, cpf, latitude, longitude), encontros(nome), equipes(nome)')
            .order('data_inscricao', { ascending: false });

        if (error) throw error;
        return data;
    },

    async listarPorEncontro(encontroId: string): Promise<InscricaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, pessoas(nome_completo, cpf, email, telefone, comunidade, data_nascimento, endereco, numero, bairro, cidade, latitude, longitude), equipes(nome)')
            .eq('encontro_id', encontroId);

        if (error) throw error;
        return data;
    },

    async criar(formData: InscricaoFormData): Promise<Inscricao> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as Inscricao;
    },

    async criarMuitos(formDataArray: InscricaoFormData[]): Promise<Inscricao[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert(formDataArray)
            .select();

        if (error) throw error;
        return data as Inscricao[];
    },

    async atualizar(id: string, formData: Partial<InscricaoFormData>): Promise<Inscricao> {
        const { data, error } = await supabase
            .from(TABLE)
            .update(formData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Inscricao;
    },

    async excluir(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /** Remove o vínculo de uma pessoa com um encontro (apaga a participação). */
    async desvincularDoEncontro(participacaoId: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', participacaoId);

        if (error) throw error;
    },

    async confirmarDados(id: string): Promise<Inscricao> {
        const { data, error } = await supabase
            .from(TABLE)
            .update({
                dados_confirmados: true,
                confirmado_em: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Inscricao;
    },

    async verificarSeJaFoiParticipante(pessoaId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('id')
            .eq('pessoa_id', pessoaId)
            .eq('participante', true)
            .limit(1);

        if (error) throw error;
        return data && data.length > 0;
    }
};
