export interface AlmoxarifadoCategoria {
  id: string;
  nome: string;
  cor: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlmoxarifadoUnidade {
  id: string;
  nome: string;
  sigla: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlmoxarifadoItem {
  id: string;
  nome: string;
  categoria_id: string | null;
  unidade_id: string | null;
  equipe_padrao_id: string | null;
  marca_preferida: string | null;
  fornecedor_padrao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  categoria?: Pick<AlmoxarifadoCategoria, 'id' | 'nome' | 'cor'> | null;
  unidade?: Pick<AlmoxarifadoUnidade, 'id' | 'nome' | 'sigla'> | null;
  equipe_padrao?: { id: string; nome: string | null } | null;
}

export interface AlmoxarifadoSaldo {
  id: string;
  encontro_id: string | null;
  item_id: string;
  equipe_id: string | null;
  marca: string | null;
  fornecedor: string | null;
  quantidade: number;
  data_validade: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  item?: AlmoxarifadoItem | null;
  equipe?: { id: string; nome: string | null } | null;
}

export type AlmoxarifadoMovimentacaoTipo = 'entrada' | 'saida' | 'ajuste';

export interface AlmoxarifadoMovimentacao {
  id: string;
  saldo_id: string | null;
  encontro_id: string | null;
  item_id: string;
  equipe_id: string | null;
  tipo: AlmoxarifadoMovimentacaoTipo;
  quantidade: number;
  quantidade_anterior: number | null;
  quantidade_resultante: number | null;
  motivo: string | null;
  usuario_id: string | null;
  created_at: string;
}

export interface AlmoxarifadoItemFormData {
  nome: string;
  categoria_id: string;
  unidade_id: string;
  equipe_padrao_id: string;
  marca_preferida: string;
  fornecedor_padrao: string;
}

export interface AlmoxarifadoSaldoFormData {
  encontro_id: string;
  item_id: string;
  equipe_id: string;
  marca: string;
  fornecedor: string;
  quantidade: number;
  data_validade: string;
  observacoes: string;
}

export interface AlmoxarifadoMovimentacaoInput {
  saldo_id: string;
  tipo: AlmoxarifadoMovimentacaoTipo;
  quantidade: number;
  motivo: string;
}

export type AlmoxarifadoPedidoStatus = 'rascunho' | 'enviado' | 'em_compra' | 'parcial' | 'finalizado' | 'cancelado';
export type AlmoxarifadoPedidoPrioridade = 'baixa' | 'normal' | 'alta';

export interface AlmoxarifadoPedido {
  id: string;
  encontro_id: string | null;
  solicitante_equipe_id: string | null;
  criado_por_usuario_id: string | null;
  criado_em_nome_de_terceiro: boolean;
  status: AlmoxarifadoPedidoStatus;
  titulo: string;
  observacoes: string | null;
  observacao_origem: string | null;
  created_at: string;
  updated_at: string;
  equipe?: { id: string; nome: string | null } | null;
  itens?: AlmoxarifadoPedidoItem[];
}

export interface AlmoxarifadoPedidoItem {
  id: string;
  pedido_id: string;
  item_id: string;
  marca_preferida: string | null;
  quantidade_necessaria: number;
  quantidade_disponivel: number;
  quantidade_a_comprar: number;
  prioridade: AlmoxarifadoPedidoPrioridade;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  item?: AlmoxarifadoItem | null;
}

export interface AlmoxarifadoPedidoFormData {
  encontro_id: string;
  solicitante_equipe_id: string;
  titulo: string;
  observacoes: string;
  observacao_origem: string;
}

export interface AlmoxarifadoPedidoItemFormData {
  pedido_id: string;
  item_id: string;
  marca_preferida: string;
  quantidade_necessaria: number;
  prioridade: AlmoxarifadoPedidoPrioridade;
  observacoes: string;
}

export type AlmoxarifadoCompraStatus = 'aberta' | 'finalizada' | 'cancelada';
export type AlmoxarifadoCompraItemStatus = 'pendente' | 'comprou' | 'nao_comprou';

export interface AlmoxarifadoCompra {
  id: string;
  encontro_id: string | null;
  mercado_fornecedor: string | null;
  data_compra: string;
  status: AlmoxarifadoCompraStatus;
  valor_total_calculado: number;
  valor_total_informado: number | null;
  comprovantes_urls: string[];
  estoque_lancado_em: string | null;
  financeiro_lancamento_id: string | null;
  financeiro_lancado_em: string | null;
  observacoes: string | null;
  criado_por_usuario_id: string | null;
  created_at: string;
  updated_at: string;
  itens?: AlmoxarifadoCompraItem[];
}

export interface AlmoxarifadoCompraItem {
  id: string;
  compra_id: string;
  pedido_item_id: string | null;
  item_id: string;
  marca: string | null;
  quantidade_a_comprar: number;
  quantidade_comprada: number;
  valor_unitario: number;
  valor_total: number;
  mercado_fornecedor: string | null;
  status: AlmoxarifadoCompraItemStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  item?: AlmoxarifadoItem | null;
}

export interface AlmoxarifadoCompraItemUpdate {
  status: AlmoxarifadoCompraItemStatus;
  quantidade_comprada: number;
  valor_unitario: number;
  mercado_fornecedor: string;
  observacoes: string;
}

export interface AlmoxarifadoCompraFinalizarItemInput extends AlmoxarifadoCompraItemUpdate {
  id: string;
}
