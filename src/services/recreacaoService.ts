import { supabase } from '../lib/supabase';
import type { RecreacaoDados, RecreacaoDadosFormData } from '../types/recreacao';

const TABLE = 'recreacao_dados';

export const recreacaoService = {
  async listarPorParticipacao(participacaoId: string): Promise<RecreacaoDados[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        outro_responsavel:outro_responsavel_id (
          id,
          equipe_id,
          pessoas (nome_completo, telefone),
          equipes (nome)
        )
      `)
      .eq('participacao_id', participacaoId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data as unknown as RecreacaoDados[]) || [];
  },

  async salvar(participacaoId: string, formData: RecreacaoDadosFormData, id?: string): Promise<RecreacaoDados> {
    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from(TABLE)
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from(TABLE)
        .insert([{ ...formData, participacao_id: participacaoId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async listarTodosPorEncontro(encontroId: string): Promise<RecreacaoDados[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        participacoes:participacao_id!inner (
          encontro_id,
          equipe_id,
          pessoas (nome_completo, telefone),
          equipes (nome)
        ),
        outro_responsavel:outro_responsavel_id (
          id,
          equipe_id,
          pessoas (nome_completo, telefone),
          equipes (nome)
        )
      `)
      .eq('participacoes.encontro_id', encontroId)
      .order('nome_crianca', { ascending: true });

    if (error) throw error;
    return (data as unknown as RecreacaoDados[]) || [];
  }
};
