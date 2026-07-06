import { supabase } from '../lib/supabase';
import type { Equipe, EquipeFormData } from '../types/equipe';
import { getFileExtension, optimizeImageForUpload } from '../utils/imageOptimization';
import { uploadPublicImage } from './publicImageStorageService';
import { createPrivateStorageReference, removeStorageReference } from './privateStorageService';

const TABLE = 'equipes';
type ComprovanteTipo = 'taxas' | 'camisetas';

const normalizeComprovantes = (latestUrl?: string | null, urls?: unknown): string[] => {
    const list = Array.isArray(urls)
        ? urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        : [];

    if (latestUrl && !list.includes(latestUrl)) {
        return [latestUrl, ...list];
    }

    return list;
};

export const equipeService = {
    async listar(): Promise<Equipe[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .is('deleted_at', null)
            .order('nome', { ascending: true });

        if (error) throw error;
        return data as Equipe[];
    },

    async listarAparecePosEncontro(): Promise<Equipe[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .is('deleted_at', null)
            .eq('aparece_pos_encontro', true)
            .order('nome', { ascending: true });

        if (error) throw error;
        return data as Equipe[];
    },

    /** Busca uma equipe pelo id sem carregar todas as equipes. */
    async buscarPorId(id: string): Promise<Equipe | null> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) throw error;
        return data as Equipe | null;
    },

    async buscarComPaginacao(busca: string = '', pagina: number = 0, limite: number = 5): Promise<Equipe[]> {
        let query = supabase
            .from(TABLE)
            .select('*')
            .is('deleted_at', null)
            .order('nome', { ascending: true });

        if (busca.trim() !== '') {
            query = query.ilike('nome', `%${busca}%`);
        }

        const from = pagina * limite;
        const to = from + limite - 1;

        const { data, error } = await query.range(from, to);

        if (error) throw error;
        return data as Equipe[];
    },

    async criar(formData: EquipeFormData): Promise<Equipe> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as Equipe;
    },

    async atualizar(id: string, formData: Partial<EquipeFormData>): Promise<Equipe> {
        const { data, error } = await supabase
            .from(TABLE)
            .update(formData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Equipe;
    },

    async excluir(id: string): Promise<void> {
        // Soft delete if preferred, but schema has deleted_at so let's use it
        const { error } = await supabase
            .from(TABLE)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    },

    async confirmarEquipe(equipeId: string, encontroId: string, usuarioId: string): Promise<void> {
        const { error } = await supabase
            .from('equipe_confirmacoes')
            .insert([{
                equipe_id: equipeId,
                encontro_id: encontroId,
                confirmado_por: usuarioId,
                confirmado_em: new Date().toISOString()
            }]);

        if (error) {
            if (error.code === '23505') return; // Já confirmado
            throw error;
        }
    },

    async obterConfirmacao(equipeId: string, encontroId: string) {
        const { data, error } = await supabase
            .from('equipe_confirmacoes')
            .select('*, profiles(email)')
            .eq('equipe_id', equipeId)
            .eq('encontro_id', encontroId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    async listarConfirmacoes(encontroId: string) {
        const { data, error } = await supabase
            .from('equipe_confirmacoes')
            .select('*, profiles(email)')
            .eq('encontro_id', encontroId);

        if (error) throw error;
        return data;
    },

    /**
     * Retorna um resumo leve de todas as equipes para o dashboard de confirmações.
     * Evita carregar todos os dados detalhados de pessoas — só o necessário para os cards.
     */
    async listarResumoConfirmacoes(encontroId: string): Promise<{
        equipe_id: string;
        equipe_nome: string;
        total_membros: number;
        membros_confirmados: number;
        progresso: number;
        confirmado: boolean;
        confirmado_por_nome?: string;
        confirmado_por_email?: string | null;
        confirmado_em?: string;
        coordenadores: { nome: string; email: string | null; confirmou: boolean }[];
        acesso_plenario: string;
    }[]> {
        // Busca as participações somente com campos necessários para o resumo
        const { data: parts, error: partsError } = await supabase
            .from('participacoes')
            .select('id, equipe_id, dados_confirmados, coordenador, pessoas(nome_completo, email)')
            .eq('encontro_id', encontroId);

        if (partsError) throw partsError;

        // Busca confirmações de equipe + perfil do confirmador
        const { data: confsRaw, error: confsError } = await supabase
            .from('equipe_confirmacoes')
            .select('*, profiles(email)')
            .eq('encontro_id', encontroId);

        if (confsError) throw confsError;

        // Busca nomes dos confirmadores via e-mail
        const confs = confsRaw as any[];
        const emails = [...new Set(confs.map(c => {
            const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            return p?.email;
        }).filter(Boolean))] as string[];

        const nomesMap = new Map<string, string>();
        if (emails.length > 0) {
            const { data: nomesData } = await supabase
                .from('pessoas')
                .select('email, nome_completo')
                .in('email', emails);
            (nomesData || []).forEach((n: any) => {
                if (n.email) nomesMap.set(n.email.toLowerCase(), n.nome_completo);
            });
        }

        // Busca lista de equipes (apenas id e nome)
        const { data: equipes, error: equipesError } = await supabase
            .from('equipes')
            .select('id, nome, acesso_plenario')
            .is('deleted_at', null)
            .order('nome', { ascending: true });

        if (equipesError) throw equipesError;

        return (equipes as { id: string; nome: string; acesso_plenario: string }[]).map(eq => {
            const teamParts = (parts as any[]).filter(p => p.equipe_id === eq.id);
            const membrosConfirmados = teamParts.filter(p => p.dados_confirmados).length;
            const totalMembros = teamParts.length;
            const progresso = totalMembros > 0 ? (membrosConfirmados / totalMembros) * 100 : 0;

            const conf = confs.find(c => c.equipe_id === eq.id);
            const confProfile = conf ? (Array.isArray(conf.profiles) ? conf.profiles[0] : conf.profiles) : null;
            const confEmail = confProfile?.email || null;
            const confNome = confEmail ? (nomesMap.get(confEmail.toLowerCase()) || confEmail) : undefined;

            const coordenadores = teamParts
                .filter(p => p.coordenador)
                .map(p => {
                    const pessoa = Array.isArray(p.pessoas) ? p.pessoas[0] : p.pessoas;
                    return {
                        nome: pessoa?.nome_completo || 'Sem nome',
                        email: pessoa?.email || null,
                        confirmou: !!p.dados_confirmados,
                    };
                });

            return {
                equipe_id: eq.id,
                equipe_nome: eq.nome || 'Sem nome',
                total_membros: totalMembros,
                membros_confirmados: membrosConfirmados,
                progresso,
                confirmado: !!conf,
                confirmado_por_nome: confNome,
                confirmado_por_email: confEmail,
                confirmado_em: conf?.confirmado_em,
                coordenadores,
                acesso_plenario: eq.acesso_plenario || 'verde',
            };
        });
    },

    async uploadFoto(equipeId: string, file: File): Promise<string> {
        const optimizedFile = await optimizeImageForUpload(file);
        const fileExt = getFileExtension(optimizedFile, 'webp');
        const fileName = `equipe_${equipeId}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `fotos/equipes/${fileName}`;

        return uploadPublicImage(filePath, optimizedFile);
    },
    async atualizarFotoConfirmacao(confirmacaoId: string, fotoUrl: string): Promise<void> {
        const { error } = await supabase
            .from('equipe_confirmacoes')
            .update({ foto_url: fotoUrl, foto_posicao_y: 50 })
            .eq('id', confirmacaoId);

        if (error) throw error;
    },
    async atualizarPosicaoFoto(confirmacaoId: string, posicionY: number): Promise<void> {
        const { error } = await supabase
            .from('equipe_confirmacoes')
            .update({ foto_posicao_y: posicionY })
            .eq('id', confirmacaoId);

        if (error) throw error;
    },
    async atualizarFotoCriancasRecreacao(confirmacaoId: string, fotoUrl: string): Promise<void> {
        const { error } = await supabase
            .from('equipe_confirmacoes')
            .update({
                criancas_recreacao_foto_url: fotoUrl || null,
                criancas_recreacao_foto_posicao_y: 50
            })
            .eq('id', confirmacaoId);

        if (error) throw error;
    },
    async atualizarPosicaoFotoCriancasRecreacao(confirmacaoId: string, posicaoY: number): Promise<void> {
        const { error } = await supabase
            .from('equipe_confirmacoes')
            .update({ criancas_recreacao_foto_posicao_y: posicaoY })
            .eq('id', confirmacaoId);

        if (error) throw error;
    },
    normalizeComprovantes,

    async uploadComprovante(equipeId: string, encontroId: string, file: File, tipo: ComprovanteTipo): Promise<string> {
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('O comprovante deve ter no máximo 10 MB.');
        }
        const fileExt = file.name.split('.').pop();
        const fileName = `comprovante_${tipo}_${equipeId}_${encontroId}_${Date.now()}.${fileExt}`;
        const filePath = `equipes/${encontroId}/${equipeId}/${tipo}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('comprovantes')
            .upload(filePath, file, {
                cacheControl: '31536000',
                upsert: false,
            });

        if (uploadError) throw uploadError;

        return createPrivateStorageReference('comprovantes', filePath);
    },
    async removerArquivoComprovante(reference: string): Promise<void> {
        await removeStorageReference(reference);
    },
    async atualizarComprovante(equipeId: string, encontroId: string, url: string, usuarioId: string, tipo: ComprovanteTipo): Promise<string[]> {
        const field = tipo === 'taxas' ? 'comprovante_taxas_url' : 'comprovante_camisetas_url';
        const listField = tipo === 'taxas' ? 'comprovantes_taxas_urls' : 'comprovantes_camisetas_urls';
        
        // Verifica se já existe confirmação
        const { data: existing } = await supabase
            .from('equipe_confirmacoes')
            .select(`id, ${field}, ${listField}`)
            .eq('equipe_id', equipeId)
            .eq('encontro_id', encontroId)
            .maybeSingle();

        if (existing) {
            const currentUrls = normalizeComprovantes(existing[field as keyof typeof existing] as string | null, existing[listField as keyof typeof existing]);
            const nextUrls = [...currentUrls, url];
            const { error } = await supabase
                .from('equipe_confirmacoes')
                .update({ [field]: url, [listField]: nextUrls })
                .eq('id', existing.id);
            if (error) throw error;
            return nextUrls;
        } else {
            const nextUrls = [url];
            const { error } = await supabase
                .from('equipe_confirmacoes')
                .insert([{
                    equipe_id: equipeId,
                    encontro_id: encontroId,
                    [field]: url,
                    [listField]: nextUrls,
                    confirmado_por: usuarioId,
                    confirmado_em: new Date().toISOString()
                }]);
            if (error) throw error;
            return nextUrls;
        }
    },
    async removerComprovante(equipeId: string, encontroId: string, url: string, tipo: ComprovanteTipo): Promise<string[]> {
        const field = tipo === 'taxas' ? 'comprovante_taxas_url' : 'comprovante_camisetas_url';
        const listField = tipo === 'taxas' ? 'comprovantes_taxas_urls' : 'comprovantes_camisetas_urls';

        const { data: existing, error: selectError } = await supabase
            .from('equipe_confirmacoes')
            .select(`id, ${field}, ${listField}`)
            .eq('equipe_id', equipeId)
            .eq('encontro_id', encontroId)
            .maybeSingle();

        if (selectError) throw selectError;
        if (!existing) return [];

        const currentUrls = normalizeComprovantes(existing[field as keyof typeof existing] as string | null, existing[listField as keyof typeof existing]);
        const nextUrls = currentUrls.filter(currentUrl => currentUrl !== url);
        const latestUrl = nextUrls[nextUrls.length - 1] || null;

        const { error: updateError } = await supabase
            .from('equipe_confirmacoes')
            .update({ [field]: latestUrl, [listField]: nextUrls })
            .eq('id', existing.id);

        if (updateError) throw updateError;

        try {
            await removeStorageReference(url);
        } catch (error) {
            console.error('Erro ao remover arquivo do comprovante:', error);
        }

        return nextUrls;
    },
    async verificarSeEquipeCompleta(equipeId: string, encontroId: string, isParticipante: boolean): Promise<boolean> {
        const { data, error } = await supabase
            .from('participacoes')
            .select('dados_confirmados')
            .eq('equipe_id', equipeId)
            .eq('encontro_id', encontroId)
            .eq('participante', isParticipante);

        if (error) throw error;
        if (!data || data.length === 0) return false;

        return data.every(p => p.dados_confirmados);
    }
};
