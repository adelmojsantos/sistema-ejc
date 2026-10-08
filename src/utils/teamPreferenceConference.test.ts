import { describe, expect, it } from 'vitest';
import type { InscricaoEnriched } from '../types/inscricao';
import type { PesquisaEncontristaDetalhe } from '../types/pesquisaEncontrista';
import {
  buildTeamPreferenceConference,
  summarizeTeamPreferenceConference,
} from './teamPreferenceConference';

function encontrista(
  pessoaId: string,
  nome: string,
  preferencias: PesquisaEncontristaDetalhe['preferencias'],
): PesquisaEncontristaDetalhe {
  return {
    participacaoId: `origem-${pessoaId}`,
    pessoaId,
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

describe('teamPreferenceConference', () => {
  it('compara a equipe atual com a ordem escolhida no encontro anterior', () => {
    const encontristas = [
      encontrista('p1', 'Ana', [
        { equipeId: 'e1', equipeNome: 'Café', ordemPreferencia: 1, equipeDisponivel: true },
      ]),
      encontrista('p2', 'Bia', [
        { equipeId: 'e1', equipeNome: 'Café', ordemPreferencia: 1, equipeDisponivel: true },
        { equipeId: 'e2', equipeNome: 'Compras', ordemPreferencia: 2, equipeDisponivel: true },
      ]),
      encontrista('p3', 'Clara', []),
      encontrista('p4', 'Dora', [
        { equipeId: 'e1', equipeNome: 'Café', ordemPreferencia: 1, equipeDisponivel: true },
      ]),
    ];
    const participacoes = [
      { id: 'i1', pessoa_id: 'p1', equipe_id: 'e1', equipes: { nome: 'Café' } },
      { id: 'i2', pessoa_id: 'p2', equipe_id: 'e2', equipes: { nome: 'Compras' } },
      { id: 'i3', pessoa_id: 'p3', equipe_id: 'e3', equipes: { nome: 'Liturgia' } },
    ] as InscricaoEnriched[];

    const rows = buildTeamPreferenceConference(encontristas, participacoes, [
      { id: 'e1', nome: 'Café' },
      { id: 'e2', nome: 'Compras' },
      { id: 'e3', nome: 'Liturgia' },
    ]);

    expect(rows.map((item) => [item.encontrista.nome, item.match])).toEqual([
      ['Ana', 'primeira'],
      ['Bia', 'segunda'],
      ['Clara', 'fora_das_opcoes'],
      ['Dora', 'sem_equipe'],
    ]);
    expect(summarizeTeamPreferenceConference(rows)).toEqual({
      total: 4,
      assigned: 3,
      unassigned: 1,
      selectedChoice: 2,
      firstChoice: 1,
      secondChoice: 1,
      thirdChoice: 0,
      outsideChoices: 1,
    });
  });

  it('considera vínculo sem equipe como ainda não atribuído', () => {
    const rows = buildTeamPreferenceConference(
      [encontrista('p1', 'Ana', [])],
      [{ id: 'i1', pessoa_id: 'p1', equipe_id: null } as InscricaoEnriched],
      [],
    );

    expect(rows[0]).toMatchObject({
      currentParticipationId: 'i1',
      currentTeamId: null,
      match: 'sem_equipe',
    });
  });
});
