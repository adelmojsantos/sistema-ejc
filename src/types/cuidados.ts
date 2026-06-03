export interface CuidadosRegistro {
  participacao_id: string;
  pessoa_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  equipe: string | null;
  circulo: string | null;
  restricao_alimentar: string | null;
  alergia: string | null;
  medicamento_continuo: string | null;
  observacoes_saude: string | null;
  possui_restricao_alimentar: boolean | null;
  possui_alergia: boolean | null;
  usa_medicamento_continuo: boolean | null;
  possui_observacao_saude: boolean | null;
}

export type CuidadosFilter = 'todos' | 'alimentacao' | 'alergias' | 'medicamentos' | 'observacoes' | 'sem_descricao';
