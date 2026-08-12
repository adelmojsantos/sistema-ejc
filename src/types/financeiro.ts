export type FinanceiroTipo = 'receita' | 'despesa';
export type FinanceiroCategoriaTipo = 'receita' | 'despesa' | 'ambos';
export type FinanceiroOrigem = 'manual' | 'taxa' | 'camiseta' | 'almoxarifado_compra' | 'minimercado';
export type FinanceiroStatus = 'ativo' | 'cancelado';

export interface FinanceiroCategoria {
  id: string;
  encontro_id: string | null;
  nome: string;
  tipo: FinanceiroCategoriaTipo;
  cor: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceiroLancamento {
  id: string;
  encontro_id: string;
  categoria_id: string | null;
  tipo: FinanceiroTipo;
  origem: FinanceiroOrigem;
  origem_id: string | null;
  descricao: string;
  valor: number;
  data_lancamento: string;
  comprovantes_urls: string[];
  observacoes: string | null;
  status: FinanceiroStatus;
  criado_por_usuario_id: string | null;
  cancelado_em: string | null;
  cancelado_por_usuario_id: string | null;
  created_at: string;
  updated_at: string;
  categoria?: FinanceiroCategoria | null;
}

export interface FinanceiroResumo {
  receitas: number;
  despesas: number;
  saldo: number;
}

export interface FinanceiroLancamentoManualFormData {
  encontro_id: string;
  categoria_id: string;
  tipo: FinanceiroTipo;
  descricao: string;
  valor: number;
  data_lancamento: string;
  observacoes: string;
}

export type FinanceiroReconciliacaoTipo = 'taxa' | 'camiseta';
export type FinanceiroReconciliacaoFonte = 'participacao_taxa' | 'camiseta_pedido' | 'visita_camiseta';
export type FinanceiroReconciliacaoStatus = 'ativo' | 'cancelado';
export type FinanceiroReconciliacaoPublico = 'encontreiro' | 'encontrista';

export interface FinanceiroReconciliacaoPendente {
  tipo: FinanceiroReconciliacaoTipo;
  fonte: FinanceiroReconciliacaoFonte;
  fonte_id: string;
  pessoa_nome: string;
  grupo_nome: string;
  publico: FinanceiroReconciliacaoPublico;
  valor_esperado: number;
  comprovantes_urls: string[];
  pago_em: string | null;
}

export interface FinanceiroReconciliacaoItem {
  id: string;
  reconciliacao_id: string;
  fonte: FinanceiroReconciliacaoFonte;
  fonte_id: string;
  descricao: string;
  grupo_nome: string | null;
  valor_esperado: number;
  comprovantes_urls: string[];
  status: FinanceiroReconciliacaoStatus;
  created_at: string;
}

export interface FinanceiroReconciliacao {
  id: string;
  encontro_id: string;
  tipo: FinanceiroReconciliacaoTipo;
  valor_esperado: number;
  valor_recebido: number;
  data_recebimento: string;
  justificativa: string | null;
  comprovantes_urls: string[];
  status: FinanceiroReconciliacaoStatus;
  financeiro_lancamento_id: string | null;
  criado_por_usuario_id: string | null;
  cancelado_em: string | null;
  cancelado_por_usuario_id: string | null;
  created_at: string;
  updated_at: string;
  itens: FinanceiroReconciliacaoItem[];
}

export interface FinanceiroReconciliacaoPendencias {
  taxas: FinanceiroReconciliacaoPendente[];
  camisetas: FinanceiroReconciliacaoPendente[];
}

export interface FinanceiroReconciliacaoFormData {
  encontro_id: string;
  tipo: FinanceiroReconciliacaoTipo;
  itens: Array<Pick<FinanceiroReconciliacaoPendente, 'fonte' | 'fonte_id'>>;
  valor_recebido: number;
  data_recebimento: string;
  justificativa: string;
}
