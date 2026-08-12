import { supabase } from '../lib/supabase';
import { getFileExtension, optimizeImageForUpload } from '../utils/imageOptimization';
import { uploadPublicImage } from './publicImageStorageService';
import type {
  FinanceiroCategoria,
  FinanceiroLancamento,
  FinanceiroLancamentoManualFormData,
  FinanceiroReconciliacao,
  FinanceiroReconciliacaoFormData,
  FinanceiroReconciliacaoItem,
  FinanceiroReconciliacaoPendencias,
  FinanceiroReconciliacaoPendente,
  FinanceiroResumo,
} from '../types/financeiro';

const normalizeNumber = (value: unknown) => Number(value ?? 0);
const MAX_COMPROVANTE_BYTES = 10 * 1024 * 1024;

const normalizeComprovantes = (urls?: unknown): string[] => (
  Array.isArray(urls)
    ? urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : []
);

const lancamentoSelect = `
  *,
  categoria:financeiro_categorias(*)
`;

function normalizeLancamento(row: FinanceiroLancamento): FinanceiroLancamento {
  return {
    ...row,
    valor: normalizeNumber(row.valor),
    comprovantes_urls: normalizeComprovantes(row.comprovantes_urls),
  };
}

function normalizeReconciliacaoPendente(row: FinanceiroReconciliacaoPendente): FinanceiroReconciliacaoPendente {
  return {
    ...row,
    publico: row.publico || (row.fonte === 'visita_camiseta' ? 'encontrista' : 'encontreiro'),
    valor_esperado: normalizeNumber(row.valor_esperado),
    comprovantes_urls: normalizeComprovantes(row.comprovantes_urls),
  };
}

function normalizeReconciliacao(row: FinanceiroReconciliacao): FinanceiroReconciliacao {
  return {
    ...row,
    valor_esperado: normalizeNumber(row.valor_esperado),
    valor_recebido: normalizeNumber(row.valor_recebido),
    comprovantes_urls: normalizeComprovantes(row.comprovantes_urls),
    itens: (row.itens || []).map((item: FinanceiroReconciliacaoItem) => ({
      ...item,
      valor_esperado: normalizeNumber(item.valor_esperado),
      comprovantes_urls: normalizeComprovantes(item.comprovantes_urls),
    })),
  };
}

