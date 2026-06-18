import { supabase } from '../lib/supabase';
import type { EncontroPresenca, EncontroPresencaParticipante, EncontroPresencaResumo, SalvarEncontroPresencaInput } from '../types/encontroPresenca';

type MaybeArray<T> = T | T[] | null;

interface PresencaVisitaRow {
  id: string;
  grupo_id: string;
  visita_grupos: MaybeArray<{ nome: string | null }>;
  participacoes: MaybeArray<{
    id: string;
    encontro_id: string;
    foto_url: string | null;
    pessoas: MaybeArray<{
      nome_completo: string | null;
      telefone: string | null;
      comunidade: string | null;
    }>;
    circulo_participacao: MaybeArray<{
      circulos: MaybeArray<{ nome: string | null }>;
    }>;
  }>;
}

const firstOf = <T>(value: MaybeArray<T>): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export const encontroPresencaService = {
  async obterGrupoDoVisitante(participacaoId: string): Promise<{ id: string; nome: string } | null> {
    const { data, error } = await supabase
      .from('visita_participacao')
      .select('grupo_id, visita_grupos:grupo_id (nome)')
      .eq('participacao_id', participacaoId)
      .eq('visitante', true)
      .maybeSingle();

    if (error) throw error;
    if (!data?.grupo_id) return null;

    const grupo = firstOf(data.visita_grupos as MaybeArray<{ nome: string | null }>);
    return {
      id: data.grupo_id as string,
      nome: grupo?.nome || 'Minha Dupla',
    };
  },

  async listarParticipantes(encontroId: string, data: string, grupoId?: string): Promise<EncontroPresencaParticipante[]> {
    let query = supabase
      .from('visita_participacao')
      .select(`
        id,
        grupo_id,
        visita_grupos:grupo_id (nome),
        participacoes:participacao_id (
          id,
          encontro_id,
          foto_url,
          pessoas (nome_completo, telefone, comunidade),
          circulo_participacao (
            circulos (nome)
          )
        )
      `)
      .eq('visitante', false)
      .eq('participacoes.encontro_id', encontroId);

    if (grupoId) query = query.eq('grupo_id', grupoId);

    const { data: vinculos, error: vinculosError } = await query;

    if (vinculosError) throw vinculosError;

    const rows = (vinculos ?? []) as unknown as PresencaVisitaRow[];
    const participacaoIds = rows
      .map((row) => firstOf(row.participacoes)?.id)
      .filter(Boolean) as string[];

    const presencasMap = new Map<string, EncontroPresenca>();
    if (participacaoIds.length > 0) {
      const { data: presencas, error: presencasError } = await supabase
        .from('encontro_presencas')
        .select('*')
        .eq('encontro_id', encontroId)
        .eq('data', data)
        .in('participacao_id', participacaoIds);

      if (presencasError) throw presencasError;
      (presencas ?? []).forEach((presenca) => presencasMap.set(presenca.participacao_id, presenca as EncontroPresenca));
    }

    return rows.flatMap((row) => {
      const participacao = firstOf(row.participacoes);
      const pessoa = firstOf(participacao?.pessoas ?? null);
      if (!participacao || !pessoa) return [];

      const grupo = firstOf(row.visita_grupos);
      const circuloVinculo = firstOf(participacao.circulo_participacao);
      const circulo = firstOf(circuloVinculo?.circulos ?? null);

      return {
        visita_id: row.id,
        grupo_id: row.grupo_id,
        grupo_nome: grupo?.nome || 'Dupla sem nome',
        participacao_id: participacao.id,
        nome: pessoa.nome_completo || 'Nome não informado',
        telefone: pessoa.telefone || null,
        comunidade: pessoa.comunidade || null,
        circulo: circulo?.nome || null,
        foto_url: participacao.foto_url || null,
        presenca: presencasMap.get(participacao.id) ?? null,
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  },

  async listarParticipantesDaDupla(encontroId: string, grupoId: string, data: string): Promise<EncontroPresencaParticipante[]> {
    return this.listarParticipantes(encontroId, data, grupoId);
  },

  async listarPresentesPorData(encontroId: string, data: string): Promise<Set<string>> {
    const { data: presencas, error } = await supabase
      .from('encontro_presencas')
      .select('participacao_id')
      .eq('encontro_id', encontroId)
      .eq('data', data)
      .eq('presente', true);

    if (error) throw error;
    return new Set((presencas ?? []).map((presenca) => presenca.participacao_id as string));
  },

  async obterResumoGeral(encontroId: string, data: string): Promise<EncontroPresencaResumo> {
    const { data: vinculos, error: vinculosError } = await supabase
      .from('visita_participacao')
      .select(`
        participacao_id,
        participacoes:participacao_id (
          id,
          encontro_id
        )
      `)
      .eq('visitante', false)
      .eq('participacoes.encontro_id', encontroId);

    if (vinculosError) throw vinculosError;

    const participacaoIds = Array.from(new Set(
      ((vinculos ?? []) as Array<{ participacao_id: string; participacoes: MaybeArray<{ id: string; encontro_id: string }> }>)
        .filter((item) => firstOf(item.participacoes)?.encontro_id === encontroId)
        .map((item) => item.participacao_id)
        .filter(Boolean)
    ));

    if (participacaoIds.length === 0) {
      return { total: 0, presentes: 0, ausentes: 0, pendentes: 0 };
    }

    const { data: presencas, error: presencasError } = await supabase
      .from('encontro_presencas')
      .select('participacao_id, presente')
      .eq('encontro_id', encontroId)
      .eq('data', data)
      .in('participacao_id', participacaoIds);

    if (presencasError) throw presencasError;

    const presentes = (presencas ?? []).filter((presenca) => presenca.presente === true).length;
    const ausentes = (presencas ?? []).filter((presenca) => presenca.presente === false).length;

    return {
      total: participacaoIds.length,
      presentes,
      ausentes,
      pendentes: participacaoIds.length - presentes - ausentes,
    };
  },

  async salvarPresenca(input: SalvarEncontroPresencaInput): Promise<EncontroPresenca> {
    const { data: authData } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('encontro_presencas')
      .upsert({
        encontro_id: input.encontroId,
        participacao_id: input.participacaoId,
        grupo_id: input.grupoId,
        data: input.data,
        presente: input.presente,
        observacao: input.observacao ?? null,
        marcado_por: authData.user?.id ?? null,
        marcado_em: now,
      }, { onConflict: 'encontro_id,participacao_id,data' })
      .select('*')
      .single();

    if (error) throw error;
    return data as EncontroPresenca;
  },

  async desmarcarPresenca(encontroId: string, participacaoId: string, data: string): Promise<void> {
    const { error } = await supabase
      .from('encontro_presencas')
      .delete()
      .eq('encontro_id', encontroId)
      .eq('participacao_id', participacaoId)
      .eq('data', data);

    if (error) throw error;
  },
};
