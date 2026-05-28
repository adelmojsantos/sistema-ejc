import { supabase } from '../lib/supabase';
import type {
  PosEncontro,
  PosEncontroFicha,
  PosEncontroFichaFormData,
  PosEncontroFormData,
  PosEncontroParticipanteCirculo,
  PosEncontroPresenca,
  PosEncontroRealizacao,
  PosEncontroRealizacaoFormData
} from '../types/posEncontro';

const POS_ENCONTRO_BUCKET = 'pos-encontros';

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

export const posEncontroService = {
  async listarPorEncontro(encontroId: string, somenteAtivos = false): Promise<PosEncontro[]> {
    let query = supabase
      .from('pos_encontros')
      .select('*, encontros(nome, edicao)')
      .eq('encontro_id', encontroId)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });

    if (somenteAtivos) query = query.eq('ativo', true);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PosEncontro[];
  },

  async obterPorId(id: string): Promise<PosEncontro | null> {
    const { data, error } = await supabase
      .from('pos_encontros')
      .select('*, encontros(nome, edicao)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as PosEncontro | null;
  },

  async criar(payload: PosEncontroFormData): Promise<PosEncontro> {
    const { data, error } = await supabase
      .from('pos_encontros')
      .insert([payload])
      .select('*')
      .single();

    if (error) throw error;
    return data as PosEncontro;
  },

  async atualizar(id: string, payload: Partial<PosEncontroFormData>): Promise<PosEncontro> {
    const { data, error } = await supabase
      .from('pos_encontros')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as PosEncontro;
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('pos_encontros')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async uploadArquivoRoteiro(encontroId: string, file: File): Promise<{
    arquivo_path: string;
    arquivo_nome: string;
    arquivo_tipo: string;
    arquivo_tamanho: number;
  }> {
    const randomId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const storagePath = `${encontroId}/${Date.now()}_${randomId}_${sanitizeFileName(file.name)}`;

    const { error } = await supabase.storage
      .from(POS_ENCONTRO_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    return {
      arquivo_path: storagePath,
      arquivo_nome: file.name,
      arquivo_tipo: file.type || 'application/octet-stream',
      arquivo_tamanho: file.size,
    };
  },

  async removerArquivoRoteiro(storagePath?: string | null): Promise<void> {
    if (!storagePath) return;

    const { error } = await supabase.storage
      .from(POS_ENCONTRO_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error('Erro ao remover arquivo de roteiro:', error);
    }
  },

  async gerarArquivoRoteiroUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(POS_ENCONTRO_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (error) throw error;
    return data.signedUrl;
  },

  async abrirArquivoRoteiro(posEncontro: Pick<PosEncontro, 'arquivo_path'>): Promise<void> {
    if (!posEncontro.arquivo_path) return;
    const url = await this.gerarArquivoRoteiroUrl(posEncontro.arquivo_path);
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  async listarRealizacoes(posEncontroId: string): Promise<PosEncontroRealizacao[]> {
    const { data, error } = await supabase
      .from('pos_encontro_realizacoes')
      .select('*, circulos(nome)')
      .eq('pos_encontro_id', posEncontroId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as PosEncontroRealizacao[];
  },

  async listarCirculosDoMediador(participacaoId: string): Promise<{ id: number; nome: string | null }[]> {
    const { data, error } = await supabase
      .from('circulo_participacao')
      .select('circulo_id, circulos(id, nome)')
      .eq('participacao', participacaoId)
      .eq('mediador', true);

    if (error) throw error;

    return (data ?? [])
      .map((item: any) => {
        const circulo = Array.isArray(item.circulos) ? item.circulos[0] : item.circulos;
        return circulo ? { id: circulo.id as number, nome: circulo.nome as string | null } : null;
      })
      .filter(Boolean) as { id: number; nome: string | null }[];
  },

  async obterRealizacao(posEncontroId: string, circuloId: number): Promise<PosEncontroRealizacao | null> {
    const { data, error } = await supabase
      .from('pos_encontro_realizacoes')
      .select('*, circulos(nome)')
      .eq('pos_encontro_id', posEncontroId)
      .eq('circulo_id', circuloId)
      .maybeSingle();

    if (error) throw error;
    return data as PosEncontroRealizacao | null;
  },

  async salvarRealizacao(payload: PosEncontroRealizacaoFormData): Promise<PosEncontroRealizacao> {
    const { data, error } = await supabase
      .from('pos_encontro_realizacoes')
      .upsert(payload, { onConflict: 'pos_encontro_id,circulo_id' })
      .select('*, circulos(nome)')
      .single();

    if (error) throw error;
    return data as PosEncontroRealizacao;
  },

  async listarParticipantesCirculo(
    encontroId: string,
    circuloId: number,
    realizacaoId?: string | null
  ): Promise<PosEncontroParticipanteCirculo[]> {
    const { data: vinculos, error: vinculosError } = await supabase
      .from('circulo_participacao')
      .select(`
        id,
        circulo_id,
        mediador,
        participacoes!inner (
          id,
          pessoa_id,
          encontro_id,
          equipe_id,
          participante,
          coordenador,
          dados_confirmados,
          pago_taxa,
          pessoas (id, nome_completo, cpf, email, telefone),
          equipes (nome)
        )
      `)
      .eq('circulo_id', circuloId)
      .eq('mediador', false)
      .eq('participacoes.encontro_id', encontroId)
      .order('created_at', { ascending: true });

    if (vinculosError) throw vinculosError;

    const participacaoIds = (vinculos ?? [])
      .map((item: any) => item.participacoes?.id)
      .filter(Boolean) as string[];

    const presencasMap = new Map<string, PosEncontroPresenca>();
    if (realizacaoId && participacaoIds.length > 0) {
      const { data: presencas, error: presencasError } = await supabase
        .from('pos_encontro_presencas')
        .select('*')
        .eq('realizacao_id', realizacaoId)
        .in('participacao_id', participacaoIds);

      if (presencasError) throw presencasError;
      (presencas ?? []).forEach((presenca) => presencasMap.set(presenca.participacao_id, presenca as PosEncontroPresenca));
    }

    const fichasMap = new Map<string, PosEncontroFicha>();
    if (participacaoIds.length > 0) {
      const { data: fichas, error: fichasError } = await supabase
        .from('pos_encontro_fichas')
        .select('*, pos_encontro_ficha_equipes(*, equipes(nome))')
        .eq('encontro_id', encontroId)
        .in('participacao_id', participacaoIds);

      if (fichasError) throw fichasError;
      (fichas ?? []).forEach((ficha) => fichasMap.set(ficha.participacao_id, ficha as PosEncontroFicha));
    }

    return (vinculos ?? []).map((item: any) => ({
      circulo_participacao_id: item.id,
      circulo_id: item.circulo_id,
      mediador: item.mediador,
      participacao: item.participacoes,
      presenca: presencasMap.get(item.participacoes.id) ?? null,
      ficha: fichasMap.get(item.participacoes.id) ?? null
    }));
  },

  async salvarPresencas(realizacaoId: string, presencas: { participacao_id: string; presente: boolean; observacao?: string | null }[]): Promise<void> {
    if (presencas.length === 0) return;

    const { error } = await supabase
      .from('pos_encontro_presencas')
      .upsert(
        presencas.map((presenca) => ({
          realizacao_id: realizacaoId,
          participacao_id: presenca.participacao_id,
          presente: presenca.presente,
          observacao: presenca.observacao ?? null
        })),
        { onConflict: 'realizacao_id,participacao_id' }
      );

    if (error) throw error;
  },

  async salvarFicha(
    payload: PosEncontroFichaFormData,
    preferencias: { equipe_id: string; ordem_preferencia: number }[]
  ): Promise<PosEncontroFicha> {
    const { data: ficha, error: fichaError } = await supabase
      .from('pos_encontro_fichas')
      .upsert(payload, { onConflict: 'encontro_id,participacao_id' })
      .select('*')
      .single();

    if (fichaError) throw fichaError;

    const fichaId = ficha.id as string;

    const { error: deleteError } = await supabase
      .from('pos_encontro_ficha_equipes')
      .delete()
      .eq('ficha_id', fichaId);

    if (deleteError) throw deleteError;

    const cleanPreferencias = preferencias.filter((item) => item.equipe_id);
    if (cleanPreferencias.length > 0) {
      const { error: insertError } = await supabase
        .from('pos_encontro_ficha_equipes')
        .insert(cleanPreferencias.map((item) => ({ ...item, ficha_id: fichaId })));

      if (insertError) throw insertError;
    }

    const { data: fichaCompleta, error: reloadError } = await supabase
      .from('pos_encontro_fichas')
      .select('*, pos_encontro_ficha_equipes(*, equipes(nome))')
      .eq('id', fichaId)
      .single();

    if (reloadError) throw reloadError;
    return fichaCompleta as PosEncontroFicha;
  }
};
