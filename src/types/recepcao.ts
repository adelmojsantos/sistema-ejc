export interface RecepcaoDados {
  id: string;
  participacao_id: string;
  visita_participacao_id?: string | null;
  veiculo_tipo: 'moto' | 'carro';
  veiculo_modelo: string;
  veiculo_cor: string;
  veiculo_placa: string;
  created_at?: string;
  updated_at?: string;

  // Enriched data
  participacoes?: {
    encontro_id: string;
    equipe_id: string | null;
    participante?: boolean | null;
    pessoas: {
      nome_completo: string;
      telefone: string;
    };
    equipes: {
      nome: string;
    };
  };
  visita_participacao?: {
    id: string;
    grupo_id: string;
    status?: string | null;
    visita_grupos?: {
      nome: string | null;
    } | null;
  } | null;
}

export type RecepcaoDadosFormData = Pick<RecepcaoDados, 'veiculo_tipo' | 'veiculo_modelo' | 'veiculo_cor' | 'veiculo_placa'>;

export interface RecepcaoContato {
  id: string;
  nome: string;
  telefone: string | null;
  papel: 'visitante' | 'coordenador';
}

export interface RecepcaoContatosDupla {
  visitantes: RecepcaoContato[];
  coordenadores: RecepcaoContato[];
}
