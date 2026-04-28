import { supabase } from '../lib/supabase';
import type { InscricaoEnriched } from '../types/inscricao';
import type { CamisetaPedido } from '../types/camiseta';

export interface ResumoCamisetas {
  modelo_id: string;
  modelo_nome: string;
  tamanhos: { [tamanho: string]: number };
  total: number;
}

export interface TaxaReport {
  equipe_id: string;
  equipe_nome: string;
  total_membros: number;
  pagos: number;
  pendentes: number;
}

export const comprasService = {
  async listarRelatorioTaxas(encontroId: string): Promise<TaxaReport[]> {
    const { data: parts, error: partsError } = await supabase
      .from('participacoes')
      .select('id, equipe_id, pago_taxa, equipes(nome)')
      .eq('encontro_id', encontroId);

    if (partsError) throw partsError;

    const { data: equipes, error: equipesError } = await supabase
      .from('equipes')
      .select('id, nome')
      .is('deleted_at', null)
      .order('nome');

    if (equipesError) throw equipesError;

    const relatorio = (equipes || []).map(eq => {
      const teamParts = (parts || []).filter(p => p.equipe_id === eq.id);
      const pagos = teamParts.filter(p => p.pago_taxa).length;
      return {
        equipe_id: eq.id,
        equipe_nome: eq.nome || 'Sem Equipe',
        total_membros: teamParts.length,
        pagos,
        pendentes: teamParts.length - pagos
      };
    });

    return relatorio;
  },

  async listarResumoCamisetas(encontroId: string): Promise<ResumoCamisetas[]> {
    const { data, error } = await supabase
      .from('camiseta_pedidos')
      .select('*, camiseta_modelos(nome), participacoes!inner(encontro_id)')
      .eq('participacoes.encontro_id', encontroId);

    if (error) throw error;

    const pedidos = data as (CamisetaPedido & { camiseta_modelos: { nome: string } })[];
    const resumoMap = new Map<string, ResumoCamisetas>();

    pedidos.forEach(p => {
      const modelId = p.modelo_id;
      if (!resumoMap.has(modelId)) {
        resumoMap.set(modelId, {
          modelo_id: modelId,
          modelo_nome: p.camiseta_modelos?.nome || 'Modelo Desconhecido',
          tamanhos: {},
          total: 0
        });
      }

      const item = resumoMap.get(modelId)!;
      const size = p.tamanho || 'Não Informado';
      item.tamanhos[size] = (item.tamanhos[size] || 0) + p.quantidade;
      item.total += p.quantidade;
    });

    return Array.from(resumoMap.values());
  },

  async listarPedidosDetalhados(encontroId: string): Promise<(CamisetaPedido & { pessoa_nome: string, equipe_nome: string })[]> {
    const { data, error } = await supabase
      .from('camiseta_pedidos')
      .select('*, camiseta_modelos(nome), participacoes!inner(encontro_id, pessoas(nome_completo), equipes(nome))')
      .eq('participacoes.encontro_id', encontroId);

    if (error) throw error;

    return (data as any[]).map(p => ({
      ...p,
      pessoa_nome: p.participacoes?.pessoas?.nome_completo || 'N/A',
      equipe_nome: p.participacoes?.equipes?.nome || 'Sem Equipe'
    }));
  }
};