export const financeiroService = {
  async listarCategorias(encontroId?: string, incluirInativas = false): Promise<FinanceiroCategoria[]> {
    let query = supabase
      .from('financeiro_categorias')
      .select('*')
      .order('nome');

    if (!incluirInativas) {
      query = query.eq('ativo', true);
    }

    if (encontroId) {
      query = query.or(`encontro_id.eq.${encontroId},encontro_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as FinanceiroCategoria[];
  },

  async criarCategoria(data: {
    encontro_id: string | null;
    nome: string;
    tipo: FinanceiroCategoria['tipo'];
    cor: string | null;
  }): Promise<FinanceiroCategoria> {
    const { data: categoria, error } = await supabase
      .from('financeiro_categorias')
      .insert({
        encontro_id: data.encontro_id,
        nome: data.nome,
        tipo: data.tipo,
        cor: data.cor,
      })
      .select('*')
      .single();

    if (error) throw error;
    return categoria as FinanceiroCategoria;
  },

  async atualizarCategoria(id: string, data: Partial<Pick<FinanceiroCategoria, 'nome' | 'tipo' | 'cor' | 'ativo'>>): Promise<FinanceiroCategoria> {
    const { data: categoria, error } = await supabase
      .from('financeiro_categorias')
      .update(data)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return categoria as FinanceiroCategoria;
  },

  async listarLancamentos(encontroId: string): Promise<FinanceiroLancamento[]> {
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .select(lancamentoSelect)
      .eq('encontro_id', encontroId)
      .eq('status', 'ativo')
      .order('data_lancamento', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data as FinanceiroLancamento[]) || []).map(normalizeLancamento);
  },

  async obterLancamentoPorOrigem(origem: string, origemId: string): Promise<FinanceiroLancamento | null> {
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .select(lancamentoSelect)
      .eq('origem', origem)
      .eq('origem_id', origemId)
      .eq('status', 'ativo')
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeLancamento(data as FinanceiroLancamento) : null;
  },

  async criarLancamentoManual(formData: FinanceiroLancamentoManualFormData): Promise<FinanceiroLancamento> {
    const { data, error } = await supabase.rpc('criar_financeiro_lancamento_manual', {
      p_encontro_id: formData.encontro_id,
      p_categoria_id: formData.categoria_id || null,
      p_tipo: formData.tipo,
      p_descricao: formData.descricao,
      p_valor: formData.valor,
      p_data_lancamento: formData.data_lancamento || new Date().toISOString().slice(0, 10),
      p_observacoes: formData.observacoes,
    });

    if (error) throw error;
    return normalizeLancamento(data as FinanceiroLancamento);
  },

  async atualizarComprovantesLancamento(id: string, comprovantesUrls: string[]): Promise<FinanceiroLancamento> {
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .update({ comprovantes_urls: comprovantesUrls })
      .eq('id', id)
      .select(lancamentoSelect)
      .single();

    if (error) throw error;
    return normalizeLancamento(data as FinanceiroLancamento);
  },

  async uploadComprovanteLancamento(lancamentoId: string, file: File): Promise<string> {
    if (file.size > MAX_COMPROVANTE_BYTES) {
      throw new Error('O comprovante deve ter no máximo 10 MB.');
    }

    const isImage = file.type.startsWith('image/');
    const uploadFile = isImage
      ? await optimizeImageForUpload(file, { maxDimension: 1600, quality: 0.82 })
      : file;
    const extension = getFileExtension(uploadFile, 'arquivo');
    const filePath = `fotos/comprovantes/financeiro/lancamentos/${lancamentoId}/comprovante_${Date.now()}.${extension}`;

    return uploadPublicImage(filePath, uploadFile);
  },

  async anexarComprovantesLancamento(lancamento: FinanceiroLancamento, files: File[]): Promise<FinanceiroLancamento> {
    const uploadedReferences: string[] = [];

    for (const file of files) {
      uploadedReferences.push(await this.uploadComprovanteLancamento(lancamento.id, file));
    }

    return this.atualizarComprovantesLancamento(lancamento.id, [
      ...normalizeComprovantes(lancamento.comprovantes_urls),
      ...uploadedReferences,
    ]);
  },

  async listarPendenciasReconciliacao(encontroId: string): Promise<FinanceiroReconciliacaoPendencias> {
    const { data, error } = await supabase.rpc('listar_financeiro_reconciliacao_pendencias_v2', {
      p_encontro_id: encontroId,
    });

    if (error) throw error;
    const payload = (data || {}) as Partial<FinanceiroReconciliacaoPendencias>;
    return {
      taxas: (payload.taxas || []).map(normalizeReconciliacaoPendente),
      camisetas: (payload.camisetas || []).map(normalizeReconciliacaoPendente),
    };
  },

  async listarReconciliacoes(encontroId: string): Promise<FinanceiroReconciliacao[]> {
    const { data, error } = await supabase
      .from('financeiro_reconciliacoes')
      .select('*, itens:financeiro_reconciliacao_itens(*)')
      .eq('encontro_id', encontroId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data || []) as FinanceiroReconciliacao[]).map(normalizeReconciliacao);
  },

  async criarReconciliacao(formData: FinanceiroReconciliacaoFormData): Promise<FinanceiroReconciliacao> {
    const { data, error } = await supabase.rpc('criar_financeiro_reconciliacao', {
      p_encontro_id: formData.encontro_id,
      p_tipo: formData.tipo,
      p_itens: formData.itens,
      p_valor_recebido: formData.valor_recebido,
      p_data_recebimento: formData.data_recebimento,
      p_justificativa: formData.justificativa || null,
    });

    if (error) throw error;
    return normalizeReconciliacao({ ...(data as FinanceiroReconciliacao), itens: [] });
  },

  async cancelarReconciliacao(id: string): Promise<FinanceiroReconciliacao> {
    const { data, error } = await supabase.rpc('cancelar_financeiro_reconciliacao', {
      p_reconciliacao_id: id,
    });

    if (error) throw error;
    return normalizeReconciliacao({ ...(data as FinanceiroReconciliacao), itens: [] });
  },

  async cancelarLancamentoManual(id: string): Promise<FinanceiroLancamento> {
    const { data, error } = await supabase.rpc('cancelar_financeiro_lancamento_manual', {
      p_lancamento_id: id,
    });

    if (error) throw error;
    return normalizeLancamento(data as FinanceiroLancamento);
  },

  async atualizarLancamentoManual(id: string, formData: FinanceiroLancamentoManualFormData): Promise<FinanceiroLancamento> {
    const { data, error } = await supabase.rpc('atualizar_financeiro_lancamento_manual', {
      p_lancamento_id: id,
      p_categoria_id: formData.categoria_id || null,
      p_tipo: formData.tipo,
      p_descricao: formData.descricao,
      p_valor: formData.valor,
      p_data_lancamento: formData.data_lancamento || new Date().toISOString().slice(0, 10),
      p_observacoes: formData.observacoes,
    });

    if (error) throw error;
    return normalizeLancamento(data as FinanceiroLancamento);
  },

  calcularResumo(lancamentos: FinanceiroLancamento[]): FinanceiroResumo {
    const receitas = lancamentos
      .filter((lancamento) => lancamento.tipo === 'receita')
      .reduce((sum, lancamento) => sum + lancamento.valor, 0);
    const despesas = lancamentos
      .filter((lancamento) => lancamento.tipo === 'despesa')
      .reduce((sum, lancamento) => sum + lancamento.valor, 0);

    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
    };
  },
};
