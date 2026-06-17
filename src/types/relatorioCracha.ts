export type RelatorioCrachaCor = 'Branco' | 'Verde' | 'Amarelo' | 'Vermelho';

export interface RelatorioCrachaItem {
  id: string;
  cor: RelatorioCrachaCor;
  nome: string;
  circulo: string;
  equipeId: string | null;
  equipe: string;
}
