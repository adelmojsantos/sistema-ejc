import { supabase } from '../lib/supabase';
import type { PesquisaPublicacaoAuditoria, PesquisaPublicacaoTipo } from '../types/pesquisaPublicacao';

export const pesquisaPublicacaoService = {
  async listarAuditoria(encontroId: string, tipo: PesquisaPublicacaoTipo) {
    const { data, error } = await supabase
      .from('pesquisa_publicacao_auditoria')
      .select('id, encontro_id, pesquisa_tipo, acao, realizado_por, realizado_por_nome, realizado_por_email, realizado_em')
      .eq('encontro_id', encontroId)
      .eq('pesquisa_tipo', tipo)
      .order('realizado_em', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PesquisaPublicacaoAuditoria[];
  },
};
