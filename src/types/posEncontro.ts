import type { Circulo } from './circulo';
import type { Equipe } from './equipe';
import type { Encontro } from './encontro';
import type { InscricaoEnriched } from './inscricao';

export type PosEncontroStatus = 'pendente' | 'realizado' | 'cancelado';

export interface PosEncontro {
  id: string;
  encontro_id: string;
  ordem: number;
  titulo: string;
  tema: string | null;
  conteudo: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  arquivo_tamanho: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  encontros?: Pick<Encontro, 'nome' | 'edicao'> | null;
}

export interface PosEncontroFormData {
  encontro_id: string;
  ordem: number;
  titulo: string;
  tema: string | null;
  conteudo: string | null;
  arquivo_path?: string | null;
  arquivo_nome?: string | null;
  arquivo_tipo?: string | null;
  arquivo_tamanho?: number | null;
  ativo: boolean;
}

export interface PosEncontroRealizacao {
  id: string;
  pos_encontro_id: string;
  circulo_id: number;
  data_realizada: string | null;
  observacoes: string | null;
  status: PosEncontroStatus;
  created_at: string;
  updated_at: string;
  circulos?: Pick<Circulo, 'nome'> | null;
}

export interface PosEncontroRealizacaoFormData {
  pos_encontro_id: string;
  circulo_id: number;
  data_realizada: string | null;
  observacoes: string | null;
  status: PosEncontroStatus;
}

export interface PosEncontroPresenca {
  id: string;
  realizacao_id: string;
  participacao_id: string;
  presente: boolean;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface PosEncontroFicha {
  id: string;
  encontro_id: string;
  participacao_id: string;
  toca_instrumento: boolean;
  instrumentos: string | null;
  tem_carro: boolean;
  tem_moto: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  pos_encontro_ficha_equipes?: PosEncontroFichaEquipe[];
}

export interface PosEncontroFichaFormData {
  encontro_id: string;
  participacao_id: string;
  toca_instrumento: boolean;
  instrumentos: string | null;
  tem_carro: boolean;
  tem_moto: boolean;
  observacoes: string | null;
}

export interface PosEncontroFichaEquipe {
  id: string;
  ficha_id: string;
  equipe_id: string;
  ordem_preferencia: number;
  created_at: string;
  equipes?: Pick<Equipe, 'nome'> | null;
}

export interface PosEncontroParticipanteCirculo {
  circulo_participacao_id: string;
  circulo_id: number;
  mediador: boolean;
  participacao: InscricaoEnriched;
  presenca?: PosEncontroPresenca | null;
  ficha?: PosEncontroFicha | null;
}

export const posEncontroFormDataVazio = (encontroId = '', ordem = 1): PosEncontroFormData => ({
  encontro_id: encontroId,
  ordem,
  titulo: '',
  tema: '',
  conteudo: '',
  ativo: true,
});
