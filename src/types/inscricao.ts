import type { Pessoa } from './pessoa';
import type { RecepcaoDados } from './recepcao';
import type { RecreacaoDados } from './recreacao';
import type { VisitaStatus } from './visitacao';

export interface Inscricao {
  id: string; // uuid
  pessoa_id: string;
  encontro_id: string;
  data_inscricao: string | null;
  participante: boolean | null;
  equipe_id: string | null;
  coordenador: boolean | null;
  dados_confirmados: boolean | null;
  confirmado_em: string | null;
  pago_taxa: boolean | null;
  pago_camiseta?: boolean | null;
  origem?: string;
  foto_url?: string | null;
  foto_posicao_y?: number | null;
}

export interface InscricaoEnriched extends Inscricao {
  pessoas?: Pessoa;
  encontros?: {
    nome: string;
  };
  equipes?: {
    nome: string | null;
  };
  recepcao_dados?: RecepcaoDados | null;
  recreacao_dados?: RecreacaoDados[];
  recreacao_dados_secundario?: RecreacaoDados[];
  visita_participacao?: {
    id: string;
    visitante: boolean;
    status?: VisitaStatus | null;
    visita_grupos?: {
      nome: string | null;
    } | null;
  }[];
  circulo_participacao?: {
    id: string;
    circulos?: {
      nome: string | null;
    } | null;
  }[];
}

export type InscricaoFormData = Omit<Inscricao, 'id' | 'data_inscricao'>;

export const inscricaoFormDataVazia = (): InscricaoFormData => ({
    pessoa_id: '',
    encontro_id: '',
    participante: false,
    equipe_id: null,
    coordenador: false,
    dados_confirmados: false,
    confirmado_em: null,
    pago_taxa: false,
    pago_camiseta: false,
    foto_url: null,
    foto_posicao_y: 50,
});
