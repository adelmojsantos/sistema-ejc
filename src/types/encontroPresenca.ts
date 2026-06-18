export interface EncontroPresenca {
  id: string;
  encontro_id: string;
  participacao_id: string;
  grupo_id: string | null;
  data: string;
  presente: boolean;
  observacao: string | null;
  marcado_por: string | null;
  marcado_em: string;
  created_at: string;
  updated_at: string;
}

export interface EncontroPresencaParticipante {
  visita_id: string;
  grupo_id: string;
  grupo_nome: string;
  participacao_id: string;
  nome: string;
  telefone: string | null;
  circulo: string | null;
  comunidade: string | null;
  foto_url: string | null;
  presenca: EncontroPresenca | null;
}

export interface SalvarEncontroPresencaInput {
  encontroId: string;
  participacaoId: string;
  grupoId: string | null;
  data: string;
  presente: boolean;
  observacao?: string | null;
}

export interface EncontroPresencaResumo {
  total: number;
  presentes: number;
  ausentes: number;
  pendentes: number;
}
