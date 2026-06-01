import { supabase } from '../lib/supabase';
import type { EncontroCronogramaItem, EncontroCronogramaItemFormData } from '../types/cronograma';

const TABLE = 'encontro_cronograma';

export const cronogramaService = {
  async listarPorEncontro(encontroId: string): Promise<EncontroCronogramaItem[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('encontro_id', encontroId)
      .order('data')
      .order('hora_inicio');

    if (error) throw error;
    return data as EncontroCronogramaItem[];
  },

  async criarItem(formData: EncontroCronogramaItemFormData): Promise<EncontroCronogramaItem> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert([formData])
      .select()
      .single();

    if (error) throw error;
    return data as EncontroCronogramaItem;
  },

  async atualizarItem(id: string, formData: Partial<EncontroCronogramaItemFormData>): Promise<EncontroCronogramaItem> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as EncontroCronogramaItem;
  },

  async excluirItem(id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
