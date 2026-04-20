export interface RecreacaoDados {
  id: string;
  participacao_id: string;
  nome_crianca: string;
  idade: number;
  outro_responsavel_id?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  
  // Enriched data
  participacoes?: {
    encontro_id: string;
    equipe_id: string;
    pessoas: {
      nome_completo: string;
      telefone: string;
    };
    equipes: {
      nome: string;
    };
  };
  outro_responsavel?: {
    id: string;
    equipe_id: string;
    pessoas: {
      nome_completo: string;
      telefone: string;
    };
    equipes: {
      nome: string;
    };
  };
}

export type RecreacaoDadosFormData = Omit<RecreacaoDados, 'id' | 'participacao_id' | 'created_at' | 'updated_at' | 'outro_responsavel'>;
