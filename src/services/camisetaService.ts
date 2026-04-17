import { supabase } from '../lib/supabase';
import type { CamisetaModelo, CamisetaPedido, CamisetaPedidoFormData } from '../types/camiseta';

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
