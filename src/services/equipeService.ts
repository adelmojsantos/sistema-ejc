import { supabase } from '../lib/supabase';
import type { Equipe, EquipeFormData } from '../types/equipe';

const TABLE = 'equipes';

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

    async uploadFoto(equipeId: string, file: File): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `equipe_${equipeId}_${Math.random().toString(36).substring(2)}.${fileExt}`;
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
    }
};
