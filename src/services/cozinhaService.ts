import { encontroPresencaService } from './encontroPresencaService';
import { recreacaoService } from './recreacaoService';
import { relatorioCrachaService } from './relatorioCrachaService';
import type { RelatorioCrachaCor, RelatorioCrachaItem } from '../types/relatorioCracha';

export interface CozinhaEquipeResumo {
  id: string;
  nome: string;
  cor: RelatorioCrachaCor;
  total: number;
}

export interface CozinhaMapaResumo {
  encontristasTotal: number;
  encontristasPresentes: number;
  criancasTotal: number;
  equipesRefeicao: CozinhaEquipeResumo[];
  equipesEscondidas: CozinhaEquipeResumo[];
}

const groupEquipes = (items: RelatorioCrachaItem[], cores: RelatorioCrachaCor[]) => {
  const map = new Map<string, CozinhaEquipeResumo>();

  items.forEach((item) => {
    if (!item.equipeId || !cores.includes(item.cor)) return;

    const current = map.get(item.equipeId);
    if (current) {
      current.total += 1;
      return;
    }

    map.set(item.equipeId, {
      id: item.equipeId,
      nome: item.equipe || 'Sem equipe',
      cor: item.cor,
      total: 1,
    });
  });

  return Array.from(map.values())
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
};

export const cozinhaService = {
  async obterMapa(encontroId: string, data: string): Promise<CozinhaMapaResumo> {
    const [items, presentesIds, criancas] = await Promise.all([
      relatorioCrachaService.listarPorEncontro(encontroId),
      encontroPresencaService.listarPresentesPorData(encontroId, data),
      recreacaoService.listarTodosPorEncontro(encontroId),
    ]);

    const encontristas = items.filter((item) => item.cor === 'Branco');

    return {
      encontristasTotal: encontristas.length,
      encontristasPresentes: encontristas.filter((item) => presentesIds.has(item.id)).length,
      criancasTotal: criancas.length,
      equipesRefeicao: groupEquipes(items, ['Verde', 'Amarelo']),
      equipesEscondidas: groupEquipes(items, ['Vermelho']),
    };
  },
};
