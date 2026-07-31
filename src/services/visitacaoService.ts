import { supabase } from '../lib/supabase';
import type { VisitaGrupo, VisitaGrupoDeleteImpact, VisitaParticipacao, VisitaParticipacaoEnriched } from '../types/visitacao';
import { getFileExtension, IMMUTABLE_PUBLIC_UPLOAD_OPTIONS, optimizeImageForUpload } from '../utils/imageOptimization';
import { createPrivateStorageReference, removeStorageReference } from './privateStorageService';
import { removePublicImage, uploadPublicImage } from './publicImageStorageService';

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

export const VISIT_PARTICIPATION_BY_ENCOUNTER_SELECT = `
    *,
    participacoes:participacao_id!inner (
        id,
        encontro_id,
        pessoas (*)
    ),
    visita_grupos:grupo_id (nome)
`;

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

    async criarDuplaTransacional(encontroId: string, visitanteAId: string, visitanteBId: string): Promise<VisitaGrupo> {
        const { data, error } = await supabase.rpc('create_visita_grupo', {
            p_encontro_id: encontroId,
            p_visitante_a_id: visitanteAId,
            p_visitante_b_id: visitanteBId
        });
        if (error) throw error;
        return data as VisitaGrupo;
    },

    async atualizarGrupo(id: string, nome: string): Promise<void> {
        const { error } = await supabase.rpc('rename_visita_grupo', {
            p_grupo_id: id,
            p_nome: nome
        });

        if (error) throw error;
    },

    async uploadFotoGrupo(id: string, file: File): Promise<string> {
        const optimizedFile = await optimizeImageForUpload(file);
        const fileExt = getFileExtension(optimizedFile, 'webp');
        const filePath = `fotos/duplas/${id}_${Date.now()}.${fileExt}`;
        return uploadPublicImage(filePath, optimizedFile);
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

        await removePublicImage(fotoUrl).catch((error) => {
            console.error('Erro ao remover foto da dupla:', error);
        });
    },

    async obterImpactoExclusaoGrupo(id: string): Promise<VisitaGrupoDeleteImpact> {
        const { data, error } = await supabase.rpc('get_visita_grupo_delete_impact', {
            p_grupo_id: id
        });
        if (error) throw error;
        return data as VisitaGrupoDeleteImpact;
    },

    async dissolverGrupo(id: string): Promise<VisitaGrupoDeleteImpact> {
        const { data, error } = await supabase.rpc('dissolve_visita_grupo', {
            p_grupo_id: id
        });
        if (error) throw error;

        const impact = data as VisitaGrupoDeleteImpact;
        if (impact.foto_url) {
            await removePublicImage(impact.foto_url).catch((storageError) => {
                console.error('Erro ao remover arquivo da foto da dupla dissolvida:', storageError);
            });
        }
        return impact;
    },

    // Participation Management
    async listarParticipacaoPorEncontro(encontroId: string): Promise<VisitaParticipacaoEnriched[]> {
        const { data, error } = await supabase
            .from(PARTICIPACAO_TABLE)
            .select(VISIT_PARTICIPATION_BY_ENCOUNTER_SELECT)
            .filter('participacoes.encontro_id', 'eq', encontroId);

        if (error) throw error;
        return data || [];
    },

    async vincularOuReatribuirEncontrista(grupoId: string, participacaoId: string): Promise<VisitaParticipacao> {
        const { data, error } = await supabase.rpc('assign_visita_participant', {
            p_grupo_id: grupoId,
            p_participacao_id: participacaoId
        });
        if (error) throw error;
        return data as VisitaParticipacao;
    },

    async substituirVisitante(grupoId: string, vinculoVisitanteId: string, novaParticipacaoId: string): Promise<VisitaGrupo> {
        const { data, error } = await supabase.rpc('replace_visita_grupo_visitor', {
            p_grupo_id: grupoId,
            p_vinculo_visitante_id: vinculoVisitanteId,
            p_nova_participacao_id: novaParticipacaoId
        });
        if (error) throw error;
        return data as VisitaGrupo;
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

        return uploadPublicImage(filePath, optimizedFile);
    },

    async uploadFotoFamilia(visitaId: string, file: File): Promise<string> {
        const optimizedFile = await optimizeImageForUpload(file);
        const fileExt = getFileExtension(optimizedFile, 'webp');
        const fileName = `${visitaId}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `fotos/visitacao/familias/${fileName}`;

        return uploadPublicImage(filePath, optimizedFile);
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

