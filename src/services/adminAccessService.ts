import { supabase } from '../lib/supabase';

export interface Permissao {
    id: string;
    chave: string;
    descricao: string;
}

export interface Grupo {
    id: string;
    nome: string;
    descricao: string;
}

export interface GrupoPermissao {
    grupo_id: string;
    permissao_id: string;
}

export const adminAccessService = {
    async listPermissoes(): Promise<Permissao[]> {
        const { data, error } = await supabase.from('permissoes').select('*').order('descricao');
        if (error) throw error;
        return data || [];
    },

    async listGrupos(): Promise<Grupo[]> {
        const { data, error } = await supabase.from('grupos').select('*').order('nome');
        if (error) throw error;
        return data || [];
    },

    async listGrupoPermissoes(): Promise<GrupoPermissao[]> {
        const { data, error } = await supabase.from('grupo_permissoes').select('grupo_id, permissao_id');
        if (error) throw error;
        return data || [];
    },

    async updateGrupoPermissoes(grupoId: string, permissoesIds: string[]): Promise<void> {
        // Delete all bindings for this group
        const { error: delError } = await supabase.from('grupo_permissoes').delete().eq('grupo_id', grupoId);
        if (delError) throw delError;

        if (permissoesIds.length > 0) {
            const payload = permissoesIds.map(pId => ({ grupo_id: grupoId, permissao_id: pId }));
            const { error: insError } = await supabase.from('grupo_permissoes').insert(payload);
            if (insError) throw insError;
        }
    },

    async createGrupo(nome: string, descricao: string): Promise<Grupo> {
        const { data, error } = await supabase.from('grupos').insert([{ nome, descricao }]).select().single();
        if (error) throw error;
        return data;
    },

    async deleteGrupo(grupoId: string): Promise<void> {
        const { error } = await supabase.from('grupos').delete().eq('id', grupoId);
        if (error) throw error;
    }
};
