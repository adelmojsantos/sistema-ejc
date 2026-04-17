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

    async buscarComPaginacao(busca: string = '', pagina: number = 1, limite: number = 20, encontroId?: string): Promise<{ data: Pessoa[], count: number }> {
        let query;

        if (encontroId) {
            query = supabase
                .from(TABLE)
                .select('*, participacoes!inner(encontro_id)', { count: 'exact' })
                .eq('participacoes.encontro_id', encontroId);
        } else {
            query = supabase
                .from(TABLE)
                .select('*', { count: 'exact' });
        }

        query = query.order('nome_completo', { ascending: true });

        if (busca.trim() !== '') {
            query = query.or(`nome_completo.ilike.%${busca}%,cpf.ilike.%${busca}%,email.ilike.%${busca}%,telefone.ilike.%${busca}%,comunidade.ilike.%${busca}%`);
        }

        const from = (pagina - 1) * limite;
        const to = from + limite - 1;

        const { data, error, count } = await query.range(from, to);

        if (error) throw error;
        return { data: data as Pessoa[], count: count || 0 };
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

    async buscarHistorico(pessoaId: string): Promise<Record<string, unknown>[]> {
        const { data, error } = await supabase
            .from('participacoes')
            .select(`
                id,
                participante,
                coordenador,
                equipes ( nome ),
                encontros ( nome, ativo, tema )
            `)
            .eq('pessoa_id', pessoaId);

        if (error) throw error;
        return data || [];
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
            .select(`
                *,
                participacoes (
                    participante,
                    coordenador,
                    equipes (
                        nome
                    ),
                    encontros (
                        nome
                    )
                )
            `);

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
