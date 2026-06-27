import { supabase } from '../lib/supabase';
import type { LigacaoCorEquipe, LigacaoRegistro } from '../types/ligacao';

interface LigacaoPessoaRow {
  nome_completo: string | null;
  comunidade: string | null;
  telefone?: string | null;
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

interface LigacaoRecreacaoResponsavelRow {
  encontro_id?: string;
  equipe_id: string | null;
  pessoas: LigacaoPessoaRow | LigacaoPessoaRow[] | null;
  equipes: LigacaoEquipeRow | LigacaoEquipeRow[] | null;
}

interface LigacaoRecreacaoRow {
  id: string;
  nome_crianca: string | null;
  idade: number | null;
  observacoes: string | null;
  participacoes: LigacaoRecreacaoResponsavelRow | LigacaoRecreacaoResponsavelRow[] | null;
  outro_responsavel: LigacaoRecreacaoResponsavelRow | LigacaoRecreacaoResponsavelRow[] | null;
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

    const registrosPessoas = ((data ?? []) as LigacaoParticipacaoRow[])
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
      .filter((registro): registro is LigacaoRegistro => registro !== null);

    const { data: recreacaoData, error: recreacaoError } = await supabase
      .from('recreacao_dados')
      .select(`
        id,
        nome_crianca,
        idade,
        observacoes,
        participacoes:participacao_id!inner (
          encontro_id,
          equipe_id,
          pessoas (
            nome_completo,
            comunidade,
            telefone
          ),
          equipes (
            id,
            nome,
            acesso_plenario
          )
        ),
        outro_responsavel:outro_responsavel_id (
          equipe_id,
          pessoas (
            nome_completo,
            comunidade,
            telefone
          ),
          equipes (
            id,
            nome,
            acesso_plenario
          )
        )
      `)
      .eq('participacoes.encontro_id', encontroId)
      .is('deleted_at', null);

    if (recreacaoError) throw recreacaoError;

    const registrosCriancas = ((recreacaoData ?? []) as unknown as LigacaoRecreacaoRow[])
      .map((registro): LigacaoRegistro | null => {
        const responsavel = firstOf(registro.participacoes);
        const responsavelPessoa = firstOf(responsavel?.pessoas);
        const responsavelEquipe = firstOf(responsavel?.equipes);
        const outroResponsavel = firstOf(registro.outro_responsavel);
        const outroPessoa = firstOf(outroResponsavel?.pessoas);
        const outroEquipe = firstOf(outroResponsavel?.equipes);

        return {
          participacao_id: `recreacao-${registro.id}`,
          tipo: 'crianca',
          nome: registro.nome_crianca || 'Criança sem nome',
          foto_url: null,
          foto_posicao_y: 50,
          comunidade: responsavelPessoa?.comunidade || null,
          circulo: null,
          dupla_visitacao: null,
          equipe_id: null,
          equipe: null,
          equipe_cor: null,
          idade: registro.idade ?? null,
          responsavel_principal: responsavelPessoa?.nome_completo || null,
          telefone_responsavel_principal: responsavelPessoa?.telefone || null,
          equipe_responsavel_principal: responsavelEquipe?.nome || null,
          outro_responsavel: outroPessoa?.nome_completo || null,
          telefone_outro_responsavel: outroPessoa?.telefone || null,
          equipe_outro_responsavel: outroEquipe?.nome || null,
          observacoes: registro.observacoes || null,
        };
      })
      .filter((registro): registro is LigacaoRegistro => registro !== null);

    return [...registrosPessoas, ...registrosCriancas]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }
};
