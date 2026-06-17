import { supabase } from '../lib/supabase';
import type { RelatorioCrachaCor, RelatorioCrachaItem } from '../types/relatorioCracha';
import type { LabelTeamColor } from '../types/label';

interface RelatorioCrachaRow {
  id: string;
  equipe_id: string | null;
  participante: boolean | null;
  pessoas: { nome_completo: string | null } | { nome_completo: string | null }[] | null;
  equipes: { nome: string | null; acesso_plenario: LabelTeamColor | null } | { nome: string | null; acesso_plenario: LabelTeamColor | null }[] | null;
  circulo_participacao:
    | { circulos: { nome: string | null } | { nome: string | null }[] | null }
    | { circulos: { nome: string | null } | { nome: string | null }[] | null }[]
    | null;
}

const firstOf = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const corPorAcesso: Record<LabelTeamColor, RelatorioCrachaCor> = {
  verde: 'Verde',
  amarela: 'Amarelo',
  vermelha: 'Vermelho',
};

const ordemCor: Record<RelatorioCrachaCor, number> = {
  Branco: 0,
  Verde: 1,
  Amarelo: 2,
  Vermelho: 3,
};

export const relatorioCrachaService = {
  async listarPorEncontro(encontroId: string): Promise<RelatorioCrachaItem[]> {
    const { data, error } = await supabase
      .from('participacoes')
      .select(`
        id,
        equipe_id,
        participante,
        pessoas (nome_completo),
        equipes (nome, acesso_plenario),
        circulo_participacao (
          circulos (nome)
        )
      `)
      .eq('encontro_id', encontroId);

    if (error) throw error;

    return ((data ?? []) as RelatorioCrachaRow[])
      .map((row): RelatorioCrachaItem | null => {
        const pessoa = firstOf(row.pessoas);
        const equipe = firstOf(row.equipes);
        const circuloParticipacao = firstOf(row.circulo_participacao);
        const circulo = firstOf(circuloParticipacao?.circulos);
        const acesso = equipe?.acesso_plenario ?? 'verde';
        const cor = row.participante ? 'Branco' : corPorAcesso[acesso];

        if (!cor) return null;

        return {
          id: row.id,
          cor,
          nome: pessoa?.nome_completo?.trim() || 'Nome não informado',
          circulo: row.participante ? circulo?.nome?.trim() || 'Sem círculo' : '',
          equipeId: row.participante ? null : row.equipe_id,
          equipe: row.participante ? '' : equipe?.nome?.trim() || 'Sem equipe',
        };
      })
      .filter((item): item is RelatorioCrachaItem => Boolean(item))
      .sort((a, b) => {
        const corDiff = ordemCor[a.cor] - ordemCor[b.cor];
        if (corDiff !== 0) return corDiff;

        const grupoA = a.cor === 'Branco' ? a.circulo : a.equipe;
        const grupoB = b.cor === 'Branco' ? b.circulo : b.equipe;
        const grupoDiff = grupoA.localeCompare(grupoB, 'pt-BR', { sensitivity: 'base' });
        if (grupoDiff !== 0) return grupoDiff;

        return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
      });
  },
};
