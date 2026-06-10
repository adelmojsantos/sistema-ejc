import { supabase } from '../lib/supabase';
import type { LigacaoCorEquipe, LigacaoRegistro } from '../types/ligacao';

interface LigacaoPessoaRow {
  nome_completo: string | null;
  comunidade: string | null;
}

interface LigacaoEquipeRow {
  id: string;
  nome: string | null;
  acesso_plenario: LigacaoCorEquipe | null;
}

interface LigacaoCirculoRow {
  circulos: { nome: string | null } | { nome: string | null }[] | null;
}

interface LigacaoVisitaRow {
  visitante: boolean | null;
  visita_grupos: { nome: string | null } | { nome: string | null }[] | null;
}

interface LigacaoParticipacaoRow {
  id: string;
  participante: boolean | null;
  foto_url: string | null;
  foto_posicao_y: number | null;
  pessoas: LigacaoPessoaRow | LigacaoPessoaRow[] | null;
  equipes: LigacaoEquipeRow | LigacaoEquipeRow[] | null;
  circulo_participacao: LigacaoCirculoRow | LigacaoCirculoRow[] | null;
  visita_participacao: LigacaoVisitaRow | LigacaoVisitaRow[] | null;
}

const firstOf = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export const ligacaoService = {
  async listarPorEncontro(encontroId: string): Promise<LigacaoRegistro[]> {
    const { data, error } = await supabase
      .from('participacoes')
      .select(`
        id,
        participante,
        foto_url,
        foto_posicao_y,
        pessoas (
          nome_completo,
          comunidade
        ),
        equipes (
          id,
          nome,
          acesso_plenario
        ),
        circulo_participacao (
          circulos (nome)
        ),
        visita_participacao (
          visitante,
          visita_grupos (nome)
        )
      `)
      .eq('encontro_id', encontroId);

    if (error) throw error;

    return ((data ?? []) as LigacaoParticipacaoRow[])
      .map((participacao): LigacaoRegistro | null => {
        const pessoa = firstOf(participacao.pessoas);
        if (!pessoa) return null;

        const equipe = firstOf(participacao.equipes);
        const circuloParticipacao = firstOf(participacao.circulo_participacao);
        const circulo = firstOf(circuloParticipacao?.circulos);
        const visitas = Array.isArray(participacao.visita_participacao)
          ? participacao.visita_participacao
          : participacao.visita_participacao
            ? [participacao.visita_participacao]
            : [];
        const visita = visitas.find((item) => item.visitante === false) ?? visitas[0] ?? null;
        const dupla = firstOf(visita?.visita_grupos);
        const isParticipante = participacao.participante === true;

        return {
          participacao_id: participacao.id,
          tipo: isParticipante ? 'participante' : 'encontreiro',
          nome: pessoa.nome_completo || 'Nome não informado',
          foto_url: participacao.foto_url,
          foto_posicao_y: participacao.foto_posicao_y ?? 50,
          comunidade: isParticipante ? pessoa.comunidade || null : null,
          circulo: isParticipante ? circulo?.nome ?? null : null,
          dupla_visitacao: isParticipante ? dupla?.nome ?? null : null,
          equipe_id: isParticipante ? null : equipe?.id ?? null,
          equipe: isParticipante ? null : equipe?.nome ?? null,
          equipe_cor: isParticipante ? null : equipe?.acesso_plenario ?? 'verde'
        };
      })
      .filter((registro): registro is LigacaoRegistro => registro !== null)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }
};
