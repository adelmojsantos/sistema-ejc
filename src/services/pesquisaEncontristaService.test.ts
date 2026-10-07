import { describe, expect, it } from 'vitest';
import type { PesquisaEncontristaDetalhe } from '../types/pesquisaEncontrista';
import { resumirEscolhasEquipes } from './pesquisaEncontristaService';

function encontrista(
  participacaoId: string,
  nome: string,
  preferencias: PesquisaEncontristaDetalhe['preferencias'],
): PesquisaEncontristaDetalhe {
  return {
    participacaoId,
    pessoaId: `pessoa-${participacaoId}`,
    nome,
    avaliacaoStatus: 'enviado',
    respostas: {},
    enviadoEm: null,
    tocaInstrumento: false,
    instrumentos: null,
    temCarro: false,
    temMoto: false,
    observacoes: null,
    preferencias,
  };
}

describe('resumirEscolhasEquipes', () => {
  it('agrupa por equipe e preserva a ordem escolhida por cada encontrista', () => {
    const resumo = resumirEscolhasEquipes([
      encontrista('1', 'Maria', [
        { equipeId: 'compras', equipeNome: 'Compras', ordemPreferencia: 1, equipeDisponivel: true },
        { equipeId: 'recepcao', equipeNome: 'Recepção', ordemPreferencia: 2, equipeDisponivel: true },
      ]),
      encontrista('2', 'Ana', [
        { equipeId: 'compras', equipeNome: 'Compras', ordemPreferencia: 3, equipeDisponivel: true },
      ]),
    ]);

    expect(resumo[0]).toMatchObject({
      equipeId: 'compras',
      total: 2,
      primeiraOpcao: 1,
      segundaOpcao: 0,
      terceiraOpcao: 1,
    });
    expect(resumo[0].escolhas.map((item) => [item.nome, item.ordemPreferencia])).toEqual([
      ['Maria', 1],
      ['Ana', 3],
    ]);
  });
});
