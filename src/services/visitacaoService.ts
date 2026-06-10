import { supabase } from '../lib/supabase';
import type { VisitaGrupo, VisitaGrupoFormData, VisitaParticipacao, VisitaParticipacaoFormData, VisitaParticipacaoEnriched } from '../types/visitacao';

export interface IntencaoCamisetaItem {
    id?: string;
    visita_id?: string;
    modelo_id: string;
    tamanho: string;
    quantidade: number;
    pago?: boolean;
    comprovante_url?: string | null;
    pago_em?: string | null;
    pago_por?: string | null;
    // Enriched
    camiseta_modelos?: { id: string; nome: string };
}

const GRUPOS_TABLE = 'visita_grupos';
const PARTICIPACAO_TABLE = 'visita_participacao';

export const visitacaoService = {
    // Group Management
    async listarGrupos(encontroId: string): Promise<VisitaGrupo[]> {
        const { data, error } = await supabase
            .from(GRUPOS_TABLE)
            .select('*')
            .eq('encontro_id', encontroId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async criarGrupo(formData: VisitaGrupoFormData): Promise<VisitaGrupo> {
        const { data, error } = await supabase
            .from(GRUPOS_TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async atualizarGrupo(id: string, nome: string): Promise<void> {
        const { error } = await supabase
            .from(GRUPOS_TABLE)
            .update({ nome })
            .eq('id', id);

        if (error) throw error;
    },

    async excluirGrupo(id: string): Promise<void> {
        const { error } = await supabase
            .from(GRUPOS_TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Participation Management
    async listarParticipacaoPorEncontro(encontroId: string): Promise<VisitaParticipacaoEnriched[]> {
        const { data, error } = await supabase
            .from(PARTICIPACAO_TABLE)
            .select(`
                *,
                participacoes:participacao_id (
                    id,
                    encontro_id,
                    pessoas (*)
                ),
                visita_grupos:grupo_id (nome)
            `)
            .filter('participacoes.encontro_id', 'eq', encontroId);

        if (error) throw error;
        return data || [];
    },

    async vincular(formData: VisitaParticipacaoFormData): Promise<VisitaParticipacao> {
        const { data, error } = await supabase
            .from(PARTICIPACAO_TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async desvincular(id: string): Promise<void> {
        const { error } = await supabase
            .from(PARTICIPACAO_TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Visit Execution
    async atualizarVisita(id: string, updates: Partial<VisitaParticipacao>): Promise<void> {
        const { error } = await supabase
            .from(PARTICIPACAO_TABLE)
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async uploadFoto(participacaoId: string, file: File): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${participacaoId}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `fotos/equipes/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('galeria')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('galeria')
            .getPublicUrl(filePath);

        return data.publicUrl;
    },

    async atualizarPessoa(id: string, updates: Record<string, unknown>): Promise<void> {
        const { error } = await supabase
            .from('pessoas')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async atualizarParticipacao(id: string, updates: Record<string, unknown>): Promise<void> {
        const { error } = await supabase
            .from('participacoes')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async trocarGrupo(id: string, novoGrupoId: string): Promise<void> {
        const { error } = await supabase
            .from(PARTICIPACAO_TABLE)
            .update({ grupo_id: novoGrupoId })
            .eq('id', id);

        if (error) throw error;
    },

    async listarIntencoes(visitaId: string): Promise<IntencaoCamisetaItem[]> {
        const { data, error } = await supabase
            .from('visita_intencao_camiseta')
            .select('*, camiseta_modelos(id, nome)')
            .eq('visita_id', visitaId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async salvarIntencoes(visitaId: string, itens: IntencaoCamisetaItem[]): Promise<void> {
        const { data: existentes, error: selectError } = await supabase
            .from('visita_intencao_camiseta')
            .select('id')
            .eq('visita_id', visitaId);

        if (selectError) throw selectError;

        const idsMantidos = new Set(itens.flatMap(item => item.id ? [item.id] : []));
        const idsParaExcluir = (existentes || [])
            .map(item => item.id)
            .filter(itemId => !idsMantidos.has(itemId));

        if (idsParaExcluir.length > 0) {
            const { error: deleteError } = await supabase
                .from('visita_intencao_camiseta')
                .delete()
                .in('id', idsParaExcluir);

            if (deleteError) throw deleteError;
        }

        const itensExistentes = itens.filter(item => item.id);
        await Promise.all(itensExistentes.map(async item => {
            const { error } = await supabase
                .from('visita_intencao_camiseta')
                .update({
                    modelo_id: item.modelo_id,
                    tamanho: item.tamanho,
                    quantidade: item.quantidade
                })
                .eq('id', item.id!)
                .eq('visita_id', visitaId);

            if (error) throw error;
        }));

        const novosItens = itens.filter(item => !item.id);
        if (novosItens.length === 0) return;

        const rows = novosItens.map(item => ({
            visita_id: visitaId,
            modelo_id: item.modelo_id,
            tamanho: item.tamanho,
            quantidade: item.quantidade
        }));

        const { error: insertError } = await supabase
            .from('visita_intencao_camiseta')
            .insert(rows);

        if (insertError) throw insertError;
    },

    async atualizarPagamentoIntencao(id: string, pago: boolean): Promise<void> {
        const { data: authData } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('visita_intencao_camiseta')
            .update({
                pago,
                pago_em: pago ? new Date().toISOString() : null,
                pago_por: pago ? authData.user?.id || null : null
            })
            .eq('id', id);

        if (error) throw error;
    },

    async uploadComprovanteIntencao(id: string, file: File): Promise<string> {
        const fileExt = file.name.split('.').pop() || 'arquivo';
        const filePath = `comprovantes/camisetas-intencoes/${id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('galeria')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('galeria')
            .getPublicUrl(filePath);

        const { error: updateError } = await supabase
            .from('visita_intencao_camiseta')
            .update({ comprovante_url: data.publicUrl })
            .eq('id', id);

        if (updateError) throw updateError;
        return data.publicUrl;
    },

    async removerComprovanteIntencao(id: string): Promise<void> {
        const { error } = await supabase
            .from('visita_intencao_camiseta')
            .update({ comprovante_url: null })
            .eq('id', id);

        if (error) throw error;
    }
};

