import type { Encontro } from '../types/encontro';

function byMostRecentDate(a: Encontro, b: Encontro) {
  return new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime();
}

export function findPreviousEncounter(
  encontros: Encontro[],
  selectedEncounterId: string,
): Encontro | null {
  const selected = encontros.find((encontro) => encontro.id === selectedEncounterId);
  if (!selected) return null;

  if (selected.edicao !== null) {
    const selectedEdition = selected.edicao;
    const byEdition = encontros
      .filter((encontro) => encontro.id !== selected.id && encontro.edicao !== null && encontro.edicao < selectedEdition)
      .sort((a, b) => (b.edicao ?? 0) - (a.edicao ?? 0) || byMostRecentDate(a, b));
    if (byEdition[0]) return byEdition[0];
  }

  const selectedStart = new Date(selected.data_inicio).getTime();
  return encontros
    .filter((encontro) => encontro.id !== selected.id && new Date(encontro.data_inicio).getTime() < selectedStart)
    .sort(byMostRecentDate)[0] ?? null;
}
