export interface RecepcaoDados {
  id: string;
  participacao_id: string;
  veiculo_tipo: 'moto' | 'carro';
  veiculo_modelo: string;
  veiculo_cor: string;
  veiculo_placa: string;
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
}

export type RecepcaoDadosFormData = Omit<RecepcaoDados, 'id' | 'participacao_id' | 'created_at' | 'updated_at'>;
