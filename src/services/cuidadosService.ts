import { supabase } from '../lib/supabase';
import type { CuidadosRegistro } from '../types/cuidados';

interface PessoaCuidadosRow {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  email: string | null;
  restricao_alimentar: string | null;
  alergia: string | null;
  medicamento_continuo: string | null;
  observacoes_saude: string | null;
  possui_restricao_alimentar: boolean | null;
  possui_alergia: boolean | null;
  usa_medicamento_continuo: boolean | null;
  possui_observacao_saude: boolean | null;
}

interface ParticipacaoCuidadosRow {
  id: string;
  pessoa_id: string;
  pessoas: PessoaCuidadosRow | PessoaCuidadosRow[] | null;
  equipes: { nome: string | null } | { nome: string | null }[] | null;
  circulo_participacao:
    | { circulos: { nome: string | null } | { nome: string | null }[] | null }
    | { circulos: { nome: string | null } | { nome: string | null }[] | null }[]
    | null;
}

const firstOf = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export const cuidadosService = {
  async listarPorEncontro(encontroId: string): Promise<CuidadosRegistro[]> {
    const { data, error } = await supabase
      .from('participacoes')
      .select(`
        id,
        pessoa_id,
        pessoas (
          id,
          nome_completo,
          telefone,
          email,
          restricao_alimentar,
          alergia,
          medicamento_continuo,
          observacoes_saude,
          possui_restricao_alimentar,
          possui_alergia,
          usa_medicamento_continuo,
          possui_observacao_saude
        ),
        equipes (nome),
        circulo_participacao (
          circulos (nome)
        )
      `)
      .eq('encontro_id', encontroId)
      .eq('participante', true);

    if (error) throw error;

    return ((data ?? []) as ParticipacaoCuidadosRow[])
      .map((participacao): CuidadosRegistro | null => {
        const pessoa = firstOf(participacao.pessoas);
        if (!pessoa) return null;

        const equipe = firstOf(participacao.equipes);
        const circuloParticipacao = firstOf(participacao.circulo_participacao);
        const circulo = firstOf(circuloParticipacao?.circulos);

        return {
          participacao_id: participacao.id,
          pessoa_id: participacao.pessoa_id,
          nome: pessoa.nome_completo || 'Nome não informado',
          telefone: pessoa.telefone,
          email: pessoa.email,
          equipe: equipe?.nome ?? null,
          circulo: circulo?.nome ?? null,
          restricao_alimentar: pessoa.restricao_alimentar,
          alergia: pessoa.alergia,
          medicamento_continuo: pessoa.medicamento_continuo,
          observacoes_saude: pessoa.observacoes_saude,
          possui_restricao_alimentar: pessoa.possui_restricao_alimentar,
          possui_alergia: pessoa.possui_alergia,
          usa_medicamento_continuo: pessoa.usa_medicamento_continuo,
          possui_observacao_saude: pessoa.possui_observacao_saude
        };
      })
      .filter((registro): registro is CuidadosRegistro => {
        if (!registro) return false;
        return (
          registro.possui_restricao_alimentar === true ||
          registro.possui_alergia === true ||
          registro.usa_medicamento_continuo === true ||
          registro.possui_observacao_saude === true
        );
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }
};
