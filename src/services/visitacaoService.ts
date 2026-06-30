import { supabase } from '../lib/supabase';
import type { VisitaGrupo, VisitaGrupoFormData, VisitaParticipacao, VisitaParticipacaoFormData, VisitaParticipacaoEnriched } from '../types/visitacao';
import { getFileExtension, IMMUTABLE_PUBLIC_UPLOAD_OPTIONS, optimizeImageForUpload } from '../utils/imageOptimization';
import { createPrivateStorageReference, removeStorageReference } from './privateStorageService';

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

    async uploadFotoGrupo(id: string, file: File): Promise<string> {
        const optimizedFile = await optimizeImageForUpload(file);
        const fileExt = getFileExtension(optimizedFile, 'webp');
        const filePath = `fotos/duplas/${id}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
            .from('galeria')
            .upload(filePath, optimizedFile, IMMUTABLE_PUBLIC_UPLOAD_OPTIONS);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('galeria').getPublicUrl(filePath);
        return data.publicUrl;
    },

    async atualizarFotoGrupo(id: string, fotoUrl: string | null): Promise<void> {
        const { error } = await supabase
            .from(GRUPOS_TABLE)
            .update({ foto_url: fotoUrl })
            .eq('id', id);

        if (error) throw error;
    },

    async removerFotoGrupo(id: string, fotoUrl: string): Promise<void> {
        await this.atualizarFotoGrupo(id, null);

        try {
            const marker = '/storage/v1/object/public/galeria/';
            const storagePath = decodeURIComponent(new URL(fotoUrl).pathname.split(marker)[1] || '');
            if (storagePath) {
                const { error } = await supabase.storage.from('galeria').remove([storagePath]);
                if (error) console.error('Erro ao remover foto da dupla:', error);
            }
        } catch (error) {
            console.error('Erro ao identificar foto da dupla:', error);
        }
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
        const { data, error } = await supabase
            .from(PARTICIPACAO_TABLE)
            .update(updates)
            .eq('id', id)
            .select('participacao_id')
            .single();

        if (error) throw error;

        if (updates.taxa_paga !== undefined) {
            const { error: participacaoError } = await supabase
                .from('participacoes')
                .update({ pago_taxa: updates.taxa_paga })
                .eq('id', data.participacao_id);

            if (participacaoError) throw participacaoError;
        }
    },

    async uploadFoto(participacaoId: string, file: File): Promise<string> {
        const optimizedFile = await optimizeImageForUpload(file);
        const fileExt = getFileExtension(optimizedFile, 'webp');
        const fileName = `${participacaoId}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `fotos/equipes/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('galeria')
            .upload(filePath, optimizedFile, IMMUTABLE_PUBLIC_UPLOAD_OPTIONS);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('galeria')
            .getPublicUrl(filePath);

        return data.publicUrl;
    },

    async uploadFotoFamilia(visitaId: string, file: File): Promise<string> {
        const optimizedFile = await optimizeImageForUpload(file);
        const fileExt = getFileExtension(optimizedFile, 'webp');
        const fileName = `${visitaId}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `fotos/visitacao/familias/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('galeria')
            .upload(filePath, optimizedFile, IMMUTABLE_PUBLIC_UPLOAD_OPTIONS);

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
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('O comprovante deve ter no máximo 10 MB.');
        }
        const fileExt = file.name.split('.').pop() || 'arquivo';
        const filePath = `visitacao/camisetas-intencoes/${id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('comprovantes')
            .upload(filePath, file, IMMUTABLE_PUBLIC_UPLOAD_OPTIONS);

        if (uploadError) throw uploadError;

        const reference = createPrivateStorageReference('comprovantes', filePath);

        const { error: updateError } = await supabase
            .from('visita_intencao_camiseta')
            .update({ comprovante_url: reference })
            .eq('id', id);

        if (updateError) {
            await removeStorageReference(reference).catch((storageError) => {
                console.error('Erro ao desfazer upload do comprovante:', storageError);
            });
            throw updateError;
        }
        return reference;
    },

    async removerComprovanteIntencao(id: string): Promise<void> {
        const { data: intention, error: selectError } = await supabase
            .from('visita_intencao_camiseta')
            .select('comprovante_url')
            .eq('id', id)
            .maybeSingle();
        if (selectError) throw selectError;

        const { error } = await supabase
            .from('visita_intencao_camiseta')
            .update({ comprovante_url: null })
            .eq('id', id);

        if (error) throw error;

        if (intention?.comprovante_url) {
            try {
                await removeStorageReference(intention.comprovante_url);
            } catch (storageError) {
                console.error('Erro ao remover arquivo do comprovante:', storageError);
            }
        }
    }
};

