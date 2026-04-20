import { supabase } from '../lib/supabase';
import type { RecepcaoDados, RecepcaoDadosFormData } from '../types/recepcao';

const TABLE = 'recepcao_dados';

export const recepcaoService = {
  async obterPorParticipacao(participacaoId: string): Promise<RecepcaoDados | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('participacao_id', participacaoId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async salvar(participacaoId: string, formData: RecepcaoDadosFormData): Promise<RecepcaoDados> {
    const existing = await this.obterPorParticipacao(participacaoId);

    if (existing) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(formData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
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

  async listarTodosPorEncontro(encontroId: string): Promise<RecepcaoDados[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        participacoes!inner (
          encontro_id,
          equipe_id,
          pessoas (nome_completo, telefone),
          equipes (nome)
        )
      `)
      .eq('participacoes.encontro_id', encontroId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as RecepcaoDados[]) || [];
  }
};
