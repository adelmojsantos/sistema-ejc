import { supabase } from '../lib/supabase';
import type { InscricaoEnriched } from '../types/inscricao';

/**
 * Fonte única para o resumo contextual de uma participação.
 * As telas informam somente participação + encontro; relações do Supabase
 * são normalizadas aqui para que o drawer tenha o mesmo comportamento em
 * Secretaria, Visitação e históricos.
 */
export async function carregarPessoaContexto(
  participacaoId: string,
  encontroId: string,
): Promise<InscricaoEnriched | null> {
  const { data, error } = await supabase
    .from('participacoes')
    .select(`
      *,
      pessoas(*),
      equipes(nome),
      camiseta_pedidos(id, quantidade),
      recepcao_dados(*),
      recreacao_dados!recreacao_dados_participacao_id_fkey(*),
      recreacao_dados_secundario:recreacao_dados!recreacao_dados_outro_responsavel_id_fkey(*),
      visita_participacao(id, visitante, status, observacoes, taxa_paga, data_visita, foto_familia_url, visita_grupos(nome)),
      circulo_participacao(id, circulos(nome))
    `)
    .eq('id', participacaoId)
    .eq('encontro_id', encontroId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const normalizeMany = <T>(value: T | T[] | null | undefined): T[] => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const context = data as unknown as InscricaoEnriched;
  return {
    ...context,
    recepcao_dados: normalizeMany(context.recepcao_dados)[0] ?? null,
    recreacao_dados: normalizeMany(context.recreacao_dados).filter((item) => !item.deleted_at),
    recreacao_dados_secundario: normalizeMany(context.recreacao_dados_secundario).filter((item) => !item.deleted_at),
    camiseta_pedidos: normalizeMany(context.camiseta_pedidos),
    visita_participacao: normalizeMany(context.visita_participacao),
    circulo_participacao: normalizeMany(context.circulo_participacao),
  };
}
