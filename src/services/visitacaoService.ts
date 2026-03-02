import { supabase } from '../lib/supabase';
import type { VisitaDupla, VisitaDuplaFormData, VisitaVinculo, VisitaVinculoFormData } from '../types/visitacao';

const DUPLAS_TABLE = 'visita_duplas';
const VINCULOS_TABLE = 'visita_vinculos';

export const visitacaoService = {
    async listarDuplas(encontroId: string): Promise<VisitaDupla[]> {
        const { data, error } = await supabase
            .from(DUPLAS_TABLE)
            .select('*, pessoa1:pessoas!pessoa1_id(nome_completo), pessoa2:pessoas!pessoa2_id(nome_completo)')
            .eq('encontro_id', encontroId);

        if (error) throw error;
        return data as any[];
    },

    async criarDupla(formData: VisitaDuplaFormData): Promise<VisitaDupla> {
        const { data, error } = await supabase
            .from(DUPLAS_TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as VisitaDupla;
    },

    async excluirDupla(id: string): Promise<void> {
        const { error } = await supabase
            .from(DUPLAS_TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async listarVinculos(duplaId: string): Promise<VisitaVinculo[]> {
        const { data, error } = await supabase
            .from(VINCULOS_TABLE)
            .select('*, participante:pessoas!participante_id(nome_completo)')
            .eq('dupla_id', duplaId);

        if (error) throw error;
        return data as any[];
    },

    async vincularParticipante(formData: VisitaVinculoFormData): Promise<VisitaVinculo> {
        const { data, error } = await supabase
            .from(VINCULOS_TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as VisitaVinculo;
    },

    async desvincularParticipante(id: string): Promise<void> {
        const { error } = await supabase
            .from(VINCULOS_TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
