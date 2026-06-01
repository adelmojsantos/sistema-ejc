export interface EncontroCronogramaItem {
  id: string;
  encontro_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  descricao: string;
  cor: string;
  created_at: string;
  updated_at: string;
}

export interface EncontroCronogramaItemFormData {
  encontro_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  descricao: string;
  cor: string;
}
