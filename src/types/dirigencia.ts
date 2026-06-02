export type DirigenciaStatus = 'indicacao' | 'ativa' | 'encerrada';
export type IndicacaoTipo = 'regular' | 'adicional';
export type IndicacaoStatus = 'indicada' | 'selecionada' | 'descartada';

export interface DirigenciaPessoaResumo {
  id: string;
  nome_completo: string;
  email: string | null;
}

export interface Dirigencia {
  id: string;
  nome: string;
  status: DirigenciaStatus;
  data_inicio: string | null;
  data_fim: string | null;
  indicacoes_finalizadas_em: string | null;
  ativada_em: string | null;
  encerrada_em: string | null;
  created_at: string;
}

export interface DirigenciaMembro {
  id: string;
  dirigencia_id: string;
  pessoa_id: string;
  ativo: boolean;
  entrou_em: string;
  saiu_em: string | null;
  motivo_saida: string | null;
  pessoas: DirigenciaPessoaResumo;
}

export interface DirigenciaIndicacao {
  id: string;
  dirigencia_origem_id: string;
  dirigencia_destino_id: string;
  indicador_membro_id: string | null;
  indicado_pessoa_id: string;
  tipo: IndicacaoTipo;
  motivo: string | null;
  status: IndicacaoStatus;
  created_at: string;
  indicado: DirigenciaPessoaResumo;
  indicador: {
    id: string;
    pessoas: DirigenciaPessoaResumo;
  } | null;
}

export interface DirigenciaEvento {
  id: string;
  dirigencia_id: string;
  tipo: string;
  descricao: string;
  executado_por_nome: string;
  created_at: string;
}
