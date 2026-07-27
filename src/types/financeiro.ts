export type FinanceiroTipo = 'receita' | 'despesa' | 'ajuste';
export type FinanceiroCategoriaTipo = 'receita' | 'despesa' | 'ajuste' | 'ambos';
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
  ajustes: number;
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
