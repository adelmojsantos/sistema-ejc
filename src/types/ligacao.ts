export type LigacaoTipoPessoa = 'participante' | 'encontreiro';
export type LigacaoCorEquipe = 'verde' | 'amarela' | 'vermelha';

export interface LigacaoRegistro {
  participacao_id: string;
  tipo: LigacaoTipoPessoa;
  nome: string;
  foto_url: string | null;
  foto_posicao_y: number;
  comunidade: string | null;
  circulo: string | null;
  dupla_visitacao: string | null;
  equipe_id: string | null;
  equipe: string | null;
  equipe_cor: LigacaoCorEquipe | null;
}
