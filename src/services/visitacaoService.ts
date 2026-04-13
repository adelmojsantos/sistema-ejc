import { supabase } from '../lib/supabase';
import type { VisitaGrupo, VisitaGrupoFormData, VisitaParticipacao, VisitaParticipacaoFormData, VisitaParticipacaoEnriched } from '../types/visitacao';

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
                    pessoas (nome_completo, cpf)
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
        const filePath = `fotos/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('galeria')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('galeria')
            .getPublicUrl(filePath);

        return data.publicUrl;
    },

    async atualizarPessoa(id: string, updates: any): Promise<void> {
        const { error } = await supabase
            .from('pessoas')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    }
};

