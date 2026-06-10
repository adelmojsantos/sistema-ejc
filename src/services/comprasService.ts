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

export interface ResumoIntencoes {
  modelo_id: string;
  modelo_nome: string;
  tamanhos: { [tamanho: string]: number };
  total: number;
}

export interface IntencaoCamisetaDetalhe {
  id: string;
  visita_id: string;
  modelo_id: string;
  modelo_nome: string;
  tamanho: string;
  quantidade: number;
  encontrista_nome: string;
  dupla_nome: string | null;
  pago: boolean;
  comprovante_url: string | null;
  pago_em: string | null;
}

export interface TaxaReport {
  equipe_id: string;
  equipe_nome: string;
  total_membros: number;
  pagos: number;
  pendentes: number;
  comprovante_taxas_url?: string | null;
  comprovantes_taxas_urls?: string[];
}

export interface CamisetaEquipeReport {
  equipe_id: string;
  equipe_nome: string;
  total_pedidos: number;
  total_camisetas: number;
  total_valor: number;
  comprovante_camisetas_url?: string | null;
  comprovantes_camisetas_urls?: string[];
}

export type PedidoDetalhadoCamiseta = CamisetaPedido & {
  pessoa_nome: string;
  equipe_id: string | null;
  equipe_nome: string;
  valor_unitario: number;
  participante: boolean;
  pago_camiseta: boolean;
  dupla_visitante_nome: string | null;
};

type MaybeArray<T> = T | T[] | null | undefined;

function firstItem<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type ModeloRow = {
  id?: string;
  nome?: string | null;
  valor?: number | null;
};

type ParticipacaoPedidoRow = {
  encontro_id?: string;
  equipe_id?: string | null;
  participante?: boolean | null;
  pago_camiseta?: boolean | null;
  pessoas?: MaybeArray<{ nome_completo?: string | null }>;
  equipes?: MaybeArray<{ nome?: string | null }>;
};

type PedidoRow = {
  id: string;
  participacao_id: string;
  modelo_id: string;
  tamanho: string | null;
  quantidade: number;
  created_at: string;
  updated_at: string;
  camiseta_modelos?: MaybeArray<ModeloRow>;
  participacoes?: MaybeArray<ParticipacaoPedidoRow>;
};

type ResumoIntencaoRow = {
  modelo_id: string;
  tamanho: string | null;
  quantidade: number;
  camiseta_modelos?: MaybeArray<ModeloRow>;
};

