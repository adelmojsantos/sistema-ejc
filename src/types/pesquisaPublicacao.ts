export type PesquisaPublicacaoTipo = 'encontreiros' | 'encontristas';
export type PesquisaPublicacaoAcao = 'publicou' | 'despublicou';

export interface PesquisaPublicacaoAuditoria {
  id: string;
  encontro_id: string;
  pesquisa_tipo: PesquisaPublicacaoTipo;
  acao: PesquisaPublicacaoAcao;
  realizado_por: string | null;
  realizado_por_nome: string | null;
  realizado_por_email: string | null;
  realizado_em: string;
}
