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

export interface PesquisaEncontristaRespondente {
  participacaoId: string;
  nome: string;
  status: PesquisaSatisfacaoStatus;
  respostas: PesquisaSatisfacaoRespostas;
  enviadoEm: string | null;
}

export interface PesquisaEncontristaOpcaoResumo {
  label: string;
  count: number;
}

export interface PesquisaEncontristaPerguntaResumo {
  pergunta: PesquisaEncontristaPergunta;
  totalRespondidas: number;
  media?: number;
  opcoes?: PesquisaEncontristaOpcaoResumo[];
  textos?: Array<{
    nome: string;
    texto: string;
  }>;
}

export interface PesquisaEncontristaEquipeEscolha {
  participacaoId: string;
  nome: string;
  ordemPreferencia: number;
  tocaInstrumento: boolean;
  instrumentos: string | null;
  temCarro: boolean;
  temMoto: boolean;
  observacoes: string | null;
  preferencias: Array<{
    equipeId: string;
    equipeNome: string;
    ordemPreferencia: number;
  }>;
}

export interface PesquisaEncontristaEquipeResumo {
  equipeId: string;
  equipeNome: string;
  total: number;
  primeiraOpcao: number;
  segundaOpcao: number;
  terceiraOpcao: number;
  escolhas: PesquisaEncontristaEquipeEscolha[];
}

export interface PesquisaEncontristaRelatorioIAResultado {
  metadata: {
    encontroId: string;
    generatedAt: string;
    totalQuestions: number;
    totalAnswers: number;
    totalRespondents: number;
    reportVersion: number;
    promptVersion: string;
  };
  resumoGeral: {
    sintese: string;
    pontosFortes: string[];
    principaisProblemas: Array<{
      tema: string;
      resumo: string;
      equipesOrigem: Array<{
        nome: string;
        ocorrenciasAproximadas: number;
      }>;
      ocorrenciasAproximadas: number;
    }>;
    equipesMaisCitadas: Array<{
      equipe: string;
      ocorrenciasAproximadas: number;
      contexto: string;
    }>;
  };
  perguntas: Array<{
    questionId: string | null;
    pergunta: string;
    secao: string;
    tipo: PesquisaSatisfacaoQuestion['type'];
    quantidadeRespostas: number;
    resumo: string;
    pontosPositivos: string[];
    pontosNegativos: Array<{
      ponto: string;
      descricao: string;
      equipesOrigem: Array<{
        nome: string;
        ocorrenciasAproximadas: number;
      }>;
      ocorrenciasAproximadas: number;
      recorrencia: 'pontual' | 'recorrente' | string;
    }>;
    sugestoesMencionadas: string[];
  }>;
}

export interface PesquisaEncontristaResumoIA {
  id: string;
  encontro_id: string;
  conteudo: string | null;
  provider: string;
  model: string;
  prompt_version: string;
  total_encontristas: number;
  total_respostas: number;
  gerado_por: string | null;
  created_at: string;
  status: 'completed' | 'error';
  resultado: PesquisaEncontristaRelatorioIAResultado | null;
  erro_mensagem: string | null;
  finalizado_em: string | null;
}

export interface PesquisaEncontristaPainel {
  totalParticipantes: number;
  totalEnviados: number;
  totalRascunhos: number;
  totalPendentes: number;
  respondentes: PesquisaEncontristaRespondente[];
  perguntaResumos: PesquisaEncontristaPerguntaResumo[];
}
