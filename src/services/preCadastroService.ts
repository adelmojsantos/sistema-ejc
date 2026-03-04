import { supabase } from '../lib/supabase';
import type { PreCadastroFormData, PreCadastroEntry } from '../types/preCadastro';

export const preCadastroService = {
    async join(data: PreCadastroFormData): Promise<void> {
        const { error } = await supabase
            .from('pre_cadastro')
            .insert([
                {
                    ...data,
                    status: 'pendente'
                }
            ]);

        if (error) {
            console.error('Error in pre-registration:', error);
            throw new Error('Não foi possível realizar o pré-cadastro. Tente novamente mais tarde.');
        }
    },

    async searchByTerm(term: string): Promise<PreCadastroEntry[]> {
        const { data, error } = await supabase
            .from('pre_cadastro')
            .select('*')
            .eq('status', 'pendente')
            .or(`nome_completo.ilike.%${term}%,telefone.ilike.%${term}%`)
            .limit(10);

        if (error) {
            console.error('Error searching pre-registrations:', error);
            return [];
        }

        return data || [];
    },

    async updateStatus(id: string, status: 'pendente' | 'convertido'): Promise<void> {
        const { error } = await supabase
            .from('pre_cadastro')
            .update({ status })
            .eq('id', id);

        if (error) {
            console.error('Error updating pre-registration status:', error);
        }
    }
};
