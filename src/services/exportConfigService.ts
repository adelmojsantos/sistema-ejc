import { supabase } from '../lib/supabase';

export interface ExportConfig {
    id: string;
    encontro_id: string | null;
    titulo: string;
    subtitulo: string;
    tema: string;
    imagem_esq_base64: string | null;
    imagem_dir_base64: string | null;
    observacoes: string | null;
    config_telas: Record<string, boolean>;
}

const TABLE = 'configuracoes_exportacao';

export const exportConfigService = {
    async obter(encontroId: string): Promise<ExportConfig | null> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('encontro_id', encontroId)
            .maybeSingle();

        if (error) throw error;
        return data as ExportConfig | null;
    },

    async salvar(config: Partial<ExportConfig>, encontroId: string): Promise<ExportConfig> {
        const atual = await this.obter(encontroId);
        
        const payload = {
            ...config,
            encontro_id: encontroId
        };

        if (atual) {
            const { data, error } = await supabase
                .from(TABLE)
                .update(payload)
                .eq('id', atual.id)
                .select()
                .single();
            if (error) throw error;
            return data as ExportConfig;
        } else {
            const { data, error } = await supabase
                .from(TABLE)
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            return data as ExportConfig;
        }
    },

    async listarTodas() {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, encontros(nome, tema)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as (ExportConfig & { encontros: { nome: string, tema: string } | null })[];
    },

    async obterPorId(id: string): Promise<ExportConfig | null> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        return data as ExportConfig | null;
    },

    async deletar(id: string) {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
