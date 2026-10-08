import type { InscricaoEnriched } from '../types/inscricao';
import type { PesquisaEncontristaDetalhe } from '../types/pesquisaEncontrista';

export type TeamPreferenceMatch =
  | 'sem_equipe'
  | 'primeira'
  | 'segunda'
  | 'terceira'
  | 'fora_das_opcoes';

export interface TeamPreferenceConferenceRow {
  encontrista: PesquisaEncontristaDetalhe;
  currentParticipationId: string | null;
  currentTeamId: string | null;
  currentTeamName: string | null;
  match: TeamPreferenceMatch;
}

export interface TeamPreferenceConferenceMetrics {
  total: number;
  assigned: number;
  unassigned: number;
  selectedChoice: number;
  firstChoice: number;
  secondChoice: number;
  thirdChoice: number;
  outsideChoices: number;
}

interface TeamReference {
  id: string;
  nome: string | null;
}

export function buildTeamPreferenceConference(
  encontristas: PesquisaEncontristaDetalhe[],
  currentParticipations: InscricaoEnriched[],
  teams: TeamReference[],
): TeamPreferenceConferenceRow[] {
  const participationsByPerson = new Map(
    currentParticipations.map((item) => [item.pessoa_id, item]),
  );
  const teamNames = new Map(teams.map((item) => [item.id, item.nome]));

  return encontristas
    .map((encontrista) => {
      const current = participationsByPerson.get(encontrista.pessoaId);
      const currentTeamId = current?.equipe_id ?? null;
      const selectedPreference = currentTeamId
        ? encontrista.preferencias.find((item) => item.equipeId === currentTeamId)
        : null;
      const match: TeamPreferenceMatch = !currentTeamId
        ? 'sem_equipe'
        : selectedPreference?.ordemPreferencia === 1
          ? 'primeira'
          : selectedPreference?.ordemPreferencia === 2
            ? 'segunda'
            : selectedPreference?.ordemPreferencia === 3
              ? 'terceira'
              : 'fora_das_opcoes';

      return {
        encontrista,
        currentParticipationId: current?.id ?? null,
        currentTeamId,
        currentTeamName: currentTeamId
          ? current?.equipes?.nome ?? teamNames.get(currentTeamId) ?? 'Equipe não identificada'
          : null,
        match,
      };
    })
    .sort((a, b) => a.encontrista.nome.localeCompare(b.encontrista.nome, 'pt-BR'));
}

export function summarizeTeamPreferenceConference(
  rows: TeamPreferenceConferenceRow[],
): TeamPreferenceConferenceMetrics {
  const firstChoice = rows.filter((item) => item.match === 'primeira').length;
  const secondChoice = rows.filter((item) => item.match === 'segunda').length;
  const thirdChoice = rows.filter((item) => item.match === 'terceira').length;
  const outsideChoices = rows.filter((item) => item.match === 'fora_das_opcoes').length;
  const unassigned = rows.filter((item) => item.match === 'sem_equipe').length;

  return {
    total: rows.length,
    assigned: rows.length - unassigned,
    unassigned,
    selectedChoice: firstChoice + secondChoice + thirdChoice,
    firstChoice,
    secondChoice,
    thirdChoice,
    outsideChoices,
  };
}
