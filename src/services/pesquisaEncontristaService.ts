import { supabase } from '../lib/supabase';
import type {
  PesquisaSatisfacaoPerguntaFormData,
  PesquisaSatisfacaoQuestion,
  PesquisaSatisfacaoRespostas,
} from '../types/pesquisaSatisfacao';
import type {
  PesquisaEncontristaConfig,
  PesquisaEncontristaEnvio,
  PesquisaEncontristaFluxo,
} from '../types/pesquisaEncontrista';

interface PerguntaRow {
  id: string;
  encontro_id: string;
  ordem: number;
  section_id: string;
  section_title: string;
  title: string;
  type: PesquisaSatisfacaoQuestion['type'];
  required: boolean;
  active: boolean;
}

function mapPergunta(row: PerguntaRow): PesquisaSatisfacaoQuestion {
  return {
    id: row.id,
    encontro_id: row.encontro_id,
    ordem: row.ordem,
    sectionId: row.section_id,
    sectionTitle: row.section_title,
    title: row.title,
    type: row.type,
    required: row.required,
    active: row.active,
  };
}

export const pesquisaEncontristaService = {
  async obterFluxo(token: string): Promise<PesquisaEncontristaFluxo> {
    const { data, error } = await supabase.rpc('get_pesquisa_encontrista_fluxo', {
      p_token: token,
    });
    if (error) throw error;
    const fluxo = data as PesquisaEncontristaFluxo;
    return {
      ...fluxo,
      perguntas: (fluxo.perguntas ?? []).map((item) => mapPergunta(item as unknown as PerguntaRow)),
      respostas: fluxo.respostas ?? {},
    };
  },

  async salvarPublico(
    token: string,
    respostas: PesquisaSatisfacaoRespostas,
    status: 'rascunho' | 'enviado'
  ) {
    const { data, error } = await supabase.rpc('salvar_pesquisa_encontrista_publica', {
      p_token: token,
      p_respostas: respostas,
      p_status: status,
    });
    if (error) throw error;
    return data as {
      status: 'rascunho' | 'enviado';
      respostas: PesquisaSatisfacaoRespostas;
      enviado_em: string | null;
    };
  },

  async obterConfig(encontroId: string): Promise<PesquisaEncontristaConfig> {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_config')
      .select('*')
      .eq('encontro_id', encontroId)
      .maybeSingle();
    if (error) throw error;
    return (data as PesquisaEncontristaConfig | null) ?? {
      encontro_id: encontroId,
      publicada: false,
      publicada_em: null,
    };
  },

  async atualizarPublicacao(encontroId: string, publicada: boolean) {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_config')
      .upsert({
        encontro_id: encontroId,
        publicada,
        publicada_em: publicada ? new Date().toISOString() : null,
      }, { onConflict: 'encontro_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as PesquisaEncontristaConfig;
  },

  async listarPerguntas(encontroId: string, includeInactive = true) {
    let query = supabase
      .from('pesquisa_encontrista_perguntas')
      .select('*')
      .eq('encontro_id', encontroId)
      .order('ordem');
    if (!includeInactive) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as PerguntaRow[]).map(mapPergunta);
  },

  async criarPergunta(formData: PesquisaSatisfacaoPerguntaFormData) {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_perguntas')
      .insert(formData)
      .select('*')
      .single();
    if (error) throw error;
    return mapPergunta(data as PerguntaRow);
  },

  async atualizarPergunta(id: string, formData: Partial<PesquisaSatisfacaoPerguntaFormData>) {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_perguntas')
      .update(formData)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapPergunta(data as PerguntaRow);
  },

  async excluirPergunta(id: string) {
    const { error } = await supabase
      .from('pesquisa_encontrista_perguntas')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;
  },

  async listarEnvios(encontroId: string) {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_envios')
      .select('*, participacoes(pessoas(nome_completo))')
      .eq('encontro_id', encontroId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as PesquisaEncontristaEnvio[];
  },
};
