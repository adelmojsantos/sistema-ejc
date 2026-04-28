import { supabase } from '../lib/supabase';
import type { CamisetaModelo, CamisetaPedido, CamisetaPedidoFormData, CamisetaTamanho } from '../types/camiseta';

export const camisetaService = {
    async listarModelos(): Promise<CamisetaModelo[]> {
        const { data, error } = await supabase
            .from('camiseta_modelos')
            .select('*')
            .eq('ativo', true)
            .order('nome');

        if (error) throw error;
        return data || [];
    },

    async criarModelo(nome: string): Promise<CamisetaModelo> {
        const { data, error } = await supabase
            .from('camiseta_modelos')
            .insert([{ nome, ativo: true }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async atualizarModelo(id: string, nome: string): Promise<CamisetaModelo> {
        const { data, error } = await supabase
            .from('camiseta_modelos')
            .update({ nome })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async excluirModelo(id: string): Promise<void> {
        const { error } = await supabase
            .from('camiseta_modelos')
            .update({ ativo: false })
            .eq('id', id);

        if (error) throw error;
    },

    async listarTamanhos(modeloId?: string): Promise<CamisetaTamanho[]> {
        let query = supabase
            .from('camiseta_tamanhos')
            .select('*')
            .eq('ativo', true);
        
        if (modeloId) {
            query = query.eq('modelo_id', modeloId);
        }

        const { data, error } = await query.order('ordem');

        if (error) throw error;
        return data || [];
    },

    async criarTamanho(sigla: string, modeloId: string | null, ordem: number = 0): Promise<CamisetaTamanho> {
        const { data, error } = await supabase
            .from('camiseta_tamanhos')
            .insert([{ sigla, modelo_id: modeloId, ordem, ativo: true }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async atualizarTamanho(id: string, sigla: string, modeloId: string | null, ordem: number): Promise<CamisetaTamanho> {
        const { data, error } = await supabase
            .from('camiseta_tamanhos')
            .update({ sigla, modelo_id: modeloId, ordem })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async excluirTamanho(id: string): Promise<void> {
        const { error } = await supabase
            .from('camiseta_tamanhos')
            .update({ ativo: false })
            .eq('id', id);

        if (error) throw error;
    },

    async listarPedidosPorParticipacao(participacaoId: string): Promise<CamisetaPedido[]> {
        const { data, error } = await supabase
            .from('camiseta_pedidos')
            .select('*, camiseta_modelos(id, nome)')
            .eq('participacao_id', participacaoId);

        if (error) throw error;
        return data || [];
    },

    async listarPedidosPorEncontro(encontroId: string): Promise<CamisetaPedido[]> {
        const { data, error } = await supabase
            .from('camiseta_pedidos')
            .select('*, camiseta_modelos(id, nome), participacoes!inner(encontro_id)')
            .eq('participacoes.encontro_id', encontroId);

        if (error) throw error;
        return data || [];
    },

    async criarPedido(formData: CamisetaPedidoFormData): Promise<CamisetaPedido> {
        const { data, error } = await supabase
            .from('camiseta_pedidos')
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async atualizarPedido(id: string, formData: Partial<CamisetaPedidoFormData>): Promise<CamisetaPedido> {
        const { data, error } = await supabase
            .from('camiseta_pedidos')
            .update({ ...formData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async excluirPedido(id: string): Promise<void> {
        const { error } = await supabase
            .from('camiseta_pedidos')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
