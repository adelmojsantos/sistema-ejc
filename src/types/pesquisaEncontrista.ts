import type {
  PesquisaSatisfacaoQuestion,
  PesquisaSatisfacaoRespostas,
  PesquisaSatisfacaoStatus,
} from './pesquisaSatisfacao';

export type PesquisaEncontristaPergunta = PesquisaSatisfacaoQuestion;

export interface PesquisaEncontristaConfig {
  encontro_id: string;
  publicada: boolean;
  publicada_em: string | null;
}

export interface PesquisaEncontristaFluxo {
  publicada: boolean;
  encontro_nome: string;
  perguntas: PesquisaEncontristaPergunta[];
  status: PesquisaSatisfacaoStatus;
  respostas: PesquisaSatisfacaoRespostas;
  enviado_em: string | null;
}

export interface PesquisaEncontristaEnvio {
  id: string;
  encontro_id: string;
  participacao_id: string;
  respostas: PesquisaSatisfacaoRespostas;
  status: Exclude<PesquisaSatisfacaoStatus, 'pendente'>;
  enviado_em: string | null;
  updated_at: string;
  participacoes?: {
    pessoas?: { nome_completo?: string } | null;
  } | null;
}