const normalizeComprovantes = (latestUrl?: string | null, urls?: unknown): string[] => {
  const list = Array.isArray(urls)
    ? urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : [];

  if (latestUrl && !list.includes(latestUrl)) {
    return [latestUrl, ...list];
  }

  return list;
};

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
      .select('equipe_id, comprovante_taxas_url, comprovantes_taxas_urls')
      .eq('encontro_id', encontroId);

    if (confsError) throw confsError;

    const relatorio = (equipes || []).map(eq => {
      const teamParts = (parts || []).filter(p => p.equipe_id === eq.id);
      const pagos = teamParts.filter(p => p.pago_taxa).length;
      const conf = confs?.find(c => c.equipe_id === eq.id);
      const comprovantes = normalizeComprovantes(conf?.comprovante_taxas_url || null, conf?.comprovantes_taxas_urls);
      return {
        equipe_id: eq.id,
        equipe_nome: eq.nome || 'Sem Equipe',
        total_membros: teamParts.length,
        pagos,
        pendentes: teamParts.length - pagos,
        comprovante_taxas_url: comprovantes[comprovantes.length - 1] || null,
        comprovantes_taxas_urls: comprovantes
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

    (pedidos as PedidoRow[] || []).forEach(p => {
      const modelId = p.modelo_id;
      const modelo = firstItem(p.camiseta_modelos);
      if (!resumoMap.has(modelId)) {
        const config = configs?.find(c => c.modelo_id === modelId);
        // Se não houver config específica, usa o valor global do modelo (se disponível na query) ou 0
        const valorUnitario = config ? config.valor : (modelo?.valor || 0);

        resumoMap.set(modelId, {
          modelo_id: modelId,
          modelo_nome: modelo?.nome || 'Modelo Desconhecido',
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

  async listarPedidosDetalhados(encontroId: string): Promise<PedidoDetalhadoCamiseta[]> {
    const { data: pedidos, error } = await supabase
      .from('camiseta_pedidos')
      .select('*, camiseta_modelos(nome, valor), participacoes!inner(encontro_id, equipe_id, participante, pago_camiseta, pessoas(nome_completo), equipes(nome))')
      .eq('participacoes.encontro_id', encontroId);

    if (error) throw error;

    // Busca os preços configurados para este encontro
    const { data: configs } = await supabase
      .from('camiseta_config_encontro')
      .select('modelo_id, valor')
      .eq('encontro_id', encontroId);

    const participacaoIds = [...new Set((pedidos as { participacao_id: string }[] || []).map(p => p.participacao_id).filter(Boolean))];
    const duplaPorParticipacao = new Map<string, string>();

    if (participacaoIds.length > 0) {
      const { data: visitas } = await supabase
        .from('visita_participacao')
        .select('participacao_id, visita_grupos(nome)')
        .in('participacao_id', participacaoIds)
        .eq('visitante', false);

      type VisitaPedidoRow = {
        participacao_id: string;
        visita_grupos?: { nome?: string | null } | { nome?: string | null }[] | null;
      };

      (visitas as VisitaPedidoRow[] || []).forEach(v => {
        const grupo = Array.isArray(v.visita_grupos) ? v.visita_grupos[0] : v.visita_grupos;
        if (v.participacao_id && grupo?.nome) {
          duplaPorParticipacao.set(v.participacao_id, grupo.nome);
        }
      });
    }

    return (pedidos as PedidoRow[] || []).map(p => {
      const config = configs?.find(c => c.modelo_id === p.modelo_id);
      const modelo = firstItem(p.camiseta_modelos);
      const participacao = firstItem(p.participacoes);
      const pessoa = firstItem(participacao?.pessoas);
      const equipe = firstItem(participacao?.equipes);
      const valorUnitario = config ? config.valor : (modelo?.valor || 0);

      return {
        ...p,
        tamanho: p.tamanho || 'Não Informado',
        camiseta_modelos: modelo ? { id: modelo.id || p.modelo_id, nome: modelo.nome || 'Modelo Desconhecido', valor: modelo.valor || 0 } : undefined,
        pessoa_nome: pessoa?.nome_completo || 'N/A',
        equipe_id: participacao?.equipe_id || null,
        equipe_nome: equipe?.nome || 'Sem Equipe',
        participante: participacao?.participante || false,
        pago_camiseta: participacao?.pago_camiseta || false,
        valor_unitario: valorUnitario,
        dupla_visitante_nome: duplaPorParticipacao.get(p.participacao_id) || null
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
      .select('equipe_id, comprovante_camisetas_url, comprovantes_camisetas_urls')
      .eq('encontro_id', encontroId);

    const relatorio = (equipes || []).map(eq => {
      const teamPedidos = (pedidos as PedidoRow[] || []).filter(p => {
        const participacao = firstItem(p.participacoes);
        return participacao?.equipe_id === eq.id;
      });

      const totalCamisetas = teamPedidos.reduce((sum, p) => sum + p.quantidade, 0);
      const totalPessoas = new Set(teamPedidos.map(p => p.participacao_id)).size;
      
      const totalValor = teamPedidos.reduce((sum, p) => {
        const config = configs?.find(c => c.modelo_id === p.modelo_id);
        const modelo = firstItem(p.camiseta_modelos);
        const valorUnitario = config ? config.valor : (modelo?.valor || 0);
        return sum + (p.quantidade * valorUnitario);
      }, 0);

      const conf = confs?.find(c => c.equipe_id === eq.id);
      const comprovantes = normalizeComprovantes(conf?.comprovante_camisetas_url || null, conf?.comprovantes_camisetas_urls);

      return {
        equipe_id: eq.id,
        equipe_nome: eq.nome || 'Sem Equipe',
        total_pedidos: totalPessoas,
        total_camisetas: totalCamisetas,
        total_valor: totalValor,
        comprovante_camisetas_url: comprovantes[comprovantes.length - 1] || null,
        comprovantes_camisetas_urls: comprovantes
      };
    });

    return relatorio;
  },

  async listarResumoIntencoes(encontroId: string): Promise<ResumoIntencoes[]> {
    // Busca intenções via visita_participacao -> participacoes -> encontro_id
    const { data, error } = await supabase
      .from('visita_intencao_camiseta')
      .select(`
        modelo_id, tamanho, quantidade,
        camiseta_modelos(nome),
        visita_participacao!inner(
          participacao_id,
          participacoes!inner(encontro_id)
        )
      `)
      .eq('visita_participacao.participacoes.encontro_id', encontroId);

    if (error) throw error;

    const resumoMap = new Map<string, ResumoIntencoes>();

    (data as ResumoIntencaoRow[] || []).forEach(item => {
      const modeloId = item.modelo_id;
      const modelo = firstItem(item.camiseta_modelos);
      const modeloNome = modelo?.nome || 'Modelo Desconhecido';

      if (!resumoMap.has(modeloId)) {
        resumoMap.set(modeloId, {
          modelo_id: modeloId,
          modelo_nome: modeloNome,
          tamanhos: {},
          total: 0
        });
      }

      const entry = resumoMap.get(modeloId)!;
      const size = item.tamanho || 'Não Informado';
      entry.tamanhos[size] = (entry.tamanhos[size] || 0) + item.quantidade;
      entry.total += item.quantidade;
    });

    return Array.from(resumoMap.values());
  },

  async listarDetalhesIntencoes(encontroId: string): Promise<IntencaoCamisetaDetalhe[]> {
    const { data: visitas, error: visitasError } = await supabase
      .from('visita_participacao')
      .select(`
        id,
        grupo_id,
        visita_grupos(nome),
        participacoes!inner(
          id,
          encontro_id,
          pessoas(nome_completo)
        )
      `)
      .eq('visitante', false)
      .eq('participacoes.encontro_id', encontroId);

    if (visitasError) throw visitasError;

    type VisitaRow = {
      id: string;
      visita_grupos?: { nome?: string | null } | { nome?: string | null }[] | null;
      participacoes?: {
        pessoas?: { nome_completo?: string | null } | { nome_completo?: string | null }[] | null;
      } | {
        pessoas?: { nome_completo?: string | null } | { nome_completo?: string | null }[] | null;
      }[] | null;
    };

    const visitasMap = new Map<string, { encontrista_nome: string; dupla_nome: string | null }>();

    (visitas as VisitaRow[] || []).forEach(visita => {
      const grupo = Array.isArray(visita.visita_grupos) ? visita.visita_grupos[0] : visita.visita_grupos;
      const participacao = Array.isArray(visita.participacoes) ? visita.participacoes[0] : visita.participacoes;
      const pessoa = Array.isArray(participacao?.pessoas) ? participacao?.pessoas[0] : participacao?.pessoas;

      visitasMap.set(visita.id, {
        encontrista_nome: pessoa?.nome_completo || 'Encontrista sem nome',
        dupla_nome: grupo?.nome || null
      });
    });

    const visitaIds = Array.from(visitasMap.keys());
    if (visitaIds.length === 0) return [];

    const { data: intencoes, error: intencoesError } = await supabase
      .from('visita_intencao_camiseta')
      .select('id, visita_id, modelo_id, tamanho, quantidade, pago, comprovante_url, pago_em, camiseta_modelos(id, nome)')
      .in('visita_id', visitaIds);

    if (intencoesError) throw intencoesError;

    type IntencaoRow = {
      id: string;
      visita_id: string;
      modelo_id: string;
      tamanho: string;
      quantidade: number;
      pago: boolean;
      comprovante_url: string | null;
      pago_em: string | null;
      camiseta_modelos?: { id?: string; nome?: string | null } | { id?: string; nome?: string | null }[] | null;
    };

    return (intencoes as IntencaoRow[] || []).map(item => {
      const visita = visitasMap.get(item.visita_id);
      const modelo = Array.isArray(item.camiseta_modelos) ? item.camiseta_modelos[0] : item.camiseta_modelos;

      return {
        id: item.id,
        visita_id: item.visita_id,
        modelo_id: item.modelo_id,
        modelo_nome: modelo?.nome || 'Modelo Desconhecido',
        tamanho: item.tamanho || 'Não Informado',
        quantidade: item.quantidade,
        encontrista_nome: visita?.encontrista_nome || 'Encontrista sem nome',
        dupla_nome: visita?.dupla_nome || null,
        pago: item.pago,
        comprovante_url: item.comprovante_url,
        pago_em: item.pago_em
      };
    });
  }
};
