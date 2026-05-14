import { supabase } from '../lib/supabase';
import type { CamisetaPedido } from '../types/camiseta';

export interface ResumoCamisetas {
  modelo_id: string;
  modelo_nome: string;
  tamanhos: { [tamanho: string]: number };
  total: number;
  valor_unitario: number;
  valor_total: number;
}

export interface TaxaReport {
  equipe_id: string;
  equipe_nome: string;
  total_membros: number;
  pagos: number;
  pendentes: number;
  comprovante_taxas_url?: string | null;
}

export interface CamisetaEquipeReport {
  equipe_id: string;
  equipe_nome: string;
  total_pedidos: number;
  total_camisetas: number;
  total_valor: number;
  comprovante_camisetas_url?: string | null;
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

    const { data: confs, error: confsError } = await supabase
      .from('equipe_confirmacoes')
      .select('equipe_id, comprovante_taxas_url')
      .eq('encontro_id', encontroId);

    if (confsError) throw confsError;

    const relatorio = (equipes || []).map(eq => {
      const teamParts = (parts || []).filter(p => p.equipe_id === eq.id);
      const pagos = teamParts.filter(p => p.pago_taxa).length;
      return {
        equipe_id: eq.id,
        equipe_nome: eq.nome || 'Sem Equipe',
        total_membros: teamParts.length,
        pagos,
        pendentes: teamParts.length - pagos,
        comprovante_taxas_url: confs?.find(c => c.equipe_id === eq.id)?.comprovante_taxas_url || null
      };
    });

    return relatorio;
  },

  async listarResumoCamisetas(encontroId: string): Promise<ResumoCamisetas[]> {
    const { data: pedidos, error: errorPedidos } = await supabase
      .from('camiseta_pedidos')
      .select('*, camiseta_modelos(nome), participacoes!inner(encontro_id)')
      .eq('participacoes.encontro_id', encontroId);

    if (errorPedidos) throw errorPedidos;

    // Busca os preços configurados para este encontro
    const { data: configs, error: errorConfigs } = await supabase
      .from('camiseta_config_encontro')
      .select('modelo_id, valor')
      .eq('encontro_id', encontroId);

    if (errorConfigs) throw errorConfigs;

    const resumoMap = new Map<string, ResumoCamisetas>();

    (pedidos as any[]).forEach(p => {
      const modelId = p.modelo_id;
      if (!resumoMap.has(modelId)) {
        const config = configs?.find(c => c.modelo_id === modelId);
        // Se não houver config específica, usa o valor global do modelo (se disponível na query) ou 0
        const valorUnitario = config ? config.valor : (p.camiseta_modelos?.valor || 0);

        resumoMap.set(modelId, {
          modelo_id: modelId,
          modelo_nome: p.camiseta_modelos?.nome || 'Modelo Desconhecido',
          tamanhos: {},
          total: 0,
          valor_unitario: valorUnitario,
          valor_total: 0
        });
      }

      const item = resumoMap.get(modelId)!;
      const size = p.tamanho || 'Não Informado';
      item.tamanhos[size] = (item.tamanhos[size] || 0) + p.quantidade;
      item.total += p.quantidade;
      item.valor_total = item.total * item.valor_unitario;
    });

    return Array.from(resumoMap.values());
  },

  async listarPedidosDetalhados(encontroId: string): Promise<(CamisetaPedido & { pessoa_nome: string, equipe_nome: string, valor_unitario: number, participante: boolean })[]> {
    const { data: pedidos, error } = await supabase
      .from('camiseta_pedidos')
      .select('*, camiseta_modelos(nome, valor), participacoes!inner(encontro_id, equipe_id, participante, pessoas(nome_completo), equipes(nome))')
      .eq('participacoes.encontro_id', encontroId);

    if (error) throw error;

    // Busca os preços configurados para este encontro
    const { data: configs } = await supabase
      .from('camiseta_config_encontro')
      .select('modelo_id, valor')
      .eq('encontro_id', encontroId);

    return (pedidos as any[]).map(p => {
      const config = configs?.find(c => c.modelo_id === p.modelo_id);
      const valorUnitario = config ? config.valor : (p.camiseta_modelos?.valor || 0);

      return {
        ...p,
        pessoa_nome: p.participacoes?.pessoas?.nome_completo || 'N/A',
        equipe_nome: p.participacoes?.equipes?.nome || 'Sem Equipe',
        participante: p.participacoes?.participante || false,
        valor_unitario: valorUnitario
      };
    });
  },

  async listarRelatorioCamisetasPorEquipe(encontroId: string): Promise<CamisetaEquipeReport[]> {
    const { data: pedidos, error } = await supabase
      .from('camiseta_pedidos')
      .select('participacao_id, quantidade, modelo_id, camiseta_modelos(valor), participacoes!inner(equipe_id, equipes(nome))')
      .eq('participacoes.encontro_id', encontroId);

    if (error) throw error;

    // Busca os preços configurados para este encontro
    const { data: configs } = await supabase
      .from('camiseta_config_encontro')
      .select('modelo_id, valor')
      .eq('encontro_id', encontroId);

    const { data: equipes, error: equipesError } = await supabase
      .from('equipes')
      .select('id, nome')
      .is('deleted_at', null)
      .order('nome');

    if (equipesError) throw equipesError;

    const { data: confs } = await supabase
      .from('equipe_confirmacoes')
      .select('equipe_id, comprovante_camisetas_url')
      .eq('encontro_id', encontroId);

    const relatorio = (equipes || []).map(eq => {
      const teamPedidos = (pedidos as any[] || []).filter(p => {
        const participacao = Array.isArray(p.participacoes) ? p.participacoes[0] : p.participacoes;
        return participacao?.equipe_id === eq.id;
      });

      const totalCamisetas = teamPedidos.reduce((sum, p) => sum + p.quantidade, 0);
      const totalPessoas = new Set(teamPedidos.map(p => p.participacao_id)).size;
      
      const totalValor = teamPedidos.reduce((sum, p) => {
        const config = configs?.find(c => c.modelo_id === p.modelo_id);
        const valorUnitario = config ? config.valor : (p.camiseta_modelos?.valor || 0);
        return sum + (p.quantidade * valorUnitario);
      }, 0);

      return {
        equipe_id: eq.id,
        equipe_nome: eq.nome || 'Sem Equipe',
        total_pedidos: totalPessoas,
        total_camisetas: totalCamisetas,
        total_valor: totalValor,
        comprovante_camisetas_url: confs?.find(c => c.equipe_id === eq.id)?.comprovante_camisetas_url || null
      };
    });

    return relatorio;
  }
};
