import { supabase } from '../lib/supabase';
import type { RecepcaoContato, RecepcaoContatosDupla, RecepcaoDados, RecepcaoDadosFormData } from '../types/recepcao';

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
  },

  async listarContatosDupla(grupoId: string, encontroId: string): Promise<RecepcaoContatosDupla> {
    const { data: visitantesData, error: visitantesError } = await supabase
      .from('visita_participacao')
      .select(`
        id,
        participacoes!inner (
          id,
          pessoas (nome_completo, telefone)
        )
      `)
      .eq('grupo_id', grupoId)
      .eq('visitante', true)
      .eq('participacoes.encontro_id', encontroId);

    if (visitantesError) throw visitantesError;

    const { data: coordenadoresData, error: coordenadoresError } = await supabase
      .from('participacoes')
      .select(`
        id,
        pessoas (nome_completo, telefone),
        equipes!inner (nome)
      `)
      .eq('encontro_id', encontroId)
      .eq('coordenador', true)
      .ilike('equipes.nome', '%visita%');

    if (coordenadoresError) throw coordenadoresError;

    const visitantes = ((visitantesData || []) as any[]).map((v): RecepcaoContato => {
      const participacao = Array.isArray(v.participacoes) ? v.participacoes[0] : v.participacoes;
      const pessoa = Array.isArray(participacao?.pessoas) ? participacao.pessoas[0] : participacao?.pessoas;
      return {
        id: v.id,
        nome: pessoa?.nome_completo || 'Sem nome',
        telefone: pessoa?.telefone || null,
        papel: 'visitante'
      };
    });

    const coordenadores = ((coordenadoresData || []) as any[]).map((c): RecepcaoContato => {
      const pessoa = Array.isArray(c.pessoas) ? c.pessoas[0] : c.pessoas;
      return {
        id: c.id,
        nome: pessoa?.nome_completo || 'Sem nome',
        telefone: pessoa?.telefone || null,
        papel: 'coordenador'
      };
    });

    return { visitantes, coordenadores };
  }
};
