import { supabase } from '../lib/supabase';
import type { RecreacaoDados, RecreacaoDadosFormData, RecreacaoQuadranteDados } from '../types/recreacao';

const TABLE = 'recreacao_dados';

export const recreacaoService = {
  async listarPorResponsavel(participacaoId: string): Promise<RecreacaoDados[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        participacoes:participacao_id (
          id,
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
      .or(`participacao_id.eq.${participacaoId},outro_responsavel_id.eq.${participacaoId}`)
      .is('deleted_at', null)
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
        .is('deleted_at', null)
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
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();

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
      .is('deleted_at', null)
      .order('nome_crianca', { ascending: true });

    if (error) throw error;
    return (data as unknown as RecreacaoDados[]) || [];
  },

  async listarQuadrantePorEncontro(encontroId: string): Promise<RecreacaoQuadranteDados[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        id,
        nome_crianca,
        participacoes:participacao_id!inner (
          encontro_id,
          pessoas (nome_completo),
          equipes (nome)
        ),
        outro_responsavel:outro_responsavel_id (
          pessoas (nome_completo),
          equipes (nome)
        )
      `)
      .eq('participacoes.encontro_id', encontroId)
      .is('deleted_at', null)
      .order('nome_crianca', { ascending: true });

    if (error) throw error;
    return (data as unknown as RecreacaoQuadranteDados[]) || [];
  }
};
