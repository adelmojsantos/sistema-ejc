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

  async salvar(
    participacaoId: string,
    formData: RecepcaoDadosFormData,
    visitaParticipacaoId?: string | null
  ): Promise<RecepcaoDados> {
    const existing = await this.obterPorParticipacao(participacaoId);
    const payload = visitaParticipacaoId !== undefined
      ? { ...formData, visita_participacao_id: visitaParticipacaoId }
      : formData;

    if (existing) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from(TABLE)
        .insert([{ ...payload, participacao_id: participacaoId }])
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
          participante,
          pessoas (nome_completo, telefone),
          equipes (nome)
        ),
        visita_participacao:visita_participacao_id (
          id,
          grupo_id,
          status,
          visita_grupos:grupo_id (nome)
        )
      `)
      .eq('participacoes.encontro_id', encontroId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as RecepcaoDados[]) || [];
  }
};
