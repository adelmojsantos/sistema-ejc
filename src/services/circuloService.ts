import { supabase } from '../lib/supabase';
import type { Circulo, CirculoFormData } from '../types/circulo';

const TABLE = 'circulos';

export const circuloService = {
    async listar(): Promise<Circulo[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .is('deleted_at', null)
            .order('nome', { ascending: true });

        if (error) throw error;
        return data as Circulo[];
    },

    async criar(formData: CirculoFormData): Promise<Circulo> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as Circulo;
    },

    async atualizar(id: number, formData: Partial<CirculoFormData>): Promise<Circulo> {
        const { data, error } = await supabase
            .from(TABLE)
            .update(formData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Circulo;
    },

    async excluir(id: number): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    },

    async uploadImagem(file: File): Promise<string> {
        const extension = file.name.split('.').pop() || 'jpg';
        const randomId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
        const filePath = `fotos/circulos/circulo_${randomId}_${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from('galeria')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('galeria')
            .getPublicUrl(filePath);

        return data.publicUrl;
    },
};
