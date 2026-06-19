export type LigacaoTipoPessoa = 'participante' | 'encontreiro' | 'crianca';
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
  presente_hoje?: boolean;
  idade?: number | null;
  responsavel_principal?: string | null;
  telefone_responsavel_principal?: string | null;
  equipe_responsavel_principal?: string | null;
  outro_responsavel?: string | null;
  telefone_outro_responsavel?: string | null;
  equipe_outro_responsavel?: string | null;
  observacoes?: string | null;
}
