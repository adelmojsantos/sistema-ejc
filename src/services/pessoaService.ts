import { supabase } from '../lib/supabase';
import type { Pessoa, PessoaFormData } from '../types/pessoa';

const TABLE = 'pessoas';

export const pessoaService = {
    async listar(): Promise<Pessoa[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .order('nome_completo', { ascending: true });

        if (error) throw error;
        return data as Pessoa[];
    },

    async buscarPorId(id: string): Promise<Pessoa> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Pessoa;
    },

    async criar(formData: PessoaFormData): Promise<Pessoa> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as Pessoa;
    },

    async atualizar(id: string, formData: Partial<PessoaFormData>): Promise<Pessoa> {
        const { data, error } = await supabase
            .from(TABLE)
            .update(formData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Pessoa;
    },

    async excluir(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async buscarPorSemelhanca(nome: string, cpf?: string | null): Promise<Pessoa[]> {
        let query = supabase
            .from(TABLE)
            .select('*');

        if (cpf) {
            query = query.or(`nome_completo.ilike.%${nome}%,cpf.eq.${cpf},email.ilike.%${nome}%,telefone.ilike.%${nome}%`);
        } else {
            query = query.or(`nome_completo.ilike.%${nome}%,email.ilike.%${nome}%,telefone.ilike.%${nome}%`);
        }

        const { data, error } = await query.limit(5);
        if (error) throw error;
        return data as Pessoa[];
    },
};
